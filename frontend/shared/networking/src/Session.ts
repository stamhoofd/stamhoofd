import { Decoder, ObjectData, VersionBox, VersionBoxDecoder } from '@simonbackx/simple-encoding'
import { isSimpleError, isSimpleErrors, SimpleErrors } from '@simonbackx/simple-errors'
import { Request, RequestMiddleware } from '@simonbackx/simple-networking'
import { Toast } from '@stamhoofd/components'
import { KeychainedResponseDecoder, LoginProviderType, MyUser, Organization, Token, Version } from '@stamhoofd/structures'
import { Vue } from "vue-property-decorator"

import { AppManager, UrlHelper } from '..'
import { ManagedToken } from './ManagedToken'
import { NetworkManager } from './NetworkManager'
import { Storage } from './Storage'

type AuthenticationStateListener = (changed: "userPrivateKey" | "user" | "organization" | "token") => void

// dec2hex :: Integer -> String
// i.e. 0-255 -> '00'-'ff'
function dec2hex (dec) {
    return dec.toString(16).padStart(2, "0")
}

// generateId :: Integer -> String
function generateId (len) {
    const arr = new Uint8Array((len || 40) / 2)
    window.crypto.getRandomValues(arr)
    return Array.from(arr, dec2hex).join('')
}

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

    async loadTokenFromStorage() {
        // Check localstorage
        try {
            const json = await Storage.secure.getItem('token-' + this.organizationId)
            if (json) {
                try {
                    const parsed = JSON.parse(json)
                    const token = Token.decode(new ObjectData(parsed, { version: Version }))
                    this.setToken(token)
                } catch (e) {
                    console.error(e)
                }
            }
        } catch (e) {
            console.error("Localstorage error")
            console.error(e)
        }
    }

    async loadFromStorage() {
        // Check localstorage
        try {
            await this.loadTokenFromStorage()

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

    removeFromStorage() {
        try {
            void Storage.secure.removeItem('token-' + this.organizationId)
            void Storage.secure.removeItem('user-' + this.organizationId)

            // Deprecated: but best to delete it for now
            void Storage.secure.removeItem('key-' + this.organizationId)
        } catch (e) {
            console.error("Storage error when deleting session")
            console.error(e)
        }
        
        console.log('Deleted token to storage')
    }

    async checkSSO() {
        const search = UrlHelper.initial.getSearchParams();
        const oid_rt = search.get('oid_rt');
        const state = search.get('s');
        const error = search.get('error');
        if (oid_rt && state) {
            // Check valid state
            try {
                const savedState = await Storage.secure.getItem("oid-state")
                if (savedState !== state) {
                    console.warn('SSO state didn\'t match')

                    if (!this.canGetCompleted()) {
                        new Toast('Er is een fout opgetreden bij het inloggen. Probeer het opnieuw.', 'error red').setHide(20000).show()
                    }
                    return
                }
                Storage.secure.removeItem("oid-state").catch(console.error)
            } catch (e) {
                console.error(e);
                
                if (!this.canGetCompleted()) {
                    new Toast('Er is een fout opgetreden bij het inloggen. Probeer het opnieuw.', 'error red').setHide(20000).show()
                }
                return;
            }

            this.setToken(new Token({
                accessToken: '',
                refreshToken: oid_rt,
                accessTokenValidUntil: new Date(0)
            }))
        }

        if (state && error) {
            // Check valid state
            try {
                const savedState = await Storage.secure.getItem("oid-state")
                if (savedState !== state) {
                    console.warn('SSO state didn\'t match')
                    
                    if (!this.canGetCompleted()) {
                        new Toast('Er is een fout opgetreden bij het inloggen. Probeer het opnieuw.', 'error red').setHide(20000).show()
                    }
                    return
                }
                Storage.secure.removeItem("oid-state").catch(console.error)
            } catch (e) {
                console.error(e);
                if (!this.canGetCompleted()) {
                    new Toast('Er is een fout opgetreden bij het inloggen. Probeer het opnieuw.', 'error red').setHide(20000).show()
                }
                return;
            }

            new Toast(error, 'error red').setHide(20000).show()
        } else {
            if (error) {
                // Message not authorized
                new Toast('Er is een fout opgetreden bij het inloggen. Probeer het opnieuw.', 'error red').setHide(20000).show()
            }
        }
    }

    async startSSO(data: {webshopId?: string, prompt?: string, providerType: LoginProviderType}) {
        const spaState = generateId(40)
        try {
            await Storage.secure.setItem("oid-state", spaState)
        } catch (e) {
            console.error("Could not save state in local storage")
            new Toast('Jouw browser ondersteunt geen lokale opslag, wat noodzakelijk is om in te kunnen loggen. Kijk na of je de browser niet in incognito/prive mode gebruikt. Schakel het indien mogelijk uit, of probeer in een andere browser.', 'error red').setHide(20000).show()
            return;
        }

        // Check SSO required?
        // if SSO
        const url = new URL(this.server.host + '/openid/start');
        
        const form = document.createElement('form');
        form.action= url.href;
        form.method = 'POST';

        const spaStateInput = document.createElement('input');
        spaStateInput.type = 'hidden';
        spaStateInput.name = 'spaState';
        spaStateInput.value = spaState;
        form.appendChild(spaStateInput);

        // Include organizationId
        const organizationIdInput = document.createElement('input');
        organizationIdInput.type = 'hidden';
        organizationIdInput.name = 'organizationId';
        organizationIdInput.value = this.organizationId;
        form.appendChild(organizationIdInput);

        // Include webshopId
        if (data.webshopId) {
            const webshopIdInput = document.createElement('input');
            webshopIdInput.type = 'hidden';
            webshopIdInput.name = 'webshopId';
            webshopIdInput.value = data.webshopId;
            form.appendChild(webshopIdInput);
        }

        const redirectUriInput = document.createElement('input');
        redirectUriInput.type = 'hidden';
        redirectUriInput.name = 'redirectUri';
        redirectUriInput.value = window.location.href;
        form.appendChild(redirectUriInput);

        // Include prompt
        if (data.prompt) {
            const promptInput = document.createElement('input');
            promptInput.type = 'hidden';
            promptInput.name = 'prompt';
            promptInput.value = data.prompt;
            form.appendChild(promptInput);
        }

        // Include client = sso
        const clientInput = document.createElement('input');
        clientInput.type = 'hidden';
        clientInput.name = 'provider';
        clientInput.value = data.providerType;
        form.appendChild(clientInput);

        document.body.appendChild(form);
        form.submit();
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
        return !!this.token && !!this.user && !!this.organization && !this.preventComplete && (!this.user.permissions || !!this.organization.privateMeta)
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

    get optionalAuthenticatedServer() {
        if (this.isComplete()) {
            return this.authenticatedServer
        }
        return this.server
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
        this.callListeners("user")
        return response.data
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
            const oldAdmins = this.organization.admins

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

            if (oldAdmins && !this.organization.admins) {
                this.organization.admins = oldAdmins
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
            let fetchedUser = false
            if (force || !this.user) {
                fetchedUser = true
                await this.fetchUser(shouldRetry)
            }

            let fetchedOrganization = false
            if (force || !this.organization || (fetchedUser && this.user?.permissions) || (this.user?.permissions && !this.organization.privateMeta)) { 
                fetchedOrganization = true
                await this.fetchOrganization(shouldRetry)
            }

            if ((!fetchedOrganization) && background) {
                // Initiate a slow background update without retry
                // = we don't need to block the UI for this ;)
                this.updateData(true, false, false).catch(e => {
                    // Ignore network errors
                    console.error(e)
                })
            }
        } catch (e) {
            console.error('Error while updating session data', e)
            throw e;
        }
    }

    // Logout without clearing this token
    temporaryLogout() {
        console.log('temporary logout');

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
        console.log('logout');

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
        // Check if we have an updated token in storage (other browser tab refreshed the token)
        await this.loadTokenFromStorage()

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
                if (isSimpleError(e) || isSimpleErrors(e)) { 
                    if (e.hasCode("invalid_refresh_token")) {
                        console.log("Refresh token is invalid, logout")
                        this.logout();
                        return false;
                    }
                }
                
                // Something went wrong
                this.temporaryLogout()
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