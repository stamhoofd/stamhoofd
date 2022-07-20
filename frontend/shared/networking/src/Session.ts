import { Decoder, ObjectData, VersionBox, VersionBoxDecoder } from '@simonbackx/simple-encoding'
import { SimpleErrors } from '@simonbackx/simple-errors'
import { Request, RequestMiddleware } from '@simonbackx/simple-networking'
import { GlobalEventBus } from '@stamhoofd/components'
import { KeychainedResponseDecoder, MyUser, Organization, Token, Version } from '@stamhoofd/structures'
import { Vue } from "vue-property-decorator"

import { AppManager } from '..'
import { Keychain } from './Keychain'
import { ManagedToken } from './ManagedToken'
import { NetworkManager } from './NetworkManager'
import { Storage } from './Storage'

type AuthenticationStateListener = (changed: "userPrivateKey" | "user" | "organization" | "token") => void

export class Session implements RequestMiddleware {
    organizationId: string;
    organization: Organization | null = null
    user: MyUser | null = null

    /** 
     * Manually mark the session as incomplete by setting this to true
    */
    preventComplete = false

    protected token: ManagedToken | null = null

    // Stored: encryption key to obtain the private keys (valid token needed in order to have any meaning => revokable in case of leakage, lost device, theft)
    // Storage is required since otherwise you would have to enter your password again every time you reload the page
    // protected authEncryptionKey: string | null = null

    // We can store the private key in the browser, because on password change it will get changed
    // protected userPrivateKey: string | null = null // Used to decrypt messages for this user

    protected listeners: Map<any, AuthenticationStateListener> = new Map()

    constructor(organizationId: string) {
        this.organizationId = organizationId
    }

