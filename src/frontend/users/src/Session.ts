import { STErrors } from '@stamhoofd-common/errors';
import { Organization } from "@stamhoofd-frontend/models";
import { Request, RequestMiddleware } from '@stamhoofd-frontend/networking';

import { Token } from "./Token";
import { User } from './User';

export class Session implements RequestMiddleware {
    token: Token
    organization: Organization;
    user: User
    keyPair: {publicKey: string; privateKey: string};

    static shared?: Session

    constructor(token: Token, user: User, organization: Organization) {
        this.token = token
        this.user = user;
        this.organization = organization
    }

    setDefault() {
        Session.shared = this
    }

    /**
     * Normal, non authenticated requests
     */
    get server() {
        return this.organization.getServer()
    }

    /**
     * Doing authenticated requests
     */
    get authenticatedServer() {
        const server = this.organization.getServer()
        server.middlewares.push(this)
        return server
    }

    async storeInKeyChain() {
        if (!process.env.IS_ELECTRON) {
            // Store in different place
            return;
        }
        const keytar = await import("keytar")
        await keytar.setPassword("be.stamhoofd.account.token", this.organization.uri+";"+this.user.email, this.token.refreshToken);
    }

    /// Requires network (could get adjusted)
    static async restoreFromKeyChain(organizationUri?: string): Promise<Session | undefined> {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        if (!process.env.IS_ELECTRON) {
            // Store in different place
            return;
        }

        const keytar = await import("keytar")
        const credentials = await keytar.findCredentials("be.stamhoofd.account.token")
        for (const credential of credentials) {
            const split = credential.account.split(";");
            if (split.length != 2) {
                // Invalid one!
                continue;
            }
            const uri = split[0];
            const email = split[1];

            if (organizationUri && uri != organizationUri) {
                continue;
            }

            const token = new Token({
                accessToken: "",
                refreshToken: credentials[0].password,
                accessTokenValidUntil: new Date(Date.now() - 1000)
            });

            const user = new User();
            user.email = email
            const organization = new Organization()
            organization.uri = uri

            const session = new Session(token, user, organization)
            return session
        }
    }

    // -- Implementation for requestMiddleware ----

    async onBeforeRequest(request: Request<any>): Promise<void> {
        if (!this.token) {
            // Euhm? The user is not signed in!
            throw new Error("Could not authenticate request without token")
        }

        if (this.token.isRefreshing() || this.token.needsRefresh()) {
            // Already expired.
            console.log("Request started with expired access token, refreshing before starting request...")
            await this.token.refresh(this.server)
        }

        request.headers["Authorization"] = "Bearer " + this.token.accessToken;
    }

    async shouldRetryError(request: Request<any>, response: Response, error: STErrors): Promise<boolean> {
        if (!this.token) {
            // Euhm? The user is not signed in!
            return false;
        }

        if (response.status != 401) {
            return false;
        }

        if (error[0].code == "expired_access_token") {
            // Try to refresh
            try {
                console.log("Request failed due to expired access token, refreshing...")
                await this.token.refresh(this.server)
                console.log("Retrying request...")
            } catch (e) {
                return false;
            }
            return true
        }

        return false
    }
    
}