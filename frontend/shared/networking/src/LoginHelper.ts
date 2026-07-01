import { startAuthentication } from '@simplewebauthn/browser';
import type { PublicKeyCredentialRequestOptionsJSON } from '@simplewebauthn/browser';
import type { AutoEncoderPatchType, Decoder, EncodableObject } from '@simonbackx/simple-encoding';
import { ObjectData } from '@simonbackx/simple-encoding';
import { isSimpleError, isSimpleErrors } from '@simonbackx/simple-errors';
import type { RequestResult } from '@simonbackx/simple-networking';
import type { Organization} from '@stamhoofd/structures';
import { CreateOrganization, CreateOrganizationResponse, MFAChallengeResponse, MFAMethodType, MFASetupResponse, NewUser, PollEmailVerificationRequest, PollEmailVerificationResponse, SignupResponse, Token, User, VerifyEmailRequest, Version } from '@stamhoofd/structures';

import { NetworkManager } from './NetworkManager';
import type {SessionContext} from './SessionContext';
import { SessionManager } from './SessionManager';

export type LoginResult = { verificationToken?: string; mfaChallenge?: MFAChallengeResponse; mfaSetupToken?: string };

export class LoginHelper {
    /**
     * Resend the email verification email (if it is still valid)
     * @returns stop: close the modal - the token is expired and you need to login again
     */
    static async retryEmail(session: SessionContext, token: string): Promise<boolean> {
        const response = await session.identityServer.request({
            method: 'POST',
            path: '/verify-email/retry',
            body: PollEmailVerificationRequest.create({
                token,
            }),
            decoder: PollEmailVerificationResponse as Decoder<PollEmailVerificationResponse>,
        });

        if (!response.data.valid) {
            // the code has been used or is expired

            // Check if we are now logged in (link might have been opened in a new tab)
            await session.loadFromStorage();
            if (session.canGetCompleted()) {
                // yay! We are signed in
                await SessionManager.prepareSessionForUsage(session, false);
                return true;
            }

            return true;
        }
        return false;
    }

    /**
     * Return true when the polling should end + confirmation should stop
     */
    static async pollEmail(session: SessionContext, token: string): Promise<boolean> {
        const response = await session.identityServer.request({
            method: 'POST',
            path: '/verify-email/poll',
            body: PollEmailVerificationRequest.create({
                token,
            }),
            decoder: PollEmailVerificationResponse as Decoder<PollEmailVerificationResponse>,
        });

        if (!response.data.valid) {
            // Check if we are now logged in (link might have been opened in a new tab)
            await session.loadFromStorage();
            await SessionManager.prepareSessionForUsage(session, false);
            return true;
        }
        return false;
    }

    static async verifyEmail(session: SessionContext, code: string, token: string) {
        try {
            const response = await session.identityServer.request({
                method: 'POST',
                path: '/verify-email',
                body: VerifyEmailRequest.create({
                    code,
                    token,
                }),
                decoder: Token as Decoder<Token>,
            });
            try {
                session.preventComplete = true;
                await session.setToken(response.data);
                await SessionManager.prepareSessionForUsage(session, false);
            }
            finally {
                session.preventComplete = false;
            }
        }
        catch (e) {
            if (isSimpleError(e) || isSimpleErrors(e)) {
                if (e.hasCode('invalid_code')) {
                    // Check if we are now logged in (link might have been opened in a new tab)
                    await session.loadFromStorage();
                    await SessionManager.prepareSessionForUsage(session, false);
                    if (session.user && session.user.verified && session.canGetCompleted()) {
                        // All good
                        return;
                    }
                }
            }
            throw e;
        }
    }

    static async login(
        session: SessionContext,
        email: string,
        password: string,
    ): Promise<LoginResult> {
        let tokenResponse: RequestResult<Token>;
        try {
            session.setLoadingError(null);
            tokenResponse = await session.identityServer.request({
                method: 'POST',
                path: '/oauth/token',
                body: { grant_type: 'password', username: email, password },
                decoder: Token as Decoder<Token>,
                shouldRetry: false,
            });
        }
        catch (e) {
            if ((isSimpleError(e) || isSimpleErrors(e))) {
                const error = e.getCode('verify_email');
                if (error) {
                    const meta = SignupResponse.decode(new ObjectData(error.meta, { version: Version }));

                    return {
                        verificationToken: meta.token,
                    };
                }

                // Password was correct, but a second factor is required.
                const mfaError = e.getCode('require_mfa');
                if (mfaError) {
                    return {
                        mfaChallenge: MFAChallengeResponse.decode(new ObjectData(mfaError.meta, { version: Version })),
                    };
                }

                // Password was correct, but the user must first enroll a second factor.
                const setupError = e.getCode('require_mfa_setup');
                if (setupError) {
                    return {
                        mfaSetupToken: MFASetupResponse.decode(new ObjectData(setupError.meta, { version: Version })).setupToken,
                    };
                }
            }
            throw e;
        }

        await this.applyToken(session, tokenResponse.data);
        return {};
    }

