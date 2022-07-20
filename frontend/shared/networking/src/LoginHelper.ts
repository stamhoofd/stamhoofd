import { ArrayDecoder, AutoEncoder, AutoEncoderPatchType, Decoder, field, ObjectData } from '@simonbackx/simple-encoding';
import { isSimpleError, isSimpleErrors } from '@simonbackx/simple-errors';
import { RequestResult } from '@simonbackx/simple-networking';
import { CreateOrganization, Invite, NewUser, Organization, OrganizationAdmins, PollEmailVerificationRequest, PollEmailVerificationResponse, SignupResponse, Token, TradedInvite, User, VerifyEmailRequest, Version } from '@stamhoofd/structures';

import { NetworkManager } from './NetworkManager';
import { Session } from './Session';
import { SessionManager } from './SessionManager';

class StoredInvite extends AutoEncoder {
    @field({ decoder: Invite })
    invite: Invite
}

export class LoginHelper {
    private static STORED_INVITES: StoredInvite[] = []

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

    /**
     * Save an invite until the e-mail address we have is valid
     */
    static saveInvite(invite: Invite) {
        this.addStoredInvite(StoredInvite.create({
            invite
        }))
    }

    static async tradeInvitesIfNeeded(session: Session) {
        const invites = this.getStoredInvites()
        let traded = false

        for (const invite of invites) {
            if (invite.invite.isValid() && invite.invite.organization.id === session.organizationId) {
                try {
                    await this.tradeInvite(session, invite.invite.key, true)
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

    static async tradeInvite(session: Session, key: string, multiple = false) {
        await session.authenticatedServer.request({
            method: "POST",
            path: "/invite/"+encodeURIComponent(key)+"/trade",
            decoder: TradedInvite as Decoder<TradedInvite>
        })

        // Clear user since permissions have changed
        if (!multiple) {
            // We need the user for decrypting the next invite
            session.user = null
        }
        //SessionManager.clearCurrentSession()
        //await SessionManager.setCurrentSession(session)
    }

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
            await this.tradeInvitesIfNeeded(session)

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

        // No need to keep awaiting keys now
        //this.clearAwaitingKeys()

        console.log("Set token")
        session.setToken(tokenResponse.data)

        // Request additional data
        console.log("Fetching user")
        await session.fetchUser()
        console.log("ok")

        await this.tradeInvitesIfNeeded(session)

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