import { isSimpleError, isSimpleErrors, SimpleError } from '@common/errors';
import { Response } from '@node/endpoints';
import type { Organization, User } from '@stamhoofd/models';
import { BelcotaxApiLogAction, BelcotaxConnection } from '@stamhoofd/models';
import { QueueHandler } from '@stamhoofd/queues';
import { PermissionLevel } from '@stamhoofd/types/PermissionLevel';
import {
    BelcotaxFeatureFlag,
    getBelcotaxCompanyNumber,
} from '@stamhoofd/structures/belcotax/BelcotaxConnection.js';

import { Context } from '../../../helpers/Context.js';
import { BelcotaxConfig } from './BelcotaxConfig.js';
import type { BelcotaxHttpResponse, BelcotaxLogContext } from './BelcotaxHttp.js';
import { BelcotaxHttp } from './BelcotaxHttp.js';
import type { BelcotaxTokenSet } from './BelcotaxOidcClient.js';
import { BelcotaxOidcClient, BelcotaxTokenError } from './BelcotaxOidcClient.js';

type PendingAuthorization = {
    organizationId: string;
    companyNumber: string;
    userId: string;
    userName: string;
    codeVerifier: string;
    nonce: string;
    redirectUri: string;
    spaState: string;
    expires: Date;
};

export type BelcotaxCallbackQuery = {
    code?: string;
    state?: string;
    iss?: string;
    client_id?: string;
    error?: string;
    error_description?: string;
};

export type BelcotaxApi = {
    /**
     * Calls the Belcotax API with a valid access token, relative to its base URL
     */
    request(request: {
        method: string;
        path: string;
        headers?: Record<string, string>;
        body?: string | FormData;
        timeout?: number;
    }): Promise<BelcotaxHttpResponse>;
};

/**
 * Pending logins are kept in memory, like the SSO logins: the authorization code has to come back
 * within minutes, so a restart only means starting over.
 */
const pendingLifetime = 15 * 60 * 1000;

export class BelcotaxConnectionService {
    private static pending = new Map<string, PendingAuthorization>();

    static async authenticate() {
        const organization = await Context.setOrganizationScope();
        const { user } = await Context.authenticate();

        if (!(await Context.auth.canManageDocuments(organization.id, PermissionLevel.Full))) {
            throw Context.auth.error();
        }

        if (!(await Context.checkFeatureFlag(BelcotaxFeatureFlag))) {
            throw new SimpleError({
                code: 'not_available',
                message: 'The Belcotax API is not enabled',
                human: $t('De koppeling met Belcotax is nog niet beschikbaar.'),
                statusCode: 400,
            });
        }

        return { organization, user };
    }

    static async startConnect(
        organization: Organization,
        user: User,
        request: { companyId: string; redirectUri: string; spaState: string },
    ): Promise<string> {
        if (!BelcotaxConfig.isConfigured) {
            throw BelcotaxConfig.notConfiguredError();
        }

        const company = organization.meta.companies.find((c) => c.id === request.companyId);
        if (!company) {
            throw new SimpleError({
                code: 'invalid_field',
                message: 'Unknown company',
                field: 'companyId',
                statusCode: 400,
            });
        }

        const companyNumber = getBelcotaxCompanyNumber(company);
        if (!companyNumber) {
            throw new SimpleError({
                code: 'belcotax_missing_company_number',
                message: 'The company has no valid KBO number',
                human: $t(
                    'Enkel een onderneming met een geldig ondernemingsnummer kan verbinden met Belcotax.',
                ),
                field: 'companyId',
                statusCode: 400,
            });
        }

        this.validateRedirectUri(request.redirectUri);

        if (request.spaState.length < 10) {
            throw new SimpleError({
                code: 'invalid_state',
                message: 'Invalid state',
                statusCode: 400,
            });
        }

        const authorization = await BelcotaxOidcClient.createAuthorization(companyNumber);
        this.clearExpired();
        this.pending.set(authorization.state, {
            organizationId: organization.id,
            companyNumber,
            userId: user.id,
            userName: user.name ?? '',
            codeVerifier: authorization.codeVerifier,
            nonce: authorization.nonce,
            redirectUri: request.redirectUri,
            spaState: request.spaState,
            expires: new Date(Date.now() + pendingLifetime),
        });

        await BelcotaxHttp.log(
            { organizationId: organization.id, companyNumber, userId: user.id },
            {
                action: BelcotaxApiLogAction.Authorize,
                method: 'GET',
                url: new URL(authorization.url).origin + new URL(authorization.url).pathname,
                success: true,
            },
        );

        return authorization.url;
    }