    async loadFromStorage() {
        // Check localstorage
        try {
            const json = await Storage.secure.getItem('token-' + this.organizationId)
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

            if (this.token) {
                // Also check if we have the user (optional)
                const json = await Storage.secure.getItem('user-' + this.organizationId)
                if (json) {
                    try {
                        const parsed = JSON.parse(json)
                        this.user = new ObjectData(parsed, { version: 0 }).decode(new VersionBoxDecoder(MyUser as Decoder<MyUser>) as Decoder<VersionBox<MyUser>>).data
                    } catch (e) {
                        console.error(e)
                    }
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
                void Storage.secure.setItem('token-' + this.organizationId, JSON.stringify(this.token.token.encode({ version: Version })))
                
                // Delete old deprecated stored keys
                void Storage.secure.removeItem('key-' + this.organizationId)

                if (this.user) {
                    void Storage.secure.setItem('user-' + this.organizationId, JSON.stringify(new VersionBox(this.user).encode({ version: Version })))
                } else {
                    void Storage.secure.removeItem('user-' + this.organizationId)
                }
            } else {
                void Storage.secure.removeItem('token-' + this.organizationId)

                // Deprecated: but best to delete it for now
                void Storage.secure.removeItem('key-' + this.organizationId)

                void Storage.secure.removeItem('user-' + this.organizationId)
            }
        } catch (e) {
            console.error("Storage error when saving session")
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

    callListeners(changed: "user" | "organization" | "token") {
        for (const listener of this.listeners.values()) {
            listener(changed)
        }
    }

    hasToken(): boolean {
        return !!this.token
    }

    canGetCompleted(): boolean {
        return !!this.token
    }

    isComplete(): boolean {
        return !!this.token && !!this.user && !!this.organization && !this.preventComplete
    }

    /**
     * Doing authenticated requests
     */
    get server() {
        const server = NetworkManager.server

        if (AppManager.shared.isNative && this.organizationId === "34541097-44dd-4c68-885e-de4f42abae4c") {
            // Use demo server for app reviews
            server.host = "https://" + this.organizationId + "." + STAMHOOFD.domains.demoApi;
            return server
        }
        
        server.host = "https://" + this.organizationId + "." + STAMHOOFD.domains.api;
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
        this.callListeners("token")
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
    }

    async fetchUser(shouldRetry = true): Promise<MyUser> {
        console.log("Fetching session user...")
        const response = await this.authenticatedServer.request({
            method: "GET",
            path: "/user",
            decoder: MyUser as Decoder<MyUser>,
            shouldRetry
        })
        if (this.user) {
            this.user.set(response.data)
        } else {
            this.user = response.data
        }
        await this.checkUserInvites(this.user)
        this.callListeners("user")
        return response.data
    }

    async checkUserInvites(user: MyUser) {
        if (user.incomingInvites.length > 0) {
            for (const invite of user.incomingInvites) {
                // Remove invite if succeeded
                await this.authenticatedServer.request({
                    method: "POST",
                    path: "/invite/"+encodeURIComponent(invite.key)+"/trade"
                })
            }

            // Send a global event that the available encryption keys have changed
            // So we can reload some views if needed / possible
            GlobalEventBus.sendEvent("encryption", null).catch(console.error)
        }
    }

    /**
     * Set the organization, including the reference
     */
    setOrganization(organization: Organization) {
        Vue.set(this, "organization", organization)
    }

    /**
     * Set the organization, but keep the same reference and update
     * other references (like groups) correctly to keep the app reactive
     */
    updateOrganization(organization: Organization) {
        if (!this.organization) {
            this.organization = organization
        } else {
            const oldGroups = this.organization.groups
            const oldWebshopPreviews = this.organization.webshops

            this.organization.set(organization)

            for (const group of oldGroups) {
                const newGroupIndex = this.organization.groups.findIndex(g => g.id === group.id)
                if (newGroupIndex != -1) {
                    const newGroup = this.organization.groups[newGroupIndex]
                    
                    // Update old group, so we can keep the same
                    // group reference, in instead of a new one
                    group.set(newGroup)
                    this.organization.groups[newGroupIndex] = group
                }
            }

            for (const preview of oldWebshopPreviews) {
                const newWebshopIndex = this.organization.webshops.findIndex(w => w.id === preview.id)
                if (newWebshopIndex != -1) {
                    const newWebshop = this.organization.webshops[newWebshopIndex]
                    
                    // Update old group, so we can keep the same
                    // group reference, in instead of a new one
                    preview.set(newWebshop)
                    this.organization.webshops[newWebshopIndex] = preview
                }
            }
        }
    }

    async fetchOrganization(shouldRetry = true): Promise<Organization> {
        console.log("Fetching session organization...")

        const response = await (this.hasToken() ? this.authenticatedServer : this.server).request({
            method: "GET",
            path: "/organization",
            decoder: new KeychainedResponseDecoder(Organization as Decoder<Organization>),
            shouldRetry
        })

        this.updateOrganization(response.data.data)
        Keychain.addItems(response.data.keychainItems)
       
        this.callListeners("organization")
        return this.organization!
    }

    /**
     * 
     * @param force Always fetch new information, even when it is available
     * @param shouldRetry Keep retrying on network or server issues
     * @param background If we don't need to update the data right away, initiate a forced background update
     */
    async updateData(force = false, shouldRetry = true, background = false) {
        if (force) {
            console.log("Session force update data")
        } else {
            console.log("Session update data")
        }
        try {
            let fetched = 0
            if (force || !this.user) {
                fetched++
                await this.fetchUser(shouldRetry)
            }

            if (force || !this.organization || fetched == 1) { //  || (this.user.permissions && !Keychain.hasItem(this.organization.publicKey))
                fetched++
                await this.fetchOrganization(shouldRetry)
            }

            if (fetched < 2 && background) {
                // Initiate a slow background update without retry
                // = we don't need to block the UI for this ;)
                this.updateData(true, false, false).catch(e => {
                    // Ignore network errors
                    console.error(e)
                })
            }
        } catch (e) {
            if (!Request.isNetworkError(e)) {
                this.temporaryLogout()
            }
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
            this.callListeners("token")
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
            //LoginHelper.clearAwaitingKeys()
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
            await this.token.refresh(this.server, () => request.shouldRetry)
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
                await this.token.refresh(this.server, () => request.shouldRetry)
                console.log("Retrying request...")
            } catch (e) {
                if (Request.isNetworkError(e)) {
                    this.temporaryLogout()
                } else {
                    this.logout();
                }
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