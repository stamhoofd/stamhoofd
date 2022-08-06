import { AutoEncoderPatchType, Decoder, ObjectData } from '@simonbackx/simple-encoding';
import { isSimpleError, isSimpleErrors } from '@simonbackx/simple-errors';
import { RequestResult } from '@simonbackx/simple-networking';
import { CreateOrganization, NewUser, Organization, OrganizationAdmins, PollEmailVerificationRequest, PollEmailVerificationResponse, SignupResponse, Token, User, VerifyEmailRequest, Version } from '@stamhoofd/structures';

import { NetworkManager } from './NetworkManager';
import { Session } from './Session';
import { SessionManager } from './SessionManager';

export class LoginHelper {
    /**
     * Resend the email verification email (if it is still valid)
     * @returns stop: close the modal - the token is expired and you need to login again
     */
    static async retryEmail(session: Session, token: string): Promise<boolean> {
        const response = await session.server.request({
            method: "POST",
            path: "/verify-email/retry",
            body: PollEmailVerificationRequest.create({
                token
            }),
            decoder: PollEmailVerificationResponse as Decoder<PollEmailVerificationResponse>
        })

        if (!response.data.valid) {
            // the code has been used or is expired

            // Check if we are now logged in (link might have been opened in a new tab)
            await session.loadFromStorage()
            if (session.canGetCompleted()) {
                // yay! We are signed in
                await session.updateData(true)
                return true
            }

            return true
        }
        return false
    }

    /**
     * Return true when the polling should end + confirmation should stop
     */
    static async pollEmail(session: Session, token: string): Promise<boolean> {
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

            // Check if we are now logged in (link might have been opened in a new tab)
            await session.loadFromStorage()
            if (session.canGetCompleted()) {
                // yay! We are signed in
                await SessionManager.setCurrentSession(session)
                return true
            }

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
        
        try {
            session.preventComplete = true

            console.log("Set token")
            session.setToken(response.data)

            // Request additional data
            console.log("Fetching user")
            await session.fetchUser()

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
        password: string
    ): Promise<{ verificationToken?: string }> {
        let tokenResponse: RequestResult<Token>
        try {
            tokenResponse = await session.server.request({
                method: "POST",
                path: "/oauth/token",
                body: { grant_type: "password", username: email, password },
                decoder: Token as Decoder<Token>,
                shouldRetry: false
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

        session.setToken(tokenResponse.data)
        await session.fetchUser()

        // if user / orgaznization got cleared due to an invite
        if (!session.isComplete()) {
            await session.updateData(false, false)
            // need to wait on this because it changes the permissions
        }

        await SessionManager.setCurrentSession(session)
        return {}
    }

    static async signUpOrganization(organization: Organization, email: string, password: string, firstName: string | null = null, lastName: string | null = null, registerCode: string | null = null): Promise<string> {
        const user = NewUser.create({
            email,
            firstName,
            lastName,
            password
        });

        // Do netwowrk request to create organization
        const response = await NetworkManager.server.request({
            method: "POST",
            path: "/organizations",
            body: CreateOrganization.create({
                organization,
                user,
                registerCode
            }),
            decoder: SignupResponse as Decoder<SignupResponse>
        })
       
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

    static async loadAdmins(shouldRetry = true, owner?: any): Promise<OrganizationAdmins> {
        const session = SessionManager.currentSession!
        const response = await session.authenticatedServer.request({
            method: "GET",
            path: "/organization/admins",
            decoder: OrganizationAdmins as Decoder<OrganizationAdmins>,
            shouldRetry,
            owner
        })

        return response.data
    }

    static async changePassword(session: Session, password: string, email?: string) {
        console.log("Change password. Start.")

        const patch = NewUser.patch({
            id: session.user!.id,
            password,
            email
        })

        return await this.patchUser(session, patch)
    }

    static async patchUser(session: Session, patch: AutoEncoderPatchType<NewUser | User>): Promise<{ verificationToken?: string }> {
        // Do netwowrk request to create organization
        try {
            await session.authenticatedServer.request({
                method: "PATCH",
                path: "/user/"+patch.id,
                body: patch,
                decoder: User,
                shouldRetry: false
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

        if (session.user!.id === patch.id) {
            await session.updateData(true, false)
        }
        return {}
    }

    static async signUp(session: Session, email: string, password: string, firstName: string | null = null, lastName: string | null = null): Promise<string> {
        const user = NewUser.create({
            email,
            firstName,
            lastName,
            password
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

        return response.data.token
    }
}