    /**
     * Apply a freshly obtained token to the session and prepare it for usage.
     */
    private static async applyToken(session: SessionContext, token: Token): Promise<void> {
        session.preventComplete = true;
        try {
            await session.setToken(token);
            await SessionManager.prepareSessionForUsage(session);
        }
        finally {
            session.preventComplete = false;
        }
    }

    /**
     * Post an `mfa` grant to complete a login that requires a second factor.
     */
    private static async postMfaGrant(session: SessionContext, body: EncodableObject): Promise<void> {
        const response = await session.identityServer.request({
            method: 'POST',
            path: '/oauth/token',
            body,
            decoder: Token as Decoder<Token>,
            shouldRetry: false,
        });
        await this.applyToken(session, response.data);
    }

    static async verifyMfaTotp(session: SessionContext, mfaToken: string, code: string): Promise<void> {
        await this.postMfaGrant(session, { grant_type: 'mfa', mfa_token: mfaToken, method: MFAMethodType.TOTP, code });
    }

    static async verifyMfaRecoveryCode(session: SessionContext, mfaToken: string, code: string): Promise<void> {
        await this.postMfaGrant(session, { grant_type: 'mfa', mfa_token: mfaToken, method: MFAMethodType.RecoveryCode, code });
    }

    static async verifyMfaPasskey(session: SessionContext, mfaToken: string, webauthnAuthenticationOptions: unknown): Promise<void> {
        // These options are opaque JSON generated by our own server (@simplewebauthn) and
        // handed straight to the browser API, so we assert the concrete type here.
        const a = await startAuthentication({ optionsJSON: webauthnAuthenticationOptions as PublicKeyCredentialRequestOptionsJSON });
        await this.postMfaGrant(session, {
            grant_type: 'mfa',
            mfa_token: mfaToken,
            method: MFAMethodType.Passkey,
            assertion: {
                id: a.id,
                rawId: a.rawId,
                type: a.type,
                response: {
                    clientDataJSON: a.response.clientDataJSON,
                    authenticatorData: a.response.authenticatorData,
                    signature: a.response.signature,
                    userHandle: a.response.userHandle ?? null,
                },
            },
        });
    }

    static async signUpOrganization(organization: Organization, email: string, password: string, firstName: string | null = null, lastName: string | null = null, registerCode: string | null = null): Promise<string> {
        const user = NewUser.create({
            email,
            organizationId: organization.id,
            firstName,
            lastName,
            password,
        });

        // Do netwowrk request to create organization
        const response = await NetworkManager.server.request({
            method: 'POST',
            path: '/organizations',
            body: CreateOrganization.create({
                organization,
                user,
                registerCode,
            }),
            decoder: CreateOrganizationResponse as Decoder<CreateOrganizationResponse>,
        });
        organization.id = response.data.organization.id;
        organization.deepSet(response.data.organization)

        return response.data.token;
    }

    static async changePassword(session: SessionContext, password: string, email?: string) {
        console.log('Change password. Start.');

        const patch = NewUser.patch({
            id: session.user!.id,
            password,
            email,
        });

        return await this.patchUser(session, patch);
    }

    static async patchUser(session: SessionContext, patch: AutoEncoderPatchType<NewUser | User>): Promise<{ verificationToken?: string }> {
        // Do netwowrk request to create organization
        try {
            await session.authenticatedIdentityServer.request({
                method: 'PATCH',
                path: '/user/' + patch.id,
                body: patch,
                decoder: User,
                shouldRetry: false,
            });
        }
        catch (e) {
            if ((isSimpleError(e) || isSimpleErrors(e))) {
                const error = e.getCode('verify_email');
                if (error) {
                    const meta = SignupResponse.decode(new ObjectData(error.meta, { version: Version }));
                    return {
                        verificationToken: meta.token,
                    };
                }
            }
            throw e;
        }

        if (session.user!.id === patch.id) {
            await session.updateData(true, false);
        }
        return {};
    }

    static async signUp(session: SessionContext, email: string, password: string, firstName: string | null = null, lastName: string | null = null): Promise<string> {
        const user = NewUser.create({
            email,
            organizationId: session.organization?.id ?? null,
            firstName,
            lastName,
            password,
        });

        // Do netwowrk request to create organization
        const response = await session.identityServer.request({
            method: 'POST',
            path: '/sign-up',
            body: user,
            decoder: SignupResponse as Decoder<SignupResponse>,
        });

        if (session.user) {
            // Clear user
            session.user = null;
        }

        return response.data.token;
    }
}
