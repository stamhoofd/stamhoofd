import * as Sentry from '@sentry/browser';
import { ArrayDecoder, AutoEncoder, AutoEncoderPatchType, Decoder, field, MapDecoder, ObjectData, StringDecoder, VersionBox, VersionBoxDecoder } from '@simonbackx/simple-encoding';
import { isSimpleError, isSimpleErrors, SimpleError } from '@simonbackx/simple-errors';
import { RequestResult } from '@simonbackx/simple-networking';
import { Sodium } from '@stamhoofd/crypto';
import { ChallengeResponseStruct, ChangeOrganizationKeyRequest, CreateOrganization, Invite, InviteKeychainItem,KeychainItem, KeyConstants, NewInvite, NewUser, Organization, OrganizationAdmins, PermissionLevel, Permissions, PollEmailVerificationRequest, PollEmailVerificationResponse, SignupResponse, Token, TradedInvite, User, VerifyEmailRequest, Version } from '@stamhoofd/structures';
import KeyWorker from 'worker-loader!@stamhoofd/workers/KeyWorker.ts'

import { Keychain } from './Keychain';
import { NetworkManager } from './NetworkManager';
import { Session } from './Session';
import { SessionManager } from './SessionManager';

class StoredKeys extends AutoEncoder {
    @field({ decoder: StringDecoder })
    authEncryptionKey: string

    /**
     * In case we don't have a token after validation (validatoin happened on other browser or device)
     */
    @field({ decoder: StringDecoder })
    authSignPrivateKey: string

    @field({ decoder: StringDecoder })
    email: string
}

class StoredInvite extends AutoEncoder {
    @field({ decoder: Invite })
    invite: Invite

    @field({ decoder: StringDecoder })
    secret: string
}

export class LoginHelper {
    /**
     * When email verification is needed (signup, login), we temporary need to
     * store the password in memory + session storage for every token we have to allow a smooth login after validation
     * We use the password to set the encryption key after successful validation
     */
    private static AWAITING_KEYS = new Map<string, StoredKeys>()
    private static STORED_INVITES: StoredInvite[] = []

    static addTemporaryKey(token: string, keys: StoredKeys) {
        this.AWAITING_KEYS.set(token, keys)
        this.saveAwaitingKeys()
    }

    static clearAwaitingKeys() {
        this.AWAITING_KEYS = new Map<string, StoredKeys>()
        localStorage.removeItem("AWAITING_KEYS")
    }

    private static saveAwaitingKeys() {
        // We cannot use sessionStorage, because links in e-mails will start a new session
        localStorage.setItem("AWAITING_KEYS", JSON.stringify(
            Object.fromEntries(
                Array.from(this.AWAITING_KEYS).map(
                    ([str, keys]) => [str, keys.encode({ version: Version })]
                )
            )
        ))
    }

    static deleteTemporaryKey(token: string) {
        this.AWAITING_KEYS.delete(token)
        this.saveAwaitingKeys()
    }

    static getTemporaryKey(token: string): StoredKeys | null {
        const exists = this.AWAITING_KEYS.get(token)
        if (exists) {
            return exists
        }
        const stored = localStorage.getItem("AWAITING_KEYS")
        if (!stored) {
            return null
        }

        try {
            const decoded = JSON.parse(stored)
            const ob = new ObjectData(decoded, { version: Version })
            this.AWAITING_KEYS = ob.decode(new MapDecoder(StringDecoder, StoredKeys as Decoder<StoredKeys>))
            return this.AWAITING_KEYS.get(token) ?? null
        } catch(e) {
            console.error(e)
        }
        return null
    }


    static addStoredInvite(invite: StoredInvite) {
        this.getStoredInvites()
        this.STORED_INVITES.push(invite)
        this.saveStoredInvites()
    }

    static clearStoredInvites() {
        this.STORED_INVITES = []
        localStorage.removeItem("STORED_INVITES")
    }

    private static saveStoredInvites() {
        // We cannot use sessionStorage, because links in e-mails will start a new session
        localStorage.setItem("STORED_INVITES", JSON.stringify(this.STORED_INVITES.map(v => v.encode({ version: Version }))))
    }