    private static validateRedirectUri(uri: string) {
        let parsed: URL | null = null;
        try {
            parsed = new URL(uri);
        } catch {
            // handled below
        }

        if (
            !parsed ||
            parsed.protocol !== 'https:' ||
            parsed.host !== STAMHOOFD.domains.dashboard
        ) {
            throw new SimpleError({
                code: 'invalid_redirect_uri',
                message: 'Invalid redirect uri',
                field: 'redirectUri',
                statusCode: 400,
            });
        }
    }

    private static clearExpired() {
        const now = new Date();
        for (const [key, value] of this.pending) {
            if (value.expires < now) {
                this.pending.delete(key);
            }
        }
    }

    /**
     * The browser of the legal representative returns here from FOD. Always redirects back to the
     * dashboard, with the result or a human readable reason in the URL.
     */
    static async handleCallback(query: BelcotaxCallbackQuery): Promise<Response<undefined>> {
        const pending = query.state ? this.pending.get(query.state) : undefined;
        if (query.state) {
            // Single use
            this.pending.delete(query.state);
        }

        if (!pending || pending.expires < new Date()) {
            await BelcotaxHttp.log(
                {
                    organizationId: pending?.organizationId ?? null,
                    companyNumber: pending?.companyNumber ?? null,
                },
                {
                    action: BelcotaxApiLogAction.Callback,
                    method: 'GET',
                    url: BelcotaxConfig.redirectUri,
                    success: false,
                    error: 'Unknown or expired state',
                },
            );
            return this.redirect(
                pending?.redirectUri ?? 'https://' + STAMHOOFD.domains.dashboard,
                pending?.spaState ?? null,
                $t(
                    'Deze aanmelding is verlopen of werd al gebruikt. Probeer opnieuw te verbinden.',
                ),
            );
        }

        const context: BelcotaxLogContext = {
            organizationId: pending.organizationId,
            companyNumber: pending.companyNumber,
            userId: pending.userId,
        };

        try {
            const connection = await this.completeAuthorization(pending, context, query);
            await BelcotaxHttp.log(
                { ...context, connectionId: connection.id },
                {
                    action: BelcotaxApiLogAction.Callback,
                    method: 'GET',
                    url: BelcotaxConfig.redirectUri,
                    success: true,
                    representativeName: connection.representativeName,
                },
            );
            return this.redirect(pending.redirectUri, pending.spaState, null);
        } catch (e) {
            console.error('Belcotax connection failed', e);
            const message =
                isSimpleError(e) || isSimpleErrors(e)
                    ? e.getHuman()
                    : $t(
                          'Er ging iets mis bij het verbinden met Belcotax. Probeer het later opnieuw.',
                      );
            await BelcotaxHttp.log(context, {
                action: BelcotaxApiLogAction.Callback,
                method: 'GET',
                url: BelcotaxConfig.redirectUri,
                success: false,
                error: e instanceof Error ? e.message : String(e),
            });
            return this.redirect(pending.redirectUri, pending.spaState, message);
        }
    }

