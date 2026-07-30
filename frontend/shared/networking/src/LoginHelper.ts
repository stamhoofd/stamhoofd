import { startAuthentication } from '@simplewebauthn/browser';
import type { PublicKeyCredentialRequestOptionsJSON } from '@simplewebauthn/browser';
import type { AutoEncoderPatchType, Decoder, EncodableObject } from '@simonbackx/simple-encoding';
import { ObjectData } from '@simonbackx/simple-encoding';
import { isSimpleError, isSimpleErrors } from '@simonbackx/simple-errors';
import type { RequestResult } from '@simonbackx/simple-networking';
import type { Organization } from '@stamhoofd/structures';
import { CreateOrganization, CreateOrganizationResponse, MFAChallengeRequest, MFAChallengeResponse, MFAMethodType, MFASetupResponse, NewUser, PollEmailVerificationRequest, PollEmailVerificationResponse, SignupResponse, Token, User, VerifyEmailRequest, Version } from '@stamhoofd/structures';

import { NetworkManager } from './NetworkManager';
import type { SessionContext } from './SessionContext';
import { SessionManager } from './SessionManager';

export type LoginResult = {
    verificationToken?: string;
    mfaChallenge?: MFAChallengeResponse;
    /**
     * The user must enroll a second factor before the login is finished. When the login
     * started from a password token (invite / password reset), a temporary session token
     * was included and is already applied to the session: the user can change their
     * password first and enroll afterwards.
     */
    mfaSetup?: MFASetupResponse;
};

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

    static async verifyEmail(session: SessionContext, code: string, token: string): Promise<LoginResult> {
        try {
            // Send our session along when we have one: a user that is verifying a new email
            // address while signed in doesn't have to pass their second factor again. The
            // access token is passed as-is (not via authenticatedIdentityServer): this
            // request must also work when the session turns out to be expired or invalid,
            // in which case the server simply treats it as unauthenticated.
            const accessToken = session.currentAccessToken;
            const response = await session.identityServer.request({
                method: 'POST',
                path: '/verify-email',
                body: VerifyEmailRequest.create({
                    code,
                    token,
                }),
                decoder: Token as Decoder<Token>,
                headers: accessToken ? { Authorization: 'Bearer ' + accessToken } : undefined,
            });
            try {
                session.preventComplete = true;
                await session.setToken(response.data);
                await SessionManager.prepareSessionForUsage(session, false);
            } finally {
                session.preventComplete = false;
            }
            return {};
        } catch (e) {
            if (isSimpleError(e) || isSimpleErrors(e)) {
                if (e.hasCode('invalid_code')) {
                    // Check if we are now logged in (link might have been opened in a new tab)
                    await session.loadFromStorage();
                    await SessionManager.prepareSessionForUsage(session, false);
                    if (session.user && session.user.verified && session.canGetCompleted()) {
                        // All good
                        return {};
                    }
                }
            }

            // The email address is verified, but the user still needs to pass (or set up)
            // a second factor before we can hand out a session.
            return await this.returnLoginResultOrThrow(session, e);
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
        } catch (e) {
            return await this.returnLoginResultOrThrow(session, e);
        }

        await this.applyToken(session, tokenResponse.data);
        return {};
    }

    /**
     * Trade a password token (invite / password reset link) for a session.
     */
    static async loginWithPasswordToken(
        session: SessionContext,
        passwordToken: string,
    ): Promise<LoginResult> {
        let tokenResponse: RequestResult<Token>;
        try {
            session.setLoadingError(null);
            tokenResponse = await session.identityServer.request({
                method: 'POST',
                path: '/oauth/token',
                body: {
                    grant_type: 'password_token',
                    token: passwordToken,
                },
                decoder: Token as Decoder<Token>,
                shouldRetry: false,
            });
        } catch (e) {
            return await this.returnLoginResultOrThrow(session, e);
        }

        await this.applyToken(session, tokenResponse.data);
        return {};
    }

    private static async returnLoginResultOrThrow(session: SessionContext, e: unknown): Promise<LoginResult> {
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
                const meta = MFASetupResponse.decode(new ObjectData(setupError.meta, { version: Version }));

                if (meta.token) {
                    // A temporary session token was included (password token grant): apply
                    // it so the caller can already act on behalf of the user - e.g. let
                    // them choose a password - before the enrollment is finished.
                    await this.applyToken(session, meta.token);
                }

                return {
                    mfaSetup: meta,
                };
            }
        }
        throw e;
    }

    /**
     * Apply a freshly obtained token to the session and prepare it for usage.
     *
     * A session with storage disabled is a temporary session (e.g. the password reset
     * flow): it only loads the user, it is never promoted to the session of the app.
     */
    private static async applyToken(session: SessionContext, token: Token): Promise<void> {
        if (session.isStorageDisabled) {
            await session.setToken(token);
            await session.updateData(false, false);
            return;
        }

        if (!session.isComplete()) {
            // Only start loading until finished if we are not displaying a logged in user yet
            // otherwise we lose the current state of the app / navigation
            session.preventComplete = true;
        }
        try {
            await session.setToken(token);
            await SessionManager.prepareSessionForUsage(session);
        } finally {
            session.preventComplete = false;
        }
    }

    /**
     * Ask which second factors can complete a pending login.
     *
     * A password login receives the challenge straight away, in the `require_mfa` error.
     * An SSO login ends in a browser redirect that can only carry the token itself, so the
     * rest of the challenge is fetched here.
     */
    static async fetchMfaChallenge(session: SessionContext, mfaToken: string): Promise<MFAChallengeResponse> {
        const response = await session.identityServer.request({
            method: 'POST',
            path: '/mfa/challenge',
            body: MFAChallengeRequest.create({ token: mfaToken }),
            decoder: MFAChallengeResponse as Decoder<MFAChallengeResponse>,
            shouldRetry: false,
        });
        return response.data;
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

    static async verifyMfaPasskey(session: SessionContext, mfaToken: string, webauthnAuthenticationOptions: unknown): Promise<boolean> {
        // These options are opaque JSON generated by our own server (@simplewebauthn) and
        // handed straight to the browser API, so we assert the concrete type here.
        let a: Awaited<ReturnType<typeof startAuthentication>>;
        try {
            a = await startAuthentication({ optionsJSON: webauthnAuthenticationOptions as PublicKeyCredentialRequestOptionsJSON });
        } catch (error) {
            if (
                error instanceof Error
                && error.name === 'NotAllowedError'
            ) {
                // Cancellation, timeout, denied interaction, invalid context, etc.
                return false;
            }
            throw error;
        }

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
        return true;
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
        organization.deepSet(response.data.organization);

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
        } catch (e) {
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
