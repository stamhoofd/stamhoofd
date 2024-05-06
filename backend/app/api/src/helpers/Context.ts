import { Request } from "@simonbackx/simple-endpoints";
import { SimpleError } from "@simonbackx/simple-errors";
import { I18n } from "@stamhoofd/backend-i18n";
import { Organization, RateLimiter, Token, User } from "@stamhoofd/models";
import { AsyncLocalStorage } from "async_hooks";

import { AdminPermissionChecker } from "./AdminPermissionChecker";

export const apiUserRateLimiter = new RateLimiter({
    limits: [
        {   
            // Block heavy bursts (5req/s for 5s)
            limit: 25,
            duration: 5 * 1000
        },
        {   
            // max 1req/s during 150s
            limit: 150,
            duration: 150 * 1000
        },
        {   
            // 1000 requests per hour
            limit: 1000,
            duration: 60 * 1000 * 60
        },
        {   
            // 2000 requests per day
            limit: 2000,
            duration: 24 * 60 * 1000 * 60
        }
    ]
});

export class ContextInstance {
    request: Request

    user?: User
    organization?: Organization

    #i18n: I18n|null = null
    #auth: AdminPermissionChecker|null = null

    constructor(request: Request) {
        this.request = request;
    }

    static asyncLocalStorage = new AsyncLocalStorage<ContextInstance>();

    static get current(): ContextInstance {
        const c = this.asyncLocalStorage.getStore();

        if (!c) {
            throw new SimpleError({
                code: 'no_context',
                message: 'No context found',
                statusCode: 500
            })
        }

        return c;
    }

    static async start<T>(request: Request, handler: () => Promise<T>): Promise<T> {
        const context = new ContextInstance(request);

        return await this.asyncLocalStorage.run(context, async () => {
            return await handler()
        });
    }

    get version() {
        return this.request.getVersion()
    }

    get i18n() {
        if (!this.#i18n) {
            this.#i18n = I18n.fromRequest(this.request)
        }
        return this.#i18n
    }

    get auth() {
        if (!this.#auth) {
            throw new SimpleError({
                code: 'internal_error',
                statusCode: 500,
                message: 'AdminPermissionChecker not set in RequestContext: make sure the request is authenticated before using the permissionChecker'
            })
        }
        return this.#auth
    }

    get optionalAuth() {
        return this.#auth
    }

    async setOptionalOrganizationScope() {
        try {
            return await this.setOrganizationScope()
        } catch (e) {
            return null
        }
    }

    /**
     * Require organization scope if userMode is not platform
     */
    async setUserOrganizationScope() {
        if (STAMHOOFD.userMode === 'platform') {
            return null;
        }
        return await this.setOrganizationScope()
    }

    async setOrganizationScope() {
        const organization = await Organization.fromApiHost(this.request.host);

        this.organization = organization
        this.i18n.switchToLocale({ country: organization.address.country })

        return organization
    }

    async optionalAuthenticate({allowWithoutAccount = false}: {allowWithoutAccount?: boolean} = {}): Promise<{user?: User}> {
        const header = this.request.headers.authorization
        if (!header) {
            return {}
        }
        return this.authenticate({allowWithoutAccount})
    }

    async authenticate({allowWithoutAccount = false}: {allowWithoutAccount?: boolean} = {}): Promise<{user: User, token: Token}> {
        const header = this.request.headers.authorization
        if (!header) {
            throw new SimpleError({
                code: "not_authenticated",
                message: "Missing required authorization header",
                statusCode: 401
            })
        }

        if (!header.startsWith("Bearer ")) {
            throw new SimpleError({
                code: "not_supported_authentication",
                message: "Authentication method not supported. Please authenticate with OAuth2",
                statusCode: 401
            })
        }

        const accessToken = header.substring("Bearer ".length);

        const token = await Token.getByAccessToken(accessToken, true)
        
        if (!token || (this.organization && token.user.organizationId !== null && token.user.organizationId !== this.organization.id) || (!this.organization && token.user.organizationId)) {
            throw new SimpleError({
                code: "invalid_access_token",
                message: "The access token is invalid",
                human: "Je bent automatisch uitgelogd, log opnieuw in om verder te gaan",
                statusCode: 401
            })
        }
        
        if (token.isAccessTokenExpired()) {
            throw new SimpleError({
                code: "expired_access_token",
                message: "The access token is expired",
                human: "Je bent automatisch uitgelogd, log opnieuw in om verder te gaan",
                statusCode: 401
            })
        }

        if (!token.user.hasAccount() && !allowWithoutAccount) {
            throw new SimpleError({
                code: "not_activated",
                message: "This user is not yet activated",
                human: "Maak een account aan op dit e-mailadres om een wachtwoord in te stellen voor je inlogt.",
                statusCode: 401
            })
        }

        // Rate limits for api users
        if (token.user.isApiUser) {
            apiUserRateLimiter.track(this.organization?.id ?? token.user.id)
        }

        const user = token.user
        this.user = user
        this.#auth = new AdminPermissionChecker(user, this.organization);

        return {user, token};
    }
}

export const Context = new Proxy(ContextInstance, {
    get(target, prop, receiver) {
        const c = target.current[prop];
        if (c && typeof c == 'function') {
            return c.bind(target.current)
        }
        return c;
    }
}) as unknown as ContextInstance;