    private static async completeAuthorization(
        pending: PendingAuthorization,
        context: BelcotaxLogContext,
        query: BelcotaxCallbackQuery,
    ): Promise<BelcotaxConnection> {
        if (query.error) {
            throw this.authorizationError(
                query.error,
                query.error_description ?? '',
                pending.companyNumber,
            );
        }

        // Mix-up protection (§4.2.2.1): the response has to come from the issuer we sent the user to
        if (
            (query.iss && query.iss !== (await BelcotaxConfig.getEndpoints()).issuer) ||
            (query.client_id && query.client_id !== BelcotaxConfig.clientId)
        ) {
            throw new SimpleError({
                code: 'belcotax_invalid_callback',
                message:
                    'The callback came from another issuer or client: ' +
                    (query.iss ?? '') +
                    ' ' +
                    (query.client_id ?? ''),
                statusCode: 400,
            });
        }

        if (!query.code) {
            throw new SimpleError({
                code: 'belcotax_invalid_callback',
                message: 'Missing code',
                statusCode: 400,
            });
        }

        const tokens = await BelcotaxOidcClient.exchangeCode(
            context,
            query.code,
            pending.codeVerifier,
        );
        if (!tokens.idToken) {
            throw new SimpleError({
                code: 'belcotax_invalid_id_token',
                message: 'The token response has no ID token',
                human: $t('FOD Financiën gaf een onverwacht antwoord. Probeer het later opnieuw.'),
                statusCode: 502,
            });
        }

        const claims = await BelcotaxOidcClient.verifyIdToken(tokens.idToken, {
            nonce: pending.nonce,
        });
        if (claims.companyNumber !== pending.companyNumber) {
            throw new SimpleError({
                code: 'belcotax_wrong_company',
                message: `The ID token is for ${claims.companyNumber}, expected ${pending.companyNumber}`,
                human: $t(
                    'Je meldde je bij FOD Financiën aan voor onderneming {received}. In #platform staat echter {expected}. Er werd niets gewijzigd. Probeer het opnieuw en selecteer de juiste onderneming of wijzig het nummer in #platform.',
                    {
                        received: formatCompanyNumber(claims.companyNumber),
                        expected: formatCompanyNumber(pending.companyNumber),
                    },
                ),
                statusCode: 400,
            });
        }

        return await QueueHandler.schedule(this.getQueueName(pending.companyNumber), async () => {
            const connection =
                (await BelcotaxConnection.getFor(pending.organizationId, pending.companyNumber)) ??
                new BelcotaxConnection();
            connection.organizationId = pending.organizationId;
            connection.companyNumber = pending.companyNumber;
            connection.userId = pending.userId;
            connection.representativeName = claims.representativeName || pending.userName;
            this.storeTokens(connection, tokens);
            await connection.save();
            return connection;
        });
    }

    private static authorizationError(error: string, description: string, companyNumber: string) {
        const kbo = formatCompanyNumber(companyNumber);
        if (error === 'access_denied') {
            return new SimpleError({
                code: 'belcotax_access_denied',
                message: `FOD Financiën: ${error} ${description}`,
                human: $t(
                    'Er werd geen toestemming gegeven bij FOD Financiën. Er werd niets gewijzigd.',
                ),
                statusCode: 400,
            });
        }
        if (/no rights/i.test(description)) {
            return new SimpleError({
                code: 'belcotax_not_representative',
                message: `FOD Financiën: ${error} ${description}`,
                human: $t(
                    'FOD Financiën weigerde de verbinding: je bent volgens de KBO geen wettelijk vertegenwoordiger van onderneming {kbo}. Er werd niets gewijzigd. Je kan het bestand voor Belcotax nog altijd downloaden en zelf opladen.',
                    { kbo },
                ),
                statusCode: 400,
            });
        }
        return new SimpleError({
            code: 'belcotax_authorization_error',
            message: `FOD Financiën: ${error} ${description}`,
            human: $t('FOD Financiën weigerde de verbinding ({reason}). Er werd niets gewijzigd.', {
                reason: description || error,
            }),
            statusCode: 400,
        });
    }

    private static redirect(redirectUri: string, spaState: string | null, error: string | null) {
        const url = new URL(redirectUri);
        url.searchParams.set('belcotax_result', error ? 'error' : 'connected');
        if (error) {
            url.searchParams.set('belcotax_error', error);
        }
        if (spaState) {
            url.searchParams.set('belcotax_state', spaState);
        }
        const response = new Response(undefined);
        response.status = 302;
        response.headers['location'] = url.href;
        return response;
    }