    static getStoredInvites(): StoredInvite[] {
        const stored = localStorage.getItem("STORED_INVITES")
        if (!stored) {
            return this.STORED_INVITES
        }

        try {
            const decoded = JSON.parse(stored)
            const ob = new ObjectData(decoded, { version: Version })
            this.STORED_INVITES = ob.decode(new ArrayDecoder(StoredInvite as Decoder<StoredInvite>))
            return this.STORED_INVITES
        } catch(e) {
            console.error(e)
        }
        return []
    }

    static async createSignKeys(password: string, authSignKeyConstants: KeyConstants): Promise<{ publicKey: string; privateKey: string }> {
        return new Promise((resolve, reject) => {
            //const myWorker = new Worker(new URL("@stamhoofd/workers/KeyWorker.ts", import.meta.url))
            const myWorker = new KeyWorker();

            myWorker.onmessage = (e) => {
                const authSignKeys = e.data

                // Requset challenge
                myWorker.terminate()
                resolve(authSignKeys)
            }

            myWorker.onerror = (e) => {
                // todo
                console.error(e);
                myWorker.terminate();
                reject(e);
                Sentry.captureException(e);
            }

            myWorker.postMessage({
                type: "signKeys",
                password,
                authSignKeyConstants: authSignKeyConstants.encode({ version: Version })
            });
        })
    }

    static async createEncryptionKey(password: string, authEncryptionKeyConstants: KeyConstants): Promise<string> {
        return new Promise((resolve, reject) => {
            console.log("starting encryption key worker")
            const myWorker = new KeyWorker();
            //const myWorker = new Worker(new URL("@stamhoofd/workers/KeyWorker.ts", import.meta.url))

            myWorker.onmessage = (e) => {
                const key = e.data

                // Requset challenge
                myWorker.terminate()
                resolve(key)
            }

            myWorker.onerror = (e) => {
                // todo
                console.error(e);
                myWorker.terminate();
                reject(e);
                Sentry.captureException(e);
            }

            myWorker.postMessage({
                type: "encryptionKey",
                password,
                authEncryptionKeyConstants: authEncryptionKeyConstants.encode({ version: Version })
            });
        })
    }

    static async createKeys(password: string): Promise<{ authSignKeyPair; authEncryptionSecretKey; authSignKeyConstants; authEncryptionKeyConstants }> {
        return new Promise((resolve, reject) => {
            //const myWorker = new Worker(new URL("@stamhoofd/workers/KeyWorker.ts", import.meta.url))
            const myWorker = new KeyWorker();

            myWorker.onmessage = (e) => {
                try {
                    const {
                        authSignKeyPair,
                        authEncryptionSecretKey
                    } = e.data;

                    const authSignKeyConstantsEncoded = e.data.authSignKeyConstants;
                    const authEncryptionKeyConstantsEncoded = e.data.authEncryptionKeyConstants;

                    const authSignKeyConstants = KeyConstants.decode(new ObjectData(authSignKeyConstantsEncoded, { version: Version }))
                    const authEncryptionKeyConstants = KeyConstants.decode(new ObjectData(authEncryptionKeyConstantsEncoded, { version: Version }))

                    // Requset challenge
                    resolve({
                        authSignKeyPair,
                        authEncryptionSecretKey,
                        authSignKeyConstants,
                        authEncryptionKeyConstants
                    })
                } catch (e) {
                    reject(e)
                }
                myWorker.terminate()
            }

            myWorker.onerror = (e) => {
                console.error(e);
                myWorker.terminate();
                reject(e);
                Sentry.captureException(e);
            }

            myWorker.postMessage({
                "type": "keys",
                "password": password
            });
        })
    }

    /**
     * Save an invite until the e-mail address we have is valid
     */
    static saveInvite(invite: Invite, secret: string) {
        this.addStoredInvite(StoredInvite.create({
            invite,
            secret
        }))
    }

    static async tradeInvitesIfNeeded(session: Session) {
        const invites = this.getStoredInvites()
        let traded = false

        for (const invite of invites) {
            if (invite.invite.isValid() && invite.invite.organization.id === session.organizationId) {
                try {
                    await this.tradeInvite(session, invite.invite.key, invite.secret, true)
                    traded = true
                } catch(e) {
                    console.error(e)
                }
            }
        }

        if (traded) {
            // We need the user for decrypting the next invite
            session.user = null

            // Need to clear organization, because we might have more access now (to new groups)
            session.organization = null
        }

        this.clearStoredInvites()
    }

    static async tradeInvite(session: Session, key: string, secret: string, multiple = false) {
        const response = await session.authenticatedServer.request({
            method: "POST",
            path: "/invite/"+encodeURIComponent(key)+"/trade",
            decoder: TradedInvite as Decoder<TradedInvite>
        })

        // todo: store this result until completed the trade in!

        const encryptedKeychainItems = response.data.keychainItems
        
        if (encryptedKeychainItems) {
            const decrypted = await Sodium.decryptMessage(encryptedKeychainItems, secret)
            await LoginHelper.addToKeychain(session, decrypted)
        }

        // Clear user since permissions have changed
        if (!multiple) {
            // We need the user for decrypting the next invite
            session.user = null
        }
        //SessionManager.clearCurrentSession()
        //await SessionManager.setCurrentSession(session)
    }

    /**
     * Return true when the polling should end + confirmation should stop
     */
    static async pollEmail(session: Session, token: string): Promise<boolean> {
        const savedKeys = this.getTemporaryKey(token)
        if (!savedKeys) {
            return false
        }
        const response = await session.server.request({
            method: "POST",
            path: "/verify-email/poll",
            body: PollEmailVerificationRequest.create({
                token
            }),
            decoder: PollEmailVerificationResponse as Decoder<PollEmailVerificationResponse>
        })

        if (!response.data.valid) {
            // the code has been used or is expired
            session.loadFromStorage()
            if (session.canGetCompleted()) {
                // yay! We are signed in
                await session.updateData()
                return true
            }

            // Try to login with stored key
            await this.login(session, savedKeys.email, savedKeys)
            return true
        }
        return false
    }

    static async verifyEmail(session: Session, code: string, token: string) {
        const response = await session.server.request({
            method: "POST",
            path: "/verify-email",
            body: VerifyEmailRequest.create({
                code,
                token
            }),
            decoder: Token as Decoder<Token>
        })

        // Yay, we have a token!
        // But only use this token if we still have the encryptionKey stored in our cache
        // else, just return  and let the view return to home and sign in again
        const storedKeys = this.getTemporaryKey(token)

        if (!storedKeys) {
            // Warning: it is possible that this code + token is from a different user
            // than the current user in session.
            // So never set the token here, since we cannot swap the encryption key too

            // We are verified, but can't use the token without password.
            // Could be that we are already signed in (but doesn't matter)

            // Update the user for sure (could have changed)
            // e.g. when changing password
            if (session.canGetCompleted()) {
                await session.fetchUser()
            }
            
            console.warn("Email verified, but no encryptionKey found")
            return;
        }
        this.deleteTemporaryKey(token)
        session.clearKeys()
        
        
        try {
            session.preventComplete = true


            console.log("Set token")
            session.setToken(response.data)

            // Request additional data
            console.log("Fetching user")
            await session.fetchUser()

            await session.setEncryptionKey(storedKeys.authEncryptionKey)
            await this.tradeInvitesIfNeeded(session)

            // if user / organization got cleared due to an invite
            if (!session.isComplete()) {
                await session.updateData()
                // need to wait on this because it changes the permissions
            }
        } finally {
            session.preventComplete = false
        }
       
        await SessionManager.setCurrentSession(session)
    }


    static async login(
        session: Session, 
        email: string, 
        password: string | ({ authSignPrivateKey: string; authEncryptionKey: string })
    ): Promise<{ verificationToken?: string }> {
        const response = await session.server.request({
            method: "POST",
            path: "/oauth/token",
            // eslint-disable-next-line @typescript-eslint/camelcase
            body: { grant_type: "request_challenge", email: email },
            decoder: ChallengeResponseStruct as Decoder<ChallengeResponseStruct>
        })
        const challengeResponse = response.data

        let authSignKeys: { privateKey: string }

        if (typeof password === "string") {
             try {
                authSignKeys = await this.createSignKeys(password, challengeResponse.keyConstants)
            } catch (e) {
                console.error(e)
                throw new SimpleError({
                    code: "sign_key_creation_failed",
                    message: "Het is niet gelukt om de sleutels aan te maken. Probeer het op een ander toestel of browser opnieuw uit of neem contact met ons op."
                })
            }
        } else {
            authSignKeys = { privateKey: password.authSignPrivateKey }
        }
       
        if (challengeResponse.challenge.length < 30) {
            throw new Error("Malicious challenge received")
        }
        console.log("Signing challenge...")
        const signature = await Sodium.signMessage(challengeResponse.challenge, authSignKeys.privateKey)
        console.log("Sending signature...")

        let tokenResponse: RequestResult<Token>

        try {
            tokenResponse = await session.server.request({
                method: "POST",
                path: "/oauth/token",
                // eslint-disable-next-line @typescript-eslint/camelcase
                body: { grant_type: "challenge", email: email, challenge: challengeResponse.challenge, signature },
                decoder: Token as Decoder<Token>
            })
        } catch (e) {
            if ((isSimpleError(e) || isSimpleErrors(e))) {
                const error = e.getCode("verify_email")
                if (error) {
                    if (typeof password !== "string") {
                        console.warn("Inifite loop in sign in: sign in after validaton caused a new verification request")
                        throw e
                    }
                    const meta = SignupResponse.decode(new ObjectData(error.meta, { version: Version }))

                    const encryptionKey = await this.createEncryptionKey(password, meta.authEncryptionKeyConstants)
                    this.addTemporaryKey(meta.token, StoredKeys.create({
                        email,
                        authEncryptionKey: encryptionKey,
                        authSignPrivateKey: authSignKeys.privateKey   
                    }))

                    return {
                        verificationToken: meta.token
                    }
                }
                
            }
            throw e
        }

        // No need to keep awaiting keys now
        this.clearAwaitingKeys()

        // Clear session first
        // needed to make sure we don't use old keys now
        // we are sure we'll have good, new keys
        session.clearKeys()

        console.log("Set token")
        session.setToken(tokenResponse.data)

        // Request additional data
        console.log("Fetching user")
        const user = await session.fetchUser()
        console.log("ok")

        // Problem: page already loaded :(
        let encryptionKey!: string
        if (typeof password === "string") {
            encryptionKey = await this.createEncryptionKey(password, user.authEncryptionKeyConstants)
        } else {
            encryptionKey = password.authEncryptionKey
        }
        await session.setEncryptionKey(encryptionKey)

        await this.tradeInvitesIfNeeded(session)

        // if user / orgaznization got cleared due to an invite
        if (!session.isComplete()) {
            await session.updateData()
            // need to wait on this because it changes the permissions
        }

        await SessionManager.setCurrentSession(session)

        return {}
    }

    static async signUpOrganization(organization: Organization, email: string, password: string, firstName: string | null = null, lastName: string | null = null, registerCode: string | null = null): Promise<string> {
        const keys = await this.createKeys(password)

        const userKeyPair = await Sodium.generateEncryptionKeyPair();
        const organizationKeyPair = await Sodium.generateEncryptionKeyPair();

        const user = NewUser.create({
            email,
            firstName,
            lastName,
            publicKey: userKeyPair.publicKey,
            publicAuthSignKey: keys.authSignKeyPair.publicKey,
            authSignKeyConstants: keys.authSignKeyConstants,
            authEncryptionKeyConstants: keys.authEncryptionKeyConstants,
            encryptedPrivateKey: await Sodium.encryptMessage(userKeyPair.privateKey, keys.authEncryptionSecretKey)
        });

        organization.publicKey = organizationKeyPair.publicKey

        const item = KeychainItem.create({
            publicKey: organization.publicKey,
            encryptedPrivateKey: await Sodium.sealMessageAuthenticated(organizationKeyPair.privateKey, userKeyPair.publicKey, userKeyPair.privateKey)
        })

        // Do netwowrk request to create organization
        const response = await NetworkManager.server.request({
            method: "POST",
            path: "/organizations",
            body: CreateOrganization.create({
                organization,
                user,
                keychainItems: [
                    item
                ],
                registerCode
            }),
            decoder: SignupResponse as Decoder<SignupResponse>
        })

        // Save encryption key until verified
        this.addTemporaryKey(response.data.token, StoredKeys.create({
            email,
            authEncryptionKey: keys.authEncryptionSecretKey,
            authSignPrivateKey: keys.authSignKeyPair.privateKey
        }))
        return response.data.token

        // Auomatically assign all prmissions (frontend side)
        /*user.permissions = Permissions.create({
            level: PermissionLevel.Full
        })

        const session = new Session(organization.id)
        session.setToken(response.data)
        Keychain.addItem(item)

        // We don't preload anything because the server will make some additional changes to all the data, and we need to refetch everything
        await session.setEncryptionKey(keys.authEncryptionSecretKey)
        await SessionManager.setCurrentSession(session)
        */
    }

