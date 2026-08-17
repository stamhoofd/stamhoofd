import { DecodedRequest, Request } from '@simonbackx/simple-endpoints';
import { isSimpleError, SimpleError } from '@simonbackx/simple-errors';
import { I18n } from '@stamhoofd/backend-i18n';
import { MFAToken, Organization, Platform, RateLimiter, Token, User } from '@stamhoofd/models';
import { AsyncLocalStorage } from 'async_hooks';

import type { Decoder } from '@simonbackx/simple-encoding';
import { AutoEncoder, field, StringDecoder } from '@simonbackx/simple-encoding';
import { ApiUserRateLimits } from '@stamhoofd/structures';
import { AdminPermissionChecker } from './AdminPermissionChecker.js';
import { TwoFactorHelper } from './TwoFactorHelper.js';

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

export class ContextInstance {
    request: Request;
    queries: { query: string; time?: number }[] = [];
    timers: Map<string, number> = new Map();

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
        } catch (e) {
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
        return await this.setOptionalOrganizationScope(options);
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

    async setManualOrganizationScope(organization: Organization) {
        this.organization = organization;
        this.i18n.switchToLocale({ country: organization.address.country });
        return organization;
    }

    async optionalAuthenticate({ allowWithoutAccount = false }: { allowWithoutAccount?: boolean } = {}): Promise<{ user?: User }> {
        try {
            return await this.authenticate({ allowWithoutAccount });
        } catch (e) {
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

    /**
     * Identify the caller from the Authorization header without ever throwing: returns
     * null when the request is unauthenticated or carries an invalid/expired token.
     * Use this to give an already signed in user a smoother experience, never to grant
     * access (there is no error to react to).
     */
    async optionalAuthenticatedUser(): Promise<User | null> {
        try {
            const { user } = await this.authenticate({ allowWithoutAccount: true });
            return user;
        } catch (e) {
            return null;
        }
    }

    async authenticate(options: { allowMFASetupToken: true; allowWithoutAccount?: boolean; allowUnscoped?: boolean }): Promise<{ user: User; token: Token } | { user: User; setupToken: MFAToken }>;
    async authenticate(options?: { allowMFASetupToken?: false | undefined; allowWithoutAccount?: boolean; allowUnscoped?: boolean }): Promise<{ user: User; token: Token }>;
    async authenticate({ allowWithoutAccount = false, allowUnscoped = false, allowMFASetupToken = false }: { allowMFASetupToken?: boolean; allowWithoutAccount?: boolean; allowUnscoped?: boolean } = {}): Promise<{ user: User; token: Token } | { user: User; setupToken: MFAToken }> {
        const header = this.request.headers.authorization;

        if (!header) {
            throw new SimpleError({
                code: 'not_authenticated',
                message: 'Missing required authorization header',
                statusCode: 401,
            });
        }

        if (!header.startsWith('Bearer ')) {
            if (allowMFASetupToken) {
                const result = await this.authenticateMFASetup();
                if (result) {
                    return result;
                }
            }
            throw new SimpleError({
                code: 'not_supported_authentication',
                message: 'Authentication method not supported. Please authenticate with OAuth2',
                statusCode: 401,
            });
        }

        const accessToken = header.substring('Bearer '.length);

        const token = await Token.getByAccessToken(accessToken, true);

        if (!token || (this.organization && token.user.organizationId !== null && token.user.organizationId !== this.organization.id) || (!this.organization && token.user.organizationId && (!allowUnscoped || !token.user.isApiUser))) {
            if (token?.user) {
                console.log(
                    'Failed auth: ' + token?.user.email + ' (' + token?.user.id + ')',
                );
            }
            throw new SimpleError({
                code: 'invalid_access_token',
                message: 'The access token is invalid',
                human: $t(`%Fi`),
                statusCode: 401,
            });
        }

        if (!this.organization && token.user.organizationId && allowUnscoped) {
            // Automatically scope full request to the user's scope
            await this.setManualOrganizationScope(await Organization.getByID(token.user.organizationId, true));
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
                human: $t(`%Fi`),
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
                human: $t(`%Fj`),
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
        await this.insecurelyAuthenticateAs(user);

        return { user, token };
    }

    /**
     * Like authenticate(), but additionally requires the access token to be "fresh"
     * (minted by a real authentication within the FRESH_WINDOW, not via a refresh).
     * Used to gate sensitive actions such as managing 2FA methods.
     */
    async authenticateFresh(options: { allowWithoutAccount?: boolean; allowUnscoped?: boolean } = {}): Promise<{ user: User; token: Token }> {
        const result = await this.authenticate(options);
        if (!result.token.isFresh()) {
            throw new SimpleError({
                code: 'require_fresh_auth',
                message: 'A recent authentication is required for this action',
                human: $t('%Zgs'),
                statusCode: 403,
            });
        }
        return result;
    }

    /**
     * Authorize a 2FA enrollment/management action. Accepts either a fresh full session
     * (Bearer access token) or a setup token (Authorization: MFASetup <token>) issued
     * during forced enrollment, before a session exists.
     */
    async authenticateMFASetup(): Promise<{ user: User; setupToken: MFAToken } | null> {
        const header = this.request.headers.authorization;
        if (header && header.startsWith('MFASetup ')) {
            const raw = header.substring('MFASetup '.length);
            const setupToken = await MFAToken.getValid(raw, 'setup');
            if (!setupToken) {
                throw new SimpleError({
                    code: 'mfa_setup_expired',
                    message: 'The MFA setup session is invalid or expired',
                    human: $t('%ZhJ'),
                    statusCode: 401,
                });
            }
            const user = await User.getByID(setupToken.userId);
            if (!user) {
                throw new SimpleError({
                    code: 'mfa_setup_expired',
                    message: 'The MFA setup session is invalid or expired',
                    human: $t('%ZhJ'),
                    statusCode: 401,
                });
            }

            // A setup token is issued on the strength of a password alone, to bootstrap a
            // *first* factor. If the user enrolled one in the meantime (e.g. from another
            // device), it must stop being worth a session: otherwise someone who only
            // knows the password keeps a 15 minute window in which they can enroll a
            // factor of their own and sign in, even though the account is now protected.
            if (await TwoFactorHelper.userHasFactors(user.id)) {
                await setupToken.consume();
                throw new SimpleError({
                    code: 'mfa_setup_expired',
                    message: 'The MFA setup session is no longer valid: the user already has a second factor',
                    human: $t('%ZhJ'),
                    statusCode: 401,
                });
            }

            this.user = user;
            await this.insecurelyAuthenticateAs(user);
            return { user, setupToken };
        }

        return null;
    }

    /**
     * Authorize a 2FA enrollment/management action. Accepts either a fresh full session
     * (Bearer access token) or a setup token (Authorization: MFASetup <token>) issued
     * during forced enrollment, before a session exists.
     *
     * Exactly one of `setupToken` / `token` is set: `token` is the session the request was
     * made with, which enrollment keeps alive while signing out the user's other sessions.
     */
    async authenticateMFAEnrollment(): Promise<{ user: User; setupToken: MFAToken | null; token: Token | null }> {
        const mfa = await this.authenticateMFASetup();
        if (mfa) {
            return { ...mfa, token: null };
        }

        const { user, token } = await this.authenticateFresh();
        return { user, setupToken: null, token };
    }

    async insecurelyAuthenticateAs(user: User) {
        this.#auth = new AdminPermissionChecker(user, await Platform.getSharedPrivateStruct(), this.organization);

        if (this.organization && !this.organization.active) {
            // For inactive organizations, you always need permissions to view them
            if (!Context.auth.hasSomePlatformAccess() || !await Context.auth.hasFullAccess(this.organization.id)) {
                throw new SimpleError({
                    code: 'archived',
                    message: 'Platform access is required to view inactive organizations',
                    human: $t('%1GR'),
                    statusCode: 401,
                });
            }
        }
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
