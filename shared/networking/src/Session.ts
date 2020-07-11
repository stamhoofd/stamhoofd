import { ObjectData } from '@simonbackx/simple-encoding'
import { SimpleErrors } from '@simonbackx/simple-errors'
import { Request,RequestMiddleware } from '@simonbackx/simple-networking'
import { NewUser,Organization, Token, User, Version } from '@stamhoofd/structures'

import { ManagedToken } from './ManagedToken'
import { NetworkManager } from './NetworkManager'

type AuthenticationStateListener = () => void

export class Session implements RequestMiddleware  {
    organization: Organization
    user: NewUser | null = null

    protected token: ManagedToken | null = null

    // Stored: encryption key to obtain the private keys (valid token needed in order to have any meaning => revokable in case of leakage, lost device, theft)
    protected authEncryptionKey: string | null = null

    // Not stored:
    protected userPrivateKey: string | null = null // Used to decrypt messages for this user

    // Not stored:
    protected organizationPrivateKey: string | null = null // Used to decrypt messages for this organization (only for admins)
    protected listeners: Map<any, AuthenticationStateListener> = new Map()

    constructor(organization: Organization) {
        this.organization = organization
        
        // todo: search for the token and keys
        this.loadFromStorage()
    }

    loadFromStorage() {
        // Check localstorage
        const json = localStorage.getItem('token-'+this.organization.id)
        if (json) {
            try {
                const parsed = JSON.parse(json)
                this.token = new ManagedToken(Token.decode(new ObjectData(parsed, { version: Version })), () => {
                    this.onTokenChanged()
                })

                const key = localStorage.getItem('key-' + this.organization.id)
                if (key) {
                    this.authEncryptionKey = key

                    console.log('Successfully loaded token from storage')
                } else {
                    // Sign out
                    this.token = null
                }
            } catch (e) {
                console.error(e)
            }
        }
    }

    saveToStorage() {
        // Save token to localStorage
        if (this.token && this.authEncryptionKey) {
            localStorage.setItem('token-'+this.organization.id, JSON.stringify(this.token.token.encode({ version: Version })))
            localStorage.setItem('key-' + this.organization.id, this.authEncryptionKey)
        } else {
            localStorage.removeItem('token-' + this.organization.id)
            localStorage.removeItem('key-' + this.organization.id)
        }
        console.log('Saved token to storage')
    }

    addListener(owner: any, listener: AuthenticationStateListener) {
        this.listeners.set(owner, listener)
    }

    removeListener(owner: any) {
        this.listeners.delete(owner)
    }

    protected callListeners() {
        for (const listener of this.listeners.values()) {
            listener()
        }
    }

    hasToken(): boolean {
        return !!this.token
    }

    /**
     * Doing authenticated requests
     */
    get server() {
        const server = NetworkManager.server

        if (process.env.NODE_ENV == "production") {
            server.host = "https://" + this.organization.id + ".api.stamhoofd.be"
        } else {
            server.host = "http://" + this.organization.id + ".api.stamhoofd.local"
        }

        return server
    }

    /**
     * Doing authenticated requests
     */
    get authenticatedServer() {
        if (!this.hasToken()) {
            throw new Error("Could not get authenticated server without token")
        }
        const server = this.server
        server.middlewares.push(this)
        return server
    }

    protected onTokenChanged() {
        this.saveToStorage()
        this.callListeners()
    }

    login(token: Token, user: NewUser | null = null, authEncryptionKey: string | null = null, userPrivateKey: string | null = null, organizationPrivateKey: string | null = null) {
        if (this.token) {
            this.token.onChange = () => {
                // emtpy
            }
        }

        this.token = new ManagedToken(token, () => {
            this.onTokenChanged()
        });
        this.user = user
        this.authEncryptionKey = authEncryptionKey
        this.userPrivateKey = userPrivateKey
        this.organizationPrivateKey = organizationPrivateKey
        this.onTokenChanged();
    }

    logout() {
        if (this.token) {
            this.token.onChange = () => {
                // emtpy
            }
            this.token = null;
            this.onTokenChanged();
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

        request.headers["Authorization"] = "Bearer " + this.token.token.accessToken;
    }

    async shouldRetryError(request: Request<any>, response: Response, error: SimpleErrors): Promise<boolean> {
        if (!this.token) {
            // Euhm? The user is not signed in!
            return false;
        }

        if (response.status != 401) {
            return false;
        }

        if (error.containsCode("expired_access_token")) {
            if (request.headers.Authorization != "Bearer " + this.token.token.accessToken) {
                console.log("This request started with an old token that might not be valid anymore. Retry with new token before doing a refresh")
                return true
            }

            // Try to refresh
            try {
                console.log("Request failed due to expired access token, refreshing...")
                await this.token.refresh(this.server)
                console.log("Retrying request...")
            } catch (e) {
                this.logout();
                return false;
            }
            return true
        } else {
            if (request.headers.Authorization != "Bearer " + this.token.token.accessToken) {
                console.log("This request started with an old token that might not be valid anymore. Retry with new token")
                return true
            } else {
                console.log("logout by " + request.headers.Authorization)
                this.logout();
            }
        }

        return false
    }
}