    static async shareKey(keyPair: { publicKey: string; privateKey: string; }, receiverId: string, receiverPulicKey: string): Promise<Invite> {
        // Create an invite (automatic one)
        const items = new VersionBox([InviteKeychainItem.create({
            publicKey: keyPair.publicKey,
            privateKey: keyPair.privateKey
        })])

        const invite = NewInvite.create({ 
            userDetails: null,
            permissions: null,
            receiverId,
            keychainItems: await Sodium.sealMessage(JSON.stringify(items.encode({ version: Version })), receiverPulicKey)
        })

        const response = await SessionManager.currentSession!.authenticatedServer.request({
            method: "POST",
            path: "/invite",
            body: invite,
            decoder: Invite as Decoder<Invite>
        })
        return response.data
    }

    static async loadAdmins(): Promise<OrganizationAdmins> {
        const session = SessionManager.currentSession!
        const response = await session.authenticatedServer.request({
            method: "GET",
            path: "/organization/admins",
            decoder: OrganizationAdmins as Decoder<OrganizationAdmins>
        })

        return response.data
    }

    static async changeOrganizationKey(session: Session) {
        const organizationKeyPair = await Sodium.generateEncryptionKeyPair();
        const item = await session.createKeychainItem(organizationKeyPair)

        // Send invites to all other administrators
        // Before we change the key
        const organization = await this.loadAdmins()
        for (const admin of organization.users) {
            if (admin.publicKey && admin.id !== SessionManager.currentSession!.user!.id) {
                await this.shareKey(organizationKeyPair, admin.id, admin.publicKey)
            }
        }

        // Do netwowrk request to create organization
        await session.authenticatedServer.request({
            method: "POST",
            path: "/organization/change-key",
            body: ChangeOrganizationKeyRequest.create({
                publicKey: organizationKeyPair.publicKey,
                keychainItems: [
                    item
                ]
            })
        })

        Keychain.addItem(item)
        await session.updateData()
        await SessionManager.setCurrentSession(session)
    }

    static async changePassword(session: Session, password: string, force = false) {
        const keys = await this.createKeys(password)

        let userPrivateKey = session.getUserPrivateKey();
        let publicKey: string | undefined = undefined
        if (!userPrivateKey) {
            if (!force) {
                throw new SimpleError({
                    code: "missing_key",
                    message: "Je kan je wachtwoord niet veranderen als je geen toegang hebt tot je encryptie-sleutel."
                })
            }
            const userKeyPair = await Sodium.generateEncryptionKeyPair();
            userPrivateKey = userKeyPair.privateKey
            publicKey = userKeyPair.publicKey
        }

        const patch = NewUser.patch({
            id: session.user!.id,
            publicKey,
            publicAuthSignKey: keys.authSignKeyPair.publicKey,
            authSignKeyConstants: keys.authSignKeyConstants,
            authEncryptionKeyConstants: keys.authEncryptionKeyConstants,
            encryptedPrivateKey: await Sodium.encryptMessage(userPrivateKey, keys.authEncryptionSecretKey)
        })

        // Do netwowrk request to create organization
        const response = await session.authenticatedServer.request({
            method: "PATCH",
            path: "/user/"+session.user!.id,
            body: patch,
            decoder: User
        })

        if (session.user) {
            // Clear user
            session.user = null;
        }

        // Clear all known keys
        // -> initiate loading screen
        session.clearKeys()

        await session.setEncryptionKey(keys.authEncryptionSecretKey)
    }

    static async fixPublicKey(session: Session) {
        const userPrivateKey = session.getUserPrivateKey();
        const authEncryptionKey = session.getAuthEncryptionKey()
        if (!userPrivateKey || !authEncryptionKey) {
            throw new Error("Encryption key not set")
        }

        const patch = NewUser.patch({
            id: session.user!.id,
            publicKey: await Sodium.getEncryptionPublicKey(userPrivateKey),
            publicAuthSignKey: session.user!.publicAuthSignKey,
            authSignKeyConstants: session.user!.authSignKeyConstants,
            authEncryptionKeyConstants: session.user!.authEncryptionKeyConstants,
            encryptedPrivateKey: await Sodium.encryptMessage(userPrivateKey, authEncryptionKey)
        })

        // Gather all keychain items, and check which ones are still valid
        const keychain = Keychain.items

        // Add the keys to the keychain (if not already present)
        const decryptedItems: { publicKey: string; privateKey: string }[] = []
        for (const [_, item] of keychain) {
            try {
                const decrypted = await session.decryptKeychainItem(item)
                decryptedItems.push(decrypted)
            } catch (e) {
                console.error(e)
            }
        }

        // Do netwowrk request to create organization
        const response = await session.authenticatedServer.request({
            method: "PATCH",
            path: "/user/"+session.user!.id,
            body: patch,
            decoder: User
        })

        if (session.user) {
            // Clear user
            session.user = null;
        }

        await session.setEncryptionKey(authEncryptionKey)

        // Readd keychains
        const encryptedItems: KeychainItem[] = []
        for (const item of decryptedItems) {
            try {
                const encryptedItem = await session.createKeychainItem(item)
                encryptedItems.push(encryptedItem)
            } catch (e) {
                console.error(e)
            }
        }

        if (encryptedItems.length > 0) {
            const response = await session.authenticatedServer.request({
                method: "POST",
                path: "/keychain",
                body: encryptedItems
            })
        }
    }

    static async patchUser(session: Session, patch: AutoEncoderPatchType<User>): Promise<{ verificationToken?: string }> {
        // Do netwowrk request to create organization
        try {
            await session.authenticatedServer.request({
                method: "PATCH",
                path: "/user/"+session.user!.id,
                body: patch,
                decoder: User
            })
        } catch (e) {
            if ((isSimpleError(e) || isSimpleErrors(e))) {
                const error = e.getCode("verify_email")
                if (error) {
                    const meta = SignupResponse.decode(new ObjectData(error.meta, { version: Version }))
                    return {
                        verificationToken: meta.token
                    }
                }
                
            }
            throw e
        }

        await session.updateData()
        return {}
    }

    static async signUp(session: Session, email: string, password: string, firstName: string | null = null, lastName: string | null = null): Promise<string> {
        const keys = await this.createKeys(password)

        const userKeyPair = await Sodium.generateEncryptionKeyPair();

        const user = NewUser.create({
            email,
            firstName,
            lastName,
            publicKey: userKeyPair.publicKey,
            publicAuthSignKey: keys.authSignKeyPair.publicKey,
            authSignKeyConstants: keys.authSignKeyConstants,
            authEncryptionKeyConstants: keys.authEncryptionKeyConstants,
            encryptedPrivateKey: await Sodium.encryptMessage(userKeyPair.privateKey, keys.authEncryptionSecretKey)
        });

        // Do netwowrk request to create organization
        const response = await session.server.request({
            method: "POST",
            path: "/sign-up",
            body: user,
            decoder: SignupResponse as Decoder<SignupResponse>
        })

        if (session.user) {
            // Clear user
            session.user = null;
        }

        // Save encryption key until verified
        this.addTemporaryKey(response.data.token, StoredKeys.create({
            email,
            authEncryptionKey: keys.authEncryptionSecretKey,
            authSignPrivateKey: keys.authSignKeyPair.privateKey
        }))
        return response.data.token
    }

    static async addToKeychain(session: Session, decryptedKeychainItems: string) {
        // unbox
        const keychainItems = new ObjectData(JSON.parse(decryptedKeychainItems), { version: Version }).decode(new VersionBoxDecoder(new ArrayDecoder(InviteKeychainItem as Decoder<InviteKeychainItem>))).data

        // Add the keys to the keychain (if not already present)
        const encryptedItems: KeychainItem[] = []
        for (const item of keychainItems) {
            const encryptedItem = await session.createKeychainItem(item)
            encryptedItems.push(encryptedItem)
        }

        if (encryptedItems.length > 0) {
            const response = await session.authenticatedServer.request({
                method: "POST",
                path: "/keychain",
                body: encryptedItems
            })
        }
    }
}