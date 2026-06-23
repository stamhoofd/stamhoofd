import { AutoEncoder, encodeObject, field, IntegerDecoder, ObjectData, StringDecoder } from '@simonbackx/simple-encoding';
import { SimpleError } from '@simonbackx/simple-errors';
import type { RequestResult } from '@simonbackx/simple-networking';
import { Server } from '@simonbackx/simple-networking';
import { Storage } from '@stamhoofd/networking/Storage';
import type { SGVTokenResponse } from '@stamhoofd/sgv';
import {
    SGV_LOGIN_AUTHORIZE_PATH,
    SGV_LOGIN_TOKEN_PATH,
} from '@stamhoofd/sgv';

const SGV_OAUTH_PENDING_STORAGE_KEY = 'sgv-oauth-pending';
const SGV_OAUTH_PENDING_MAX_AGE = 10 * 60 * 1000;

class PendingOAuthLogin extends AutoEncoder {
    @field({ decoder: StringDecoder })
    state = '';

    @field({ decoder: StringDecoder })
    redirectUri = '';

    @field({ decoder: IntegerDecoder })
    createdAt = 0;
}

function randomState(): string {
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join(
        '',
    );
}

interface Token {
    accessToken: string;
    refreshToken: string;
    validUntil: Date;
}

type OAuthCallbackParams = {
    code?: string | null;
    state?: string | null;
};

export class SGVOAuth {
    constructor(
        public token: Token,
        public redirectUri: string,
    ) {}

    static async fromParams(params?: OAuthCallbackParams): Promise<SGVOAuth | null> {
        if (!params?.code || !params.state) {
            return null;
        }

        try {
            const pending = await SGVOAuth.getPendingLogin();
            if (!pending) {
                console.log('Not pending');
                throw SGVOAuth.invalidStateError();
            }

            if (Date.now() - pending.createdAt > SGV_OAUTH_PENDING_MAX_AGE) {
                console.log('Expired');

                throw SGVOAuth.invalidStateError();
            }

            if (pending.state !== params.state) {
                console.log('State invalid');

                throw SGVOAuth.invalidStateError();
            }

            const token = await SGVOAuth.getToken(pending.redirectUri, params.code);
            return new SGVOAuth(token, pending.redirectUri);
        } finally {
            await SGVOAuth.clearPendingLogin();
            SGVOAuth.cleanCallbackUrl();
        }
    }

    /** Starts the SGV OAuth flow and stores enough state to validate the callback and resume the current page. */
    static async login(): Promise<never> {
        const redirectUri = window.location.href;

        const state = randomState();
        await SGVOAuth.setPendingLogin(PendingOAuthLogin.create({
            state,
            redirectUri,
            createdAt: Date.now(),
        }));

        // don't use loginBase here!!
        const url = new URL(`https://login.scoutsengidsenvlaanderen.be${SGV_LOGIN_AUTHORIZE_PATH}`);
        url.searchParams.set('client_id', this.clientId);
        url.searchParams.set('redirect_uri', redirectUri);
        url.searchParams.set('state', state);
        url.searchParams.set('response_mode', 'query');
        url.searchParams.set('response_type', 'code');
        url.searchParams.set('scope', 'openid');

        window.location.href = url.href;
        // TODO Other way?
        throw new Error('redirected');
    }

    get hasToken() {
        return !!this.token;
    }

    get isTokenValid(): boolean {
        return this.token.validUntil > new Date();
    }

    static async getToken(redirectUri: string, code: string): Promise<Token> {
        const response: RequestResult<SGVTokenResponse> = await this.loginServer.request({
            method: 'POST',
            path: SGV_LOGIN_TOKEN_PATH,
            body: {
                client_id: this.clientId,
                code,
                grant_type: 'authorization_code',
                redirect_uri: redirectUri,
            },
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Accept': 'application/json',
            },
        });

        return {
            accessToken: response.data.access_token,
            refreshToken: response.data.refresh_token,
            validUntil: new Date(
                Date.now() + response.data.expires_in * 1000 - 10 * 1000,
            ),
        };
    }

    /** Refreshes the SGV access token before authenticated requests and converts auth failures to a user-facing logout error. */
    async refreshToken({ force }: { force: boolean } = { force: false }): Promise<void> {
        if (!this.token) {
            throw new SimpleError({
                code: 'sgv_logged_out',
                message: 'SGV token missing',
                human: $t(
                    'Je bent uitgelogd bij de groepsadministratie. Log opnieuw in en probeer opnieuw.',
                ),
            });
        }

        if (this.isTokenValid && !force) {
            return;
        }

        try {
            const response: RequestResult<any> = await SGVOAuth.loginServer.request(
                {
                    method: 'POST',
                    path: SGV_LOGIN_TOKEN_PATH,
                    body: {
                        client_id: SGVOAuth.clientId,
                        refresh_token: this.token.refreshToken,
                        grant_type: 'refresh_token',
                        // TODO Do we need a redirect URI?
                        redirect_uri: this.redirectUri,
                    },
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                        'Accept': 'application/json',
                    },
                },
            );

            this.token = {
                accessToken: response.data.access_token,
                refreshToken: response.data.refresh_token,
                validUntil: new Date(
                    Date.now() + response.data.expires_in * 1000 - 10 * 1000,
                ),
            };
        } catch (error) {
            console.error('Failed to refresh SGV token', error);
            throw new SimpleError({
                code: 'sgv_refresh_failed',
                message: 'SGV token refresh failed',
                human: $t(
                    'Je bent uitgelogd bij de groepsadministratie. Log opnieuw in en probeer opnieuw.',
                ),
            });
        }
    }

    static get loginServer(): Server {
        return new Server(this.loginBase);
    }

    static get loginBase(): string {
        return STAMHOOFD.domains.sgvLoginUrl as string;
    }

    static get clientId() {
        return 'groep-O2209G-Prins-Boudewijn-Wetteren';
    }

    private static async getPendingLogin(): Promise<PendingOAuthLogin | null> {
        const raw = await Storage.keyValue.getItem(SGV_OAUTH_PENDING_STORAGE_KEY);
        if (!raw) {
            return null;
        }

        try {
            return new ObjectData(JSON.parse(raw), { version: 0 }).decode(PendingOAuthLogin);
        } catch (error) {
            return null;
        }
    }

    private static async setPendingLogin(value: PendingOAuthLogin): Promise<void> {
        await Storage.keyValue.setItem(SGV_OAUTH_PENDING_STORAGE_KEY, JSON.stringify(encodeObject(value, { version: 0 })));
    }

    private static async clearPendingLogin(): Promise<void> {
        await Storage.keyValue.removeItem(SGV_OAUTH_PENDING_STORAGE_KEY);
    }

    private static cleanCallbackUrl() {
        const url = new URL(window.location.href);
        url.searchParams.delete('code');
        url.searchParams.delete('state');
        url.searchParams.delete('error');
        url.searchParams.delete('error_description');
        window.history.replaceState(window.history.state, '', url.toString());
    }

    private static invalidStateError() {
        return new SimpleError({
            code: 'sgv_oauth_state_invalid',
            message: 'SGV OAuth state invalid',
            human: $t('%1V1'),
        });
    }
}
