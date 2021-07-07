import { ArrayDecoder, Decoder, ObjectData, VersionBox, VersionBoxDecoder } from '@simonbackx/simple-encoding'
import { SimpleErrors } from '@simonbackx/simple-errors'
import { Request, RequestMiddleware } from '@simonbackx/simple-networking'
import { GlobalEventBus, Toast } from '@stamhoofd/components'
import { Sodium } from '@stamhoofd/crypto'
import { InviteKeychainItem, KeychainedResponseDecoder, KeychainItem, MyUser, Organization, Token, Version } from '@stamhoofd/structures'
import { Vue } from "vue-property-decorator";

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
    protected authEncryptionKey: string | null = null

    // We can store the private key in the browser, because on password change it will get changed
    protected userPrivateKey: string | null = null // Used to decrypt messages for this user

    protected listeners: Map<any, AuthenticationStateListener> = new Map()

    constructor(organizationId: string) {
        this.organizationId = organizationId
    }

    /**
     * Add a (previously encrypted) blob of keychain items to this session / user and store it (encrypted) on the server and in memory
     */
    async addToKeychain(decryptedKeychainItems: string) {
        // unbox
        const keychainItems = new ObjectData(JSON.parse(decryptedKeychainItems), { version: Version }).decode(new VersionBoxDecoder(new ArrayDecoder(InviteKeychainItem as Decoder<InviteKeychainItem>))).data

        // Add the keys to the keychain (if not already present)
        const encryptedItems: KeychainItem[] = []
        for (const item of keychainItems) {
            const encryptedItem = await this.createKeychainItem(item)
            encryptedItems.push(encryptedItem)
        }

        if (encryptedItems.length > 0) {
            const response = await this.authenticatedServer.request({
                method: "POST",
                path: "/keychain",
                body: encryptedItems
            })
        }
    }

    async decryptKeychainItem(item: KeychainItem): Promise<{ publicKey: string; privateKey: string }> {
        // todo: if no keys load them
        if (!this.userPrivateKey) {
            throw new Error("User private key not found!")
        }

        if (!this.user) {
            throw new Error("User not found!")
        }

        const privateKey = await Sodium.unsealMessageAuthenticated(item.encryptedPrivateKey, this.user.publicKey, this.userPrivateKey)

        return {
            publicKey: item.publicKey,
            privateKey
        }
    }

    /**
     * Create a keychain item for a public/private key set
     */
    async createKeychainItem(keyPair: { publicKey: string; privateKey: string }): Promise<KeychainItem> {
        // todo: if no keys load them
        if (!this.userPrivateKey) {
            throw new Error("User private key not found!")
        }

        if (!this.user) {
            throw new Error("User not found!")
        }

        const item = KeychainItem.create({
            publicKey: keyPair.publicKey,
            encryptedPrivateKey: await Sodium.sealMessageAuthenticated(keyPair.privateKey, this.user.publicKey, this.userPrivateKey)
        })

        Keychain.addItem(item)
        return item
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

                    const key = await Storage.secure.getItem('key-' + this.organizationId)
                    if (key) {
                        this.authEncryptionKey = key
                        // console.log('Successfully loaded token from storage')
                    } else {
                        // Sign out
                        this.token = null
                    }
                } catch (e) {
                    console.error(e)
                }
            }

            if (this.token && this.authEncryptionKey) {
                // Also check if we have the user
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
            if (this.token && this.authEncryptionKey) {
                void Storage.secure.setItem('token-' + this.organizationId, JSON.stringify(this.token.token.encode({ version: Version })))
                void Storage.secure.setItem('key-' + this.organizationId, this.authEncryptionKey)

                if (this.user) {
                    void Storage.secure.setItem('user-' + this.organizationId, JSON.stringify(new VersionBox(this.user).encode({ version: Version })))
                } else {
                    void Storage.secure.removeItem('user-' + this.organizationId)
                }
            } else {
                void Storage.secure.removeItem('token-' + this.organizationId)
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

    protected callListeners(changed: "userPrivateKey" | "user" | "organization" | "token") {
        for (const listener of this.listeners.values()) {
            listener(changed)
        }
    }

    hasToken(): boolean {
        return !!this.token
    }

    canGetCompleted(): boolean {
        return !!this.token && !!this.authEncryptionKey
    }

    isComplete(): boolean {
        return !!this.token && !!this.user && !!this.organization && !!this.userPrivateKey && !this.preventComplete
    }

    /**
     * Doing authenticated requests
     */
    get server() {
        const server = NetworkManager.server
        server.host = "https://" + this.organizationId + "." + process.env.HOSTNAME_API;
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

    async setEncryptionKey(authEncryptionKey: string, preload: { user: MyUser; userPrivateKey: string } | null = null) {
        if (!this.token) {
            throw new Error("You can only set the encryption key after setting the token")
        }
        this.authEncryptionKey = authEncryptionKey

        if (preload) {
            this.user = preload.user
            this.userPrivateKey = preload.userPrivateKey
        }

        this.onTokenChanged();

        // Start loading the user and encryption keys
        if (!preload) {
            await this.updateData()
        }
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
        this.saveToStorage()
        this.callListeners("user")
        return response.data
    }

    async checkUserInvites(user: MyUser) {
        if (user.incomingInvites.length > 0) {
            const privateKey = this.getUserPrivateKey()
            const publicKey = user.publicKey

            if (!privateKey) {
                console.warn("Could not trade available invites because private user key is missing")
                return
            }

            for (const invite of user.incomingInvites) {
                try {
                    const decryptedKeychainItems = await Sodium.unsealMessage(invite.keychainItems!, publicKey, privateKey)
                    await this.addToKeychain(decryptedKeychainItems)

                    if (invite.sender.permissions && !user.permissions) {
                        new Toast("We hebben jou toegang gegeven tot bepaalde gegevens van leden", "key green").setHide(15*1000).show()
                    } else {
                        new Toast(invite.sender.firstName+" heeft een encryptiesleutel met jou gedeeld", "key green").setHide(15*1000).show()
                    }
                } catch (e) {
                    console.error(e)
                    if (invite.sender.permissions && !user.permissions) {
                        // Do not show a message
                    } else {
                        new Toast(invite.sender.firstName+" wou een encryptiesleutel met jou delen, maar deze uitnodiging is ongeldig geworden. Vraag om de uitnodiging opnieuw te versturen.", "error red").setHide(15*1000).show()
                    }
                }
                
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

    setOrganization(organization: Organization) {
        Vue.set(this, "organization", organization)
    }

    async fetchOrganization(shouldRetry = true): Promise<Organization> {
        console.log("Fetching session organization...")
        const response = await this.authenticatedServer.request({
            method: "GET",
            path: "/organization",
            decoder: new KeychainedResponseDecoder(Organization as Decoder<Organization>),
            shouldRetry
        })

        if (!this.organization) {
            this.organization = response.data.data
        } else {
            this.organization.set(response.data.data)
        }
        
        Keychain.addItems(response.data.keychainItems)
       
        this.callListeners("organization")
        return this.organization
    }

    /**
     * 
     * @param force Always fetch new information, even when it is available
     * @param shouldRetry Keep retrying on network or server issues
     * @param background If we don't need to update the data right away, initiate a background update
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
            await this.updateKeys()

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

    getUserPrivateKey() {
        return this.userPrivateKey
    }

    getAuthEncryptionKey() {
        return this.authEncryptionKey
    }

    async updateKeys() {
        console.log("Decrypting session keys...")
        if (!this.user) {
            throw new Error("Can't update keys if user is not set")
        }

        if (!this.authEncryptionKey) {
            throw new Error("Can't update keys if authEncryptionKey is not set")
        }
        this.userPrivateKey = await Sodium.decryptMessage(this.user.encryptedPrivateKey, this.authEncryptionKey)
        this.callListeners("userPrivateKey")
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

    clearKeys() {
        this.authEncryptionKey = null;
        this.userPrivateKey = null
        this.callListeners("userPrivateKey")
    }

    logout() {
        if (this.token) {
            this.token.onChange = () => {
                // emtpy
            }
            this.token = null;
            this.clearKeys()
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