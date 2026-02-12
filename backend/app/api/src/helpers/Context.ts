import { DecodedRequest, Request } from '@simonbackx/simple-endpoints';
import { isSimpleError, SimpleError } from '@simonbackx/simple-errors';
import { I18n } from '@stamhoofd/backend-i18n';
import { Organization, Platform, RateLimiter, Token, User } from '@stamhoofd/models';
import { AsyncLocalStorage } from 'async_hooks';

import { AutoEncoder, Decoder, field, StringDecoder } from '@simonbackx/simple-encoding';
import { ApiUserRateLimits } from '@stamhoofd/structures';
import { AdminPermissionChecker } from './AdminPermissionChecker.js';

export const apiUserRateLimiter = new RateLimiter({
    limits: [
        {
            limit: {
                '': 25, // (5req/s for 5s)
                [ApiUserRateLimits.Medium]: 10 * 5, // (10req/s for 5s)
                [ApiUserRateLimits.High]: 25 * 5, // (100req/s for 5s)
            },
            duration: 5 * 1000,
        },
        {
            limit: {
                '': 120, // max 1req/s during 150s
                [ApiUserRateLimits.Medium]: 240, // (2req/s for 150s)
                [ApiUserRateLimits.High]: 480, // (4req/s for 150s)
            },
            duration: 120 * 1000,
        },
        {
            limit: {
                '': 1000, // ± 0.27 request/s sustained for an hour = 3.6s between each request
                [ApiUserRateLimits.Medium]: 2000, // ± 0.56 request/s sustained for an hour
                [ApiUserRateLimits.High]: 4000, // ± 1.11 request/s sustained for an hour
            },
            duration: 60 * 1000 * 60,
        },
        {
            limit: {
                '': 2_000, // max 2000 requests per day
                [ApiUserRateLimits.Medium]: 14_400, // max 4000 requests per day
                [ApiUserRateLimits.High]: 18_000, // max 10 requests per minute, sustained for a full day
            },
            duration: 24 * 60 * 1000 * 60,
        },
    ],
});

export class AuthorizationPostBody extends AutoEncoder {
    @field({ decoder: StringDecoder })
    header_authorization: string;
}

export class ContextInstance {
    request: Request;
    queries: { query: string; time?: number }[] = [];

    user?: User;
    organization?: Organization;

    #i18n: I18n | null = null;
    #auth: AdminPermissionChecker | null = null;

    constructor(request: Request) {
        this.request = request;
    }

    static asyncLocalStorage = new AsyncLocalStorage<ContextInstance>();

    static get optional(): ContextInstance | null {
        const c = this.asyncLocalStorage.getStore();

        return c ?? null;
    }

    static get current(): ContextInstance {
        const c = this.optional;

        if (!c) {
            throw new SimpleError({
                code: 'no_context',
                message: 'No context found',
                statusCode: 500,
            });
        }

        return c;
    }

    static async startForUser<T>(user: User, organization: Organization | null, handler: () => Promise<T>): Promise<T> {
        const request = new Request({
            method: 'GET',
            url: '/',
            host: '',
        });
        const context = new ContextInstance(request);

        if (organization) {
            context.organization = organization;
            context.i18n.switchToLocale({ country: organization.address.country });
        }

        context.user = user;
        context.#auth = new AdminPermissionChecker(user, await Platform.getSharedPrivateStruct(), context.organization);

        return await this.asyncLocalStorage.run(context, async () => {
            return await handler();
        });
    }

    static getContextFromRequest(request: Request): ContextInstance {
        if ((request as any)._context) {
            return (request as any)._context as ContextInstance;
        }
        const context = new ContextInstance(request);
        (request as any)._context = context;
        return context;
    }

    static async start<T>(request: Request, handler: () => Promise<T>): Promise<T> {
        const context = this.getContextFromRequest(request);

        return await this.asyncLocalStorage.run(context, async () => {
            return await handler();
        });
    }

    get version() {
        return this.request.getVersion();
    }

    get i18n() {
        if (!this.#i18n) {
            this.#i18n = I18n.fromRequest(this.request);
        }
        return this.#i18n;
    }

    get auth() {
        if (!this.#auth) {
            throw new SimpleError({
                code: 'internal_error',
                statusCode: 500,
                message: 'AdminPermissionChecker not set in RequestContext: make sure the request is authenticated before using the permissionChecker',
            });
        }
        return this.#auth;
    }

    get optionalAuth() {
        return this.#auth;
    }

    async setOptionalOrganizationScope(options?: { willAuthenticate?: boolean }) {
        try {
            return await this.setOrganizationScope(options);
        }
        catch (e) {
            if (isSimpleError(e) && e.hasCode('invalid_host')) {
                return null;
            }
            throw e;
        }
    }

    async checkFeatureFlag(flag: string): Promise<boolean> {
        const platform = await Platform.getSharedStruct();
        if (platform.config.featureFlags.includes(flag)) {
            return true;
        }
        const organization = this.organization;
        return organization?.privateMeta?.featureFlags.includes(flag) ?? false;
    }

    /**
     * Require organization scope if userMode is not platform
     */
    async setUserOrganizationScope(options?: { willAuthenticate?: boolean }) {
        if (STAMHOOFD.userMode === 'platform') {
            return null;
        }
        return await this.setOrganizationScope(options);
    }

    async setOrganizationScope(options?: { willAuthenticate?: boolean }) {
        if (!options) {
            options = {};
        }

        const organization = await Organization.fromApiHost(this.request.host, {
            allowInactive: options.willAuthenticate ?? true,
        });

        this.organization = organization;
        this.i18n.switchToLocale({ country: organization.address.country });

        return organization;
    }

    async optionalAuthenticate({ allowWithoutAccount = false }: { allowWithoutAccount?: boolean } = {}): Promise<{ user?: User }> {
        try {
            return await this.authenticate({ allowWithoutAccount });
        }
        catch (e) {
            if (e.code === 'not_authenticated') {
                // Do not allow to optional authenticate to inactive organizations
                if (this.organization && !this.organization.active) {
                    throw new SimpleError({
                        code: 'not_authenticated',
                        message: 'You need to authenticate to view inactive organizations',
                        statusCode: 401,
                    });
                }
                return {};
            }
            throw e;
        }
    }

    async authenticate({ allowWithoutAccount = false }: { allowWithoutAccount?: boolean } = {}): Promise<{ user: User; token: Token }> {
        let header = this.request.headers.authorization;

        if (!header && this.request.method === 'POST') {
            try {
                const decoded = await DecodedRequest.fromRequest(this.request, undefined, undefined, AuthorizationPostBody as Decoder<AuthorizationPostBody>);
                header = decoded.body.header_authorization;
            }
            catch (e) {
                // Ignore: failed to read from body
            }
        }

        if (!header) {
            throw new SimpleError({
                code: 'not_authenticated',
                message: 'Missing required authorization header',
                statusCode: 401,
            });
        }

        if (!header.startsWith('Bearer ')) {
            throw new SimpleError({
                code: 'not_supported_authentication',
                message: 'Authentication method not supported. Please authenticate with OAuth2',
                statusCode: 401,
            });
        }

        const accessToken = header.substring('Bearer '.length);

        const token = await Token.getByAccessToken(accessToken, true);

        if (!token || (this.organization && token.user.organizationId !== null && token.user.organizationId !== this.organization.id) || (!this.organization && token.user.organizationId)) {
            if (token?.user) {
                console.log(
                    'Failed auth: ' + token?.user.email + ' (' + token?.user.id + ')',
                );
            }
            throw new SimpleError({
                code: 'invalid_access_token',
                message: 'The access token is invalid',
                human: $t(`739f88f4-e87d-4872-aef3-8124a59b160c`),
                statusCode: 401,
            });
        }

        if (token.isAccessTokenExpired()) {
            if (token?.user) {
                console.log(
                    'Failed auth: ' + token?.user.email + ' (' + token?.user.id + ')',
                );
            }
            throw new SimpleError({
                code: 'expired_access_token',
                message: 'The access token is expired',
                human: $t(`739f88f4-e87d-4872-aef3-8124a59b160c`),
                statusCode: 401,
            });
        }

        if (!token.user.hasAccount() && !allowWithoutAccount) {
            if (token?.user) {
                console.log(
                    'Failed auth: ' + token?.user.email + ' (' + token?.user.id + ')',
                );
            }
            throw new SimpleError({
                code: 'not_activated',
                message: 'This user is not yet activated',
                human: $t(`28cf3aaf-d6b3-4325-8b01-4c0e754034ed`),
                statusCode: 401,
            });
        }

        // Rate limits for api users
        if (token.user.isApiUser) {
            apiUserRateLimiter.track(this.organization?.id ?? token.user.id, 1, token.user.meta?.rateLimits ?? undefined);
        }

        const user = token.user;
        this.user = user;

        console.log(
            'Auth: ' + user.email + ' (' + user.id + ')',
        );

        // Load member of user
        // todo

        this.#auth = new AdminPermissionChecker(user, await Platform.getSharedPrivateStruct(), this.organization);

        if (this.organization && !this.organization.active) {
            // For inactive organizations, you always need permissions to view them
            if (!Context.auth.hasSomePlatformAccess() || !await Context.auth.hasFullAccess(this.organization.id)) {
                throw new SimpleError({
                    code: 'archived',
                    message: 'Platform access is required to view inactive organizations',
                    human: $t('3e8dba08-a505-41ec-96c1-b2b5c1c17852'),
                    statusCode: 401,
                });
            }
        }

        return { user, token };
    }
}

export const Context = new Proxy(ContextInstance, {
    get(target, prop, receiver) {
        const c = target.current[prop];
        if (c && typeof c === 'function') {
            return c.bind(target.current);
        }
        return c;
    },
}) as unknown as ContextInstance;
