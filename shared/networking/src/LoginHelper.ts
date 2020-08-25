import { KeyConstants, Version, ChallengeResponseStruct, Token, NewUser, Organization, KeychainItem, CreateOrganization, User, Permissions, PermissionLevel } from '@stamhoofd/structures';
import { Decoder, ObjectData, AutoEncoderPatchType } from '@simonbackx/simple-encoding';
import { Sodium } from '@stamhoofd/crypto';
import { SessionManager } from './SessionManager';
import { Session } from './Session';
import { SimpleError } from '@simonbackx/simple-errors';
import KeyWorker from 'worker-loader!@stamhoofd/workers/KeyWorker.ts';
import { NetworkManager } from './NetworkManager';
import { Keychain } from './Keychain';

export class LoginHelper {

    static async createSignKeys(password: string, authSignKeyConstants: KeyConstants): Promise<{ publicKey: string; privateKey: string }> {
        return new Promise((resolve, reject) => {
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
                reject(e)
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
                reject(e)
            }

            myWorker.postMessage({
                type: "encryptionKey",
                password,
                authEncryptionKeyConstants: authEncryptionKeyConstants.encode({ version: Version })
            });
        })
    }

    static async createKeys(password: string): Promise<{ authSignKeyPair, authEncryptionSecretKey, authSignKeyConstants, authEncryptionKeyConstants }> {
        return new Promise((resolve, reject) => {
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
                // todo
                console.error(e);
                myWorker.terminate();
                reject(e)
            }

            myWorker.postMessage({
                "type": "keys",
                "password": password
            });
        })
    }


    static async login(session: Session, email: string, password: string) {
        let challengeResponse: ChallengeResponseStruct

        const response = await session.server.request({
            method: "POST",
            path: "/oauth/token",
            // eslint-disable-next-line @typescript-eslint/camelcase
            body: { grant_type: "request_challenge", email: email },
            decoder: ChallengeResponseStruct as Decoder<ChallengeResponseStruct>
        })
        challengeResponse = response.data

        let authSignKeys: { publicKey: string; privateKey: string }
        try {
            authSignKeys = await this.createSignKeys(password, challengeResponse.keyConstants)
        } catch (e) {
            console.error(e)
            throw new SimpleError({
                code: "sign_key_creation_failed",
                message: "Het is niet gelukt om de sleutels aan te maken. Probeer het op een ander toestel of browser opnieuw uit of neem contact met ons op."
            })
        }

        if (challengeResponse.challenge.length < 30) {
            throw new Error("Malicious challenge received")
        }
        console.log("Signing challenge...")
        const signature = await Sodium.signMessage(challengeResponse.challenge, authSignKeys.privateKey)
        console.log("Sending signature...")

        let tokenResponse = await session.server.request({
            method: "POST",
            path: "/oauth/token",
            // eslint-disable-next-line @typescript-eslint/camelcase
            body: { grant_type: "challenge", email: email, challenge: challengeResponse.challenge, signature },
            decoder: Token as Decoder<Token>
        })

        console.log("Set token")
        session.setToken(tokenResponse.data)

        // Request additional data
        console.log("Fetching user")
        const user = await session.fetchUser()
        console.log("ok")
        const encryptionKey = await this.createEncryptionKey(password, user.authEncryptionKeyConstants)
        session.setEncryptionKey(encryptionKey)

        SessionManager.setCurrentSession(session)
    }

    static async signUpOrganization(organization: Organization, email: string, password: string, firstName: string | null = null, lastName: string | null = null, registerCode: string | null = null) {
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
            decoder: Token
        })

        // Auomatically assign all prmissions (frontend side)
        user.permissions = Permissions.create({
            level: PermissionLevel.Full
        })

        const session = new Session(organization.id)
        session.organization = organization
        session.setToken(response.data)
        Keychain.addItem(item)
        session.setEncryptionKey(keys.authEncryptionSecretKey, {user, userPrivateKey: userKeyPair.privateKey})
        SessionManager.setCurrentSession(session)
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
            encryptedPrivateKey: await Sodium.encryptMessage(userPrivateKey!, keys.authEncryptionSecretKey)
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

        session.setEncryptionKey(keys.authEncryptionSecretKey)
    }

    static async patchUser(session: Session, patch: AutoEncoderPatchType<User>) {
        // Do netwowrk request to create organization
        const response = await session.authenticatedServer.request({
            method: "PATCH",
            path: "/user/"+session.user!.id,
            body: patch,
            decoder: User
        })

        session.updateData()
    }

    static async signUp(session: Session, email: string, password: string, firstName: string | null = null, lastName: string | null = null) {
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
            decoder: Token
        })

        if (session.user) {
            // Clear user
            session.user = null;
        }

        session.setToken(response.data)
        session.setEncryptionKey(keys.authEncryptionSecretKey, { user, userPrivateKey: userKeyPair.privateKey })
        SessionManager.setCurrentSession(session)
    }
}