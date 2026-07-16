import { SimpleError } from '@simonbackx/simple-errors';
import type { Organization, User } from '@stamhoofd/models';
import { MFARecoveryCode, MFATOTP, MFAToken, RateLimiter, Token, WebauthnCredential } from '@stamhoofd/models';
import { MFAChallengeResponse, MFAEnrollmentResult, MFAMethodType, MFASetupResponse, MFAStatus, PasskeyCredential, RecoveryCodes, TOTPCredential, Token as TokenStruct } from '@stamhoofd/structures';

import type { PublicKeyCredentialRequestOptionsJSON } from '@simplewebauthn/server';

import { RecoveryCodeHelper } from './RecoveryCodeHelper.js';
import { WebauthnHelper } from './WebauthnHelper.js';

/**
 * Aggregate brute-force protection for second-factor verification, keyed by user id.
 * A single per-token try counter is not enough: an attacker who knows the password can
 * mint unlimited login MFA tokens, so we also cap the total number of failed verification
 * attempts per user across all of their tokens.
 */
export const mfaVerificationRateLimiter = new RateLimiter({
    limits: [
        {
            limit: 10,
            duration: 60 * 1000, // 10 failed attempts per minute
        },
        {
            limit: 30,
            duration: 60 * 60 * 1000, // 30 failed attempts per hour
        },
    ],
});

export class TwoFactorHelper {
    /**
     * Whether the user is required to have 2FA. Evaluated only on the password grant;
     * SSO/Google logins are trusted to provide their own 2FA.
     */
    static isTwoFactorRequired(user: User, organization: Organization | null): boolean {
        const perms = user.permissions;
        if (!perms) {
            return false;
        }
        // Global/platform-permission users always require 2FA.
        if (perms.globalPermissions !== null) {
            return true;
        }
        // Organizations can require 2FA for their users with permissions.
        if (organization && organization.privateMeta?.requireTwoFactor) {
            if (perms.organizationPermissions.get(organization.id)) {
                return true;
            }
        }
        return false;
    }

    /**
     * Enforce the second-factor / forced-enrollment step after a successful primary
     * authentication (password login, password-reset token, email verification). Throws a
     * `require_mfa` or `require_mfa_setup` error when the user must still complete a second
     * factor before a session may be issued; returns normally when the login may proceed.
     *
     * This MUST be called from every path that mints a full session from a single primary
     * credential, otherwise that path becomes an MFA bypass.
     */
    static async assertSecondFactorOrThrow(user: User, organization: Organization | null, version: number): Promise<void> {
        if (await TwoFactorHelper.userHasFactors(user.id)) {
            const challenge = await TwoFactorHelper.createLoginChallenge(user);
            throw new SimpleError({
                code: 'require_mfa',
                message: 'Two-factor authentication required',
                human: $t('Tweestapsverificatie is vereist om aan te melden.'),
                meta: challenge.encode({ version }),
                statusCode: 403,
            });
        }

        if (TwoFactorHelper.isTwoFactorRequired(user, organization)) {
            const setup = await MFAToken.createFor(user.id, 'setup');
            throw new SimpleError({
                code: 'require_mfa_setup',
                message: 'Two-factor authentication setup required',
                human: $t('Tweestapsverificatie is verplicht door jouw organisatie. Je moet tweestapsverificatie instellen voor je verder kan.'),
                meta: MFASetupResponse.create({
                    setupToken: setup.token,
                }).encode({ version }),
                statusCode: 403,
            });
        }
    }

    static async userHasFactors(userId: string): Promise<boolean> {
        const totp = await MFATOTP.getConfirmedForUser(userId);
        if (totp.length > 0) {
            return true;
        }
        const passkeys = await WebauthnCredential.getForUser(userId);
        return passkeys.length > 0;
    }

    static async getEnrolledMethods(userId: string): Promise<{ methods: MFAMethodType[]; passkeys: WebauthnCredential[] }> {
        const totp = await MFATOTP.getConfirmedForUser(userId);
        const passkeys = await WebauthnCredential.getForUser(userId);
        const recovery = await MFARecoveryCode.getUnusedForUser(userId);

        const methods: MFAMethodType[] = [];
        if (totp.length > 0) {
            methods.push(MFAMethodType.TOTP);
        }
        if (passkeys.length > 0) {
            methods.push(MFAMethodType.Passkey);
        }
        if (recovery.length > 0) {
            methods.push(MFAMethodType.RecoveryCode);
        }
        return { methods, passkeys };
    }

    /**
     * Create a login MFA session token and the challenge payload returned to the client.
     */
    static async createLoginChallenge(user: User): Promise<MFAChallengeResponse> {
        const { methods, passkeys } = await TwoFactorHelper.getEnrolledMethods(user.id);

        let webauthnOptions: PublicKeyCredentialRequestOptionsJSON | null = null;
        let challenge: string | null = null;
        if (passkeys.length > 0) {
            webauthnOptions = await WebauthnHelper.generateAuthentication(passkeys);
            challenge = webauthnOptions.challenge;
        }

        const mfaToken = await MFAToken.createFor(user.id, 'login', challenge);

        return MFAChallengeResponse.create({
            token: mfaToken.token,
            methods,
            webauthnAuthenticationOptions: webauthnOptions,
        });
    }

    /**
     * Finish an enrollment action. Generates recovery codes when this was the user's
     * first factor, and (during forced enrollment) consumes the setup token and issues a
     * full, fresh session token. `wasFirstFactor` must be computed before persisting the
     * new factor.
     */
    static async completeEnrollment(user: User, setupToken: MFAToken | null, wasFirstFactor: boolean): Promise<MFAEnrollmentResult> {
        let recoveryCodes: RecoveryCodes | null = null;
        if (wasFirstFactor) {
            const codes = await RecoveryCodeHelper.regenerateForUser(user.id);
            recoveryCodes = RecoveryCodes.create({ codes });
        }

        let token: TokenStruct | null = null;
        if (setupToken) {
            await setupToken.consume();
            const t = await Token.createToken(user, new Date());
            token = new TokenStruct(t);
        }

        const status = await TwoFactorHelper.buildStatus(user.id);
        return MFAEnrollmentResult.create({ status, token, recoveryCodes });
    }

    static async buildStatus(userId: string): Promise<MFAStatus> {
        const totp = await MFATOTP.getConfirmedForUser(userId);
        const passkeys = await WebauthnCredential.getForUser(userId);
        const recovery = await MFARecoveryCode.getUnusedForUser(userId);

        return MFAStatus.create({
            totp: totp.map(t => TOTPCredential.create({
                id: t.id,
                name: t.name,
                createdAt: t.createdAt,
                lastUsedAt: t.lastUsedAt,
            })),
            passkeys: passkeys.map(p => PasskeyCredential.create({
                id: p.id,
                name: p.name,
                createdAt: p.createdAt,
                lastUsedAt: p.lastUsedAt,
                providerId: p.providerId,
                providerName: p.providerName,
            })),
            hasRecoveryCodes: recovery.length > 0,
            recoveryCodesRemaining: recovery.length,
        });
    }
}