    private static storeTokens(connection: BelcotaxConnection, tokens: BelcotaxTokenSet) {
        connection.refreshToken = tokens.refreshToken;
        connection.validUntil = tokens.refreshTokenValidUntil;
    }

    /**
     * Refresh tokens are single use, so two refreshes for the same company at the same time would
     * end the connection. Everything that uses a connection runs in this queue.
     */
    static getQueueName(companyNumber: string) {
        return 'belcotax-' + companyNumber;
    }

    static expiredError() {
        return new SimpleError({
            code: 'belcotax_connection_expired',
            message: 'The Belcotax connection expired',
            human: $t(
                'De verbinding met Belcotax is verlopen. Een wettelijk vertegenwoordiger moet opnieuw aanmelden.',
            ),
            statusCode: 400,
        });
    }

    /**
     * Refreshes the tokens (which extends the connection with 7 days) and runs the handler with an
     * API client. There is no background job keeping connections alive: only actions do.
     */
    static async run<T>(
        connection: BelcotaxConnection,
        handler: (api: BelcotaxApi) => Promise<T>,
        options: { userId?: string | null } = {},
    ): Promise<T> {
        return await QueueHandler.schedule(
            this.getQueueName(connection.companyNumber),
            async () => {
                await connection.refresh();
                const context: BelcotaxLogContext = {
                    organizationId: connection.organizationId,
                    companyNumber: connection.companyNumber,
                    connectionId: connection.id,
                    userId: options.userId ?? null,
                };

                let tokens = await this.refreshTokens(connection, context);

                const send = async (request: Parameters<BelcotaxApi['request']>[0]) => {
                    return await BelcotaxHttp.request(context, BelcotaxApiLogAction.ApiCall, {
                        method: request.method,
                        url: BelcotaxConfig.apiUrl + request.path,
                        headers: {
                            ...request.headers,
                            Authorization: 'Bearer ' + tokens.accessToken,
                        },
                        body: request.body,
                        timeout: request.timeout,
                    });
                };

                const api: BelcotaxApi = {
                    request: async (request) => {
                        if (tokens.accessTokenExpiresAt < new Date()) {
                            tokens = await this.refreshTokens(connection, context);
                        }
                        const response = await send(request);
                        if (response.status !== 401) {
                            return response;
                        }
                        // A 401 is refused before anything is processed, so sending again is safe
                        tokens = await this.refreshTokens(connection, context);
                        return await send(request);
                    },
                };

                return await handler(api);
            },
        );
    }

    private static async refreshTokens(
        connection: BelcotaxConnection,
        context: BelcotaxLogContext,
    ) {
        if (!connection.isValid || !connection.refreshToken) {
            throw this.expiredError();
        }

        let tokens: BelcotaxTokenSet;
        try {
            tokens = await BelcotaxOidcClient.refresh(context, connection.refreshToken);
        } catch (e) {
            if (
                e instanceof BelcotaxTokenError &&
                (e.fodError === 'invalid_grant' || e.fodError === 'invalid_token')
            ) {
                connection.refreshToken = null;
                await connection.save();
                throw this.expiredError();
            }
            throw e;
        }

        // Store before anything else: the old refresh token no longer works
        this.storeTokens(connection, tokens);
        await connection.save();

        if (tokens.idToken) {
            const claims = await BelcotaxOidcClient.verifyIdToken(tokens.idToken);
            if (claims.companyNumber !== connection.companyNumber) {
                throw new SimpleError({
                    code: 'belcotax_wrong_company',
                    message: `The refreshed ID token is for ${claims.companyNumber}, expected ${connection.companyNumber}`,
                    statusCode: 500,
                });
            }
        }
        return tokens;
    }
}

function formatCompanyNumber(companyNumber: string) {
    return companyNumber.replace(/^(\d{4})(\d{3})(\d{3})$/, '$1.$2.$3');
}
