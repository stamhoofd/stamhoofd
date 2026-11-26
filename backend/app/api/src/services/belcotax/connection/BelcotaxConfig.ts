import { SimpleError } from '@common/errors';

export type BelcotaxEnvironment = 'local' | 'acceptance' | 'production';

export type BelcotaxEndpoints = {
    issuer: string;
    authorization: string;
    token: string;
    jwks: string;
};

/**
 * From "How to access FPS Finances's APIs using the OIDC flow" (15/04/2026), §4 and §5.1, and the
 * Belcotax API documentation (03/04/2026). FOD only documents the Belcotax API URL of acceptance:
 * the production URL follows the pattern of the other APIs and can be overridden.
 */
const fodEnvironments: Record<
    Exclude<BelcotaxEnvironment, 'local'>,
    { issuer: string; apiUrl: string }
> = {
    acceptance: {
        issuer: 'https://fediamapi-a.minfin.be/sso/oauth2',
        apiUrl: 'https://wsapi-a.minfin.be/Belcotax/Bulk/OAU/v1',
    },
    production: {
        issuer: 'https://fediamapi.minfin.fgov.be/sso/oauth2',
        apiUrl: 'https://wsapi.minfin.fgov.be/Belcotax/Bulk/OAU/v1',
    },
};

/**
 * Registered for our client by FOD (registration email of 6 October 2026)
 */
export const BelcotaxScopes = ['openid', 'profile', 'belcotax-manage-api'];

/**
 * Client of the Keycloak realm `stam` generates (shared/cli/src/services/sso-config.ts)
 */
export const BelcotaxLocalClientId = 'stamhoofd-belcotax';

export const BelcotaxMockApiPath = '/belcotax-mock/Belcotax/Bulk/OAU/v1';

export class BelcotaxConfig {
    private static discovered = new Map<string, Promise<BelcotaxEndpoints>>();

    static get environment(): BelcotaxEnvironment | null {
        const environment = STAMHOOFD.BELCOTAX_ENVIRONMENT ?? null;
        if (environment === 'local' && STAMHOOFD.environment === 'production') {
            return null;
        }
        return environment;
    }

    static get isLocal() {
        return this.environment === 'local';
    }

    static get isConfigured() {
        const environment = this.environment;
        if (!environment) {
            return false;
        }
        if (environment === 'local') {
            return !!STAMHOOFD.BELCOTAX_ISSUER;
        }
        return !!STAMHOOFD.BELCOTAX_CLIENT_ID;
    }

    static get clientId(): string {
        if (STAMHOOFD.BELCOTAX_CLIENT_ID) {
            return STAMHOOFD.BELCOTAX_CLIENT_ID;
        }
        if (this.isLocal) {
            return BelcotaxLocalClientId;
        }
        throw this.notConfiguredError();
    }

    /**
     * FOD documents its endpoints and doesn't promise a discovery document with the same values,
     * so those are fixed. The local Keycloak has its own paths, which come from its discovery.
     */
    static async getEndpoints(): Promise<BelcotaxEndpoints> {
        const environment = this.environment;
        if (!environment || !this.isConfigured) {
            throw this.notConfiguredError();
        }

        if (environment === 'local') {
            const issuer = STAMHOOFD.BELCOTAX_ISSUER!;
            let endpoints = this.discovered.get(issuer);
            if (!endpoints) {
                endpoints = this.discover(issuer).catch((e: unknown) => {
                    this.discovered.delete(issuer);
                    throw new SimpleError({
                        code: 'belcotax_unreachable',
                        message: `Discovery of ${issuer} failed (is \`stam sso start\` running?): ${e instanceof Error ? e.message : String(e)}`,
                        human: $t('FOD Financiën is niet bereikbaar. Probeer het later opnieuw.'),
                        statusCode: 503,
                    });
                });
                this.discovered.set(issuer, endpoints);
            }
            return await endpoints;
        }

        const issuer = STAMHOOFD.BELCOTAX_ISSUER ?? fodEnvironments[environment].issuer;
        return {
            issuer,
            authorization: issuer + '/authorize',
            token: issuer + '/access_token',
            jwks: issuer + '/connect/jwk_uri',
        };
    }

    private static async discover(issuer: string): Promise<BelcotaxEndpoints> {
        const response = await fetch(issuer + '/.well-known/openid-configuration', {
            signal: AbortSignal.timeout(10_000),
        });
        const json = (await response.json()) as Record<string, unknown>;
        const read = (key: string) => {
            if (typeof json[key] !== 'string') {
                throw new Error(`The discovery document of ${issuer} has no ${key}`);
            }
            return json[key];
        };
        return {
            issuer: read('issuer'),
            authorization: read('authorization_endpoint'),
            token: read('token_endpoint'),
            jwks: read('jwks_uri'),
        };
    }

    static clearCache() {
        this.discovered.clear();
    }

    static get apiUrl(): string {
        if (STAMHOOFD.BELCOTAX_API_URL) {
            return STAMHOOFD.BELCOTAX_API_URL;
        }
        const environment = this.environment;
        if (!environment) {
            throw this.notConfiguredError();
        }
        if (environment === 'local') {
            return 'https://' + STAMHOOFD.domains.api + BelcotaxMockApiPath;
        }
        return fodEnvironments[environment].apiUrl;
    }

    /**
     * The mock of the Belcotax API is only registered for the local environment, outside production
     */
    static get servesMockApi() {
        return this.isLocal && STAMHOOFD.environment !== 'production';
    }

    /**
     * Has to be registered at FOD ("Request to update information OIDC Client"), per environment.
     * One fixed URL on the API domain: the authorization code is only valid for 10 seconds, so it is
     * exchanged right here instead of after loading the dashboard.
     */
    static get redirectUri() {
        return 'https://' + STAMHOOFD.domains.api + '/oauth/belcotax';
    }

    /**
     * Has to be registered at FOD together with the redirect URI
     */
    static get ourJwksUri() {
        return 'https://' + STAMHOOFD.domains.api + '/belcotax/jwks';
    }

    static notConfiguredError() {
        return new SimpleError({
            code: 'belcotax_not_configured',
            message: 'The Belcotax API is not configured',
            human: $t('De koppeling met Belcotax is nog niet beschikbaar.'),
            statusCode: 400,
        });
    }
}
