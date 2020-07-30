import AuthEncryptionKeyWorker from 'worker-loader!@stamhoofd/workers/LoginAuthEncryptionKey.ts';
import SignKeysWorker from 'worker-loader!@stamhoofd/workers/LoginSignKeys.ts';
import { KeyConstants, Version, ChallengeResponseStruct, Token, NewUser } from '@stamhoofd/structures';
import { Decoder, ObjectData } from '@simonbackx/simple-encoding';
import { Sodium } from '@stamhoofd/crypto';
import { SessionManager } from './SessionManager';
import { Session } from './Session';
import { SimpleError, isSimpleError, isSimpleErrors } from '@simonbackx/simple-errors';
import { RequestResult } from '@simonbackx/simple-networking';
import GenerateWorker from 'worker-loader!@stamhoofd/workers/generateAuthKeys.ts';

export class LoginHelper {

    static async createSignKeys(password: string, authSignKeyConstants: KeyConstants): Promise<{ publicKey: string; privateKey: string }> {
        return new Promise((resolve, reject) => {
            const myWorker = new SignKeysWorker();

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
                password,
                authSignKeyConstants: authSignKeyConstants.encode({ version: Version })
            });
        })
    }

    static async createEncryptionKey(password: string, authEncryptionKeyConstants: KeyConstants): Promise<string> {
        return new Promise((resolve, reject) => {
            console.log("starting encryption key worker")
            const myWorker = new AuthEncryptionKeyWorker();

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
                password,
                authEncryptionKeyConstants: authEncryptionKeyConstants.encode({ version: Version })
            });
        })
    }

    static async createKeys(password: string): Promise<{ userKeyPair, organizationKeyPair, authSignKeyPair, authEncryptionSecretKey, authSignKeyConstants, authEncryptionKeyConstants }> {
        return new Promise((resolve, reject) => {
            const myWorker = new GenerateWorker();

            myWorker.onmessage = (e) => {
                try {
                    const {
                        userKeyPair,
                        organizationKeyPair,
                        authSignKeyPair,
                        authEncryptionSecretKey
                    } = e.data;

                    const authSignKeyConstantsEncoded = e.data.authSignKeyConstants;
                    const authEncryptionKeyConstantsEncoded = e.data.authEncryptionKeyConstants;

                    const authSignKeyConstants = KeyConstants.decode(new ObjectData(authSignKeyConstantsEncoded, { version: Version }))
                    const authEncryptionKeyConstants = KeyConstants.decode(new ObjectData(authEncryptionKeyConstantsEncoded, { version: Version }))

                    // Requset challenge
                    resolve({
                        userKeyPair,
                        organizationKeyPair,
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

            myWorker.postMessage(password);
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
        console.log(challengeResponse)
        console.log(authSignKeys)
        const signature = await Sodium.signMessage(challengeResponse.challenge, authSignKeys.privateKey)
        console.log("Sending signature...")

        let tokenResponse: RequestResult<Token>;
        try {
            tokenResponse = await session.server.request({
                method: "POST",
                path: "/oauth/token",
                // eslint-disable-next-line @typescript-eslint/camelcase
                body: { grant_type: "challenge", email: email, challenge: challengeResponse.challenge, signature },
                decoder: Token as Decoder<Token>
            })
        } catch (e) {
            throw e
        }

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

    static async signUp(session: Session, email: string, password: string, firstName: string | null = null, lastName: string | null = null) {
        const keys = await this.createKeys(password)

        const user = NewUser.create({
            email,
            firstName,
            lastName,
            publicKey: keys.userKeyPair.publicKey,
            publicAuthSignKey: keys.authSignKeyPair.publicKey,
            authSignKeyConstants: keys.authSignKeyConstants,
            authEncryptionKeyConstants: keys.authEncryptionKeyConstants,
            encryptedPrivateKey: await Sodium.encryptMessage(keys.userKeyPair.privateKey, keys.authEncryptionSecretKey)
        });

        // Do netwowrk request to create organization
        const response = await session.server.request({
            method: "POST",
            path: "/sign-up",
            body: user,
            decoder: Token
        })

        session.setToken(response.data)
        session.setEncryptionKey(keys.authEncryptionSecretKey, { user, userPrivateKey: keys.userKeyPair.privateKey })
        SessionManager.setCurrentSession(session)
    }
}