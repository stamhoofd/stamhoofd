import { STErrors } from '@stamhoofd-common/errors';
import { Organization } from "@stamhoofd-frontend/models";
import { Request, RequestMiddleware } from '@stamhoofd-frontend/networking';

import { ManagedToken } from "./ManagedToken";
import { User } from './User';

export class Session implements RequestMiddleware {
    /**
     * Stored in localStorage or other location
     */
    organization: Organization;
    user: User

    /**
     * The token is stored in the keychain (only the refresh token)
     */
    token: ManagedToken

    /**
     * keyPair is stored in keychain
     */
    keyPair?: {publicKey: string; privateKey: string};

    constructor(token: ManagedToken, user: User, organization: Organization) {
        this.token = token
        this.user = user;
        this.organization = organization
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

        request.headers["Authorization"] = "Bearer " + this.token.token.accessToken;
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