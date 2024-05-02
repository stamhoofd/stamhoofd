import { AutoEncoderPatchType, Decoder, ObjectData } from '@simonbackx/simple-encoding'
import { SimpleErrors } from '@simonbackx/simple-errors'
import { Request, RequestMiddleware } from '@simonbackx/simple-networking'
import { ManagedToken } from '@stamhoofd/networking'
import { NetworkManager } from '@stamhoofd/networking'
import { Admin, EditAdmin, Token, Version } from '@stamhoofd/structures'

type AuthenticationStateListener = () => void

export class AdminSession implements RequestMiddleware {
    user: Admin | null = null

    preventComplete = false

    protected token: ManagedToken | null = null

    // Not stored:
    protected listeners: Map<any, AuthenticationStateListener> = new Map()

    static shared = new AdminSession()

    constructor() {
        this.loadFromStorage()
    }

    loadFromStorage() {
        // Check localstorage
        try {
            const json = localStorage.getItem('admin-token')
            if (json) {
                try {
                    const parsed = JSON.parse(json)
                    this.token = new ManagedToken(Token.decode(new ObjectData(parsed, { version: Version })), () => {
                        this.onTokenChanged()
                    })
                } catch (e) {
                    console.error(e)
                }
            }
        } catch (e) {
            console.error("Localstorage error")
            console.error(e)
        }
    }

    saveToStorage() {
        try {
            // Save token to localStorage
            if (this.token) {
                localStorage.setItem('admin-token', JSON.stringify(this.token.token.encode({ version: Version })))
            } else {
                localStorage.removeItem('admin-token')
            }
        } catch (e) {
            console.error("Localstorage error when saving session")
            console.error(e)
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

    canGetCompleted(): boolean {
        return !!this.token
    }

    isComplete(): boolean {
        return !!this.token && !!this.user
    }

    /**
     * Doing authenticated requests
     */
    get server() {
        const server = NetworkManager.server
        server.host = "https://" + STAMHOOFD.domains.adminApi;
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

    setToken(token: Token) {
        if (this.token) {
            // Disable listener before clearing the token
            this.token.onChange = () => {
                // emtpy
            }
        }
        this.token = new ManagedToken(token, () => {
            this.onTokenChanged()
        });
        this.onTokenChanged()
    }

    async fetchUser(): Promise<Admin> {
        console.log("Fetching session user...")
        const response = await this.authenticatedServer.request({
            method: "GET",
            path: "/user",
            decoder: Admin as Decoder<Admin>
        })
        this.user = response.data
        this.callListeners()
        return response.data
    }

    async patchUser(patch: AutoEncoderPatchType<EditAdmin>): Promise<void> {
        // Do netwowrk request to create organization
        const response = await this.authenticatedServer.request({
            method: "PATCH",
            path: "/user",
            body: patch,
            decoder: Admin as Decoder<Admin>,
            shouldRetry: false
        })

        this.user?.set(response.data)
    }

    async changePassword(password: string): Promise<void> {
        await this.patchUser(EditAdmin.patch({password}))
    }
   
    async updateData(force = false) {
        console.log("Session update data")
        try {
            if (force || !this.user) {
                await this.fetchUser()
            }

        } catch (e) {
            this.temporaryLogout()
            throw e;
        }
    }

    // Logout without clearing this token
    temporaryLogout() {
        // We do not call ontoken changed -> prevent saving!!!!
        // Might still be able to login after a reload (because the error was caused by data errors)
        if (this.token) {
            this.token.onChange = () => {
                // emtpy
            }
            this.token = null;
            this.callListeners()
        }
    }

    logout() {
        if (this.token) {
            this.token.onChange = () => {
                // emtpy
            }
            this.token = null;
            this.user = null; // force refetch in the future
            this.onTokenChanged();
        }
    }

    // -- Implementation for requestMiddleware ----

    async onBeforeRequest(request: Request<any>): Promise<void> {
        // Load updated token from storage (updated in different tab)
        this.loadFromStorage()

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

    async shouldRetryError(request: Request<any>, response: XMLHttpRequest, error: SimpleErrors): Promise<boolean> {
        if (!this.token) {
            // Euhm? The user is not signed in!
            return false;
        }

        if (response.status != 401) {
            return false;
        }

        if (error.hasCode("expired_access_token")) {
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