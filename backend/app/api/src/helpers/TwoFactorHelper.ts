import { SimpleError } from '@simonbackx/simple-errors';
import type { I18n } from '@stamhoofd/backend-i18n/I18n';
import type { SessionLoginMethod, User } from '@stamhoofd/models';
import { MFARecoveryCode, MFATOTP, MFAToken, Organization, Platform, RateLimiter, Token, WebauthnCredential } from '@stamhoofd/models';
import type { User as UserStruct } from '@stamhoofd/structures';
import { MFAChallengeResponse, MFAEnrollmentResult, MFAMethodType, MFASetupResponse, MFAStatus, PasskeyCredential, RecoveryCodes, TOTPCredential, Token as TokenStruct } from '@stamhoofd/structures';

import type { PublicKeyCredentialRequestOptionsJSON } from '@simplewebauthn/server';

import { PasswordForgotService } from '../services/PasswordForgotService.js';
import { SessionService } from '../services/SessionService.js';
import { RecoveryCodeHelper } from './RecoveryCodeHelper.js';
import { WebauthnHelper } from './WebauthnHelper.js';
import { Formatter, Sorter } from '@stamhoofd/utility';

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

/**
 * An admin who has to enroll a second factor, but never did, first has to prove they still
 * read the email address on the account when they were inactive for this long. A dormant
 * account is the one most likely to have a leaked or reused password, and enrolling a
 * factor with only that password would hand the account to whoever holds it — protected by
 * the very second factor the organization asked for.
 */
export const INACTIVE_ADMIN_ENROLLMENT_DAYS = 45;

/**
 * The confirmation email is triggered by a login attempt, so cap how often one account can
 * send it: whoever knows the password could otherwise flood the mailbox. Like every rate
 * limiter here this counts per process and in a window shared by all keys, so it thins out
 * a flood rather than enforcing an exact number of emails.
 */
const enrollmentConfirmationRateLimiter = new RateLimiter({
    limits: [
        {
            limit: 3,
            duration: 60 * 60 * 1000,
        },
        {
            limit: 10,
            duration: 24 * 60 * 60 * 1000,
        },
    ],
});

/**
 * What still has to happen before a session may be issued for a user whose primary
 * credential was just accepted.
 */
export type SecondFactorRequirement
    = | { type: 'none' }
        | { type: 'challenge'; challenge: MFAChallengeResponse }
        | { type: 'setup'; setupToken: MFAToken }
        | { type: 'confirm-email' };

export class TwoFactorHelper {
    /**
     * Whether the user is required to have 2FA. Evaluated only on the password grant;
     * SSO/Google logins are trusted to provide their own 2FA.
     */
    static async isTwoFactorRequired(user: User, organization: Organization | null): Promise<boolean> {
        const perms = user.permissions;
        if (!perms) {
            return false;
        }
        // The platform can require 2FA for its users with platform permissions.
        if (perms.globalPermissions !== null) {
            const platform = await Platform.getSharedPrivateStruct();
            if (platform.privateConfig.requireTwoFactor) {
                return true;
            }
        }

        // Organizations can require 2FA for their users with permissions.
        //
        // This looks at EVERY organization the user has permissions in, not only the one
        // in scope. The scope is derived from the API host, so an admin could otherwise
        // sidestep their organization's requirement by signing in on the platform
        // (unscoped) host — the resulting session is not restricted to that host and
        // gives them access to the organization anyway. For the same reason it also
        // decides whether the last factor may be removed.
        const organizationIds = [...perms.organizationPermissions.keys()];
        if (organizationIds.length === 0) {
            return false;
        }

        // Reuse the organization we already have in memory instead of fetching it again.
        if (organization && organizationIds.includes(organization.id) && organization.privateMeta?.requireTwoFactor) {
            return true;
        }

        const remaining = organizationIds.filter(id => id !== organization?.id);
        if (remaining.length === 0) {
            return false;
        }

        for (const other of await Organization.getByIDs(...remaining)) {
            if (other.privateMeta?.requireTwoFactor) {
                return true;
            }
        }
        return false;
    }

    /**
     * Whether the account was unused for long enough that its password alone is no longer
     * enough to start a forced enrollment. Accounts that never signed in fall back to their
     * creation date, so an admin who was just invited is not locked out right away.
     */
    static isInactiveForEnrollment(user: User): boolean {
        const lastActiveAt = user.lastActiveAt ?? user.createdAt;
        return lastActiveAt.getTime() < Date.now() - INACTIVE_ADMIN_ENROLLMENT_DAYS * 24 * 60 * 60 * 1000;
    }

    /**
     * What still has to happen before a session may be handed out, after a primary
     * credential was accepted.
     *
     * `loginMethod` describes the credential that was just verified:
     *  - 'password': the account password. A single credential that says nothing about
     *    whether the user still reads the email address on the account, so a required
     *    second factor must be set up here if the user does not have one yet — and a
     *    long-inactive admin has to confirm their email address before they may.
     *  - 'email': a password token or email verification code. Also a single credential,
     *    but one that only reaches someone who reads the account's email, so it is the way
     *    out of that email confirmation.
     *  - 'sso': an external identity provider already authenticated the user, and is
     *    trusted to apply its own second factor. An enrolled factor is still verified
     *    (the user asked us to protect their account), but we do not force enrollment —
     *    unless the account ALSO has a password, because then the password remains a way
     *    in that bypasses whatever the provider enforces.
     */
    static async getSecondFactorRequirement(user: User, organization: Organization | null, { loginMethod }: { loginMethod: SessionLoginMethod }): Promise<SecondFactorRequirement> {
        if (await TwoFactorHelper.userHasFactors(user.id)) {
            return { type: 'challenge', challenge: await TwoFactorHelper.createLoginChallenge(user, { loginMethod }) };
        }

        if (loginMethod === 'sso' && !user.hasPasswordBasedAccount()) {
            return { type: 'none' };
        }

        if (await TwoFactorHelper.isTwoFactorRequired(user, organization)) {
            if (loginMethod === 'password' && TwoFactorHelper.isInactiveForEnrollment(user)) {
                return { type: 'confirm-email' };
            }
            return { type: 'setup', setupToken: await MFAToken.createFor(user.id, 'setup', { loginMethod }) };
        }

        return { type: 'none' };
    }

    /**
     * Send the password recovery link a long-inactive admin needs to get back to enrolling
     * their second factor. Never throws: the login is blocked either way, and turning a
     * mail failure into a 500 would only hide why the user cannot sign in.
     */
    static async sendEnrollmentConfirmationEmail(user: User, organization: Organization | null, i18n: I18n): Promise<void> {
        try {
            enrollmentConfirmationRateLimiter.track(user.id);
        }
        catch {
            // Sent often enough already.
            return;
        }

        try {
            await PasswordForgotService.sendPasswordRecoveryEmail(user, organization, i18n);
        }
        catch (e) {
            console.error('Could not send the two-factor enrollment confirmation email', e);
        }
    }

    /**
     * Enforce the second-factor / forced-enrollment step after a successful primary
     * authentication (password login, password-reset token, email verification). Throws a
     * `require_mfa`, `require_mfa_setup` or `require_email_confirmation` error when the user
     * must still do something before a session may be issued; returns normally when the
     * login may proceed. The last one also emails the user the link they need to get past it.
     *
     * This MUST be called from every path that mints a full session from a single primary
     * credential, otherwise that path becomes an MFA bypass. The SSO callback is a redirect
     * instead of a request/response pair, so it uses getSecondFactorRequirement() directly.
     *
     * `allowTemporarySession` adds a normal session token to the forced-enrollment error.
     * Only pass it for the password-token grant: the user has no second factor yet, so
     * whoever holds the link could enroll one and get a session anyway, and the client
     * needs a session to let the user choose a password before enrolling.
     */
    static async assertSecondFactorOrThrow(user: User, organization: Organization | null, version: number, { loginMethod, i18n, allowTemporarySession = false }: { loginMethod: 'password' | 'email'; i18n: I18n; allowTemporarySession?: boolean }): Promise<void> {
        const requirement = await TwoFactorHelper.getSecondFactorRequirement(user, organization, { loginMethod });

        if (requirement.type === 'confirm-email') {
            await TwoFactorHelper.sendEnrollmentConfirmationEmail(user, organization, i18n);

            throw new SimpleError({
                code: 'require_email_confirmation',
                message: 'Email confirmation required before two-factor authentication setup',
                human: $t('%Zjm', { days: INACTIVE_ADMIN_ENROLLMENT_DAYS.toString() }),
                statusCode: 403,
            });
        }

        if (requirement.type === 'challenge') {
            throw new SimpleError({
                code: 'require_mfa',
                message: 'Two-factor authentication required',
                human: $t('%ZhQ'),
                meta: requirement.challenge.encode({ version }),
                statusCode: 403,
            });
        }

        if (requirement.type === 'setup') {
            const temporaryToken = allowTemporarySession ? new TokenStruct(await SessionService.createSession(user, { loginMethod, authenticatedAt: new Date() })) : null;

            throw new SimpleError({
                code: 'require_mfa_setup',
                message: 'Two-factor authentication setup required',
                human: $t('%Zh8'),
                meta: MFASetupResponse.create({
                    setupToken: requirement.setupToken.token,
                    token: temporaryToken,
                    canUsePasskeys: user.canUsePasskeys(),
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

    /**
     * Which of these users have at least one enrolled factor.
     *
     * Batched on purpose: the admin lists show this for every row, so asking per user
     * would be a query per row.
     */
    static async filterUserIdsWithFactors(userIds: string[]): Promise<Set<string>> {
        const unique = Formatter.uniqueArray(userIds);
        if (unique.length === 0) {
            return new Set();
        }

        const [totp, passkeys] = await Promise.all([
            MFATOTP.select().where('userId', unique).where('confirmedAt', '!=', null).fetch(),
            WebauthnCredential.select().where('userId', unique).fetch(),
        ]);

        return new Set([...totp.map(t => t.userId), ...passkeys.map(p => p.userId)]);
    }

    /**
     * Fill in `hasTwoFactor` on already built user structures. This is not part of
     * User.getStructure() because it lives in other tables: it is loaded for all the
     * users of a response at once.
     */
    static async fillTwoFactorStatus(users: UserStruct[]): Promise<void> {
        if (users.length === 0) {
            return;
        }

        const withFactors = await TwoFactorHelper.filterUserIdsWithFactors(users.map(u => u.id));
        for (const user of users) {
            user.hasTwoFactor = withFactors.has(user.id);
        }
    }

    static async getEnrolledMethods(userId: string): Promise<{ methods: MFAMethodType[]; passkeys: WebauthnCredential[] }> {
        const totp = await MFATOTP.getConfirmedForUser(userId);
        const recovery = await MFARecoveryCode.getUnusedForUser(userId);

        // Only passkeys of the RP ID we authenticate against can actually be used; the
        // authenticator will not release the others.
        const passkeys = WebauthnHelper.filterForCurrentRpID(await WebauthnCredential.getForUser(userId));

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
    static async createLoginChallenge(user: User, { loginMethod }: { loginMethod: SessionLoginMethod }): Promise<MFAChallengeResponse> {
        const { methods, passkeys } = await TwoFactorHelper.getEnrolledMethods(user.id);

        let webauthnOptions: PublicKeyCredentialRequestOptionsJSON | null = null;
        let challenge: string | null = null;
        if (passkeys.length > 0) {
            webauthnOptions = await WebauthnHelper.generateAuthentication(passkeys);
            challenge = webauthnOptions.challenge;
        }

        const mfaToken = await MFAToken.createFor(user.id, 'login', { webauthnChallenge: challenge, loginMethod });

        return MFAChallengeResponse.create({
            token: mfaToken.token,
            methods,
            webauthnAuthenticationOptions: webauthnOptions,
        });
    }

    /**
     * Rebuild the challenge payload for a login MFA token that already exists.
     *
     * The SSO callback is a browser redirect, so it can only pass the token itself back to
     * the client; the client then asks for the rest of the challenge. A new WebAuthn
     * challenge is generated and stored on the token, replacing the previous one (the
     * client never received it, and only the stored one is accepted).
     */
    static async describeLoginChallenge(mfaToken: MFAToken): Promise<MFAChallengeResponse> {
        const { methods, passkeys } = await TwoFactorHelper.getEnrolledMethods(mfaToken.userId);

        let webauthnOptions: PublicKeyCredentialRequestOptionsJSON | null = null;
        if (passkeys.length > 0) {
            webauthnOptions = await WebauthnHelper.generateAuthentication(passkeys);
            mfaToken.webauthnChallenge = webauthnOptions.challenge;
            await mfaToken.save();
        }

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
     *
     * `currentToken` is the session the request was made with (null during forced
     * enrollment, where there is no session yet). Every OTHER session of the user is
     * signed out: enrolling a factor is how a user reacts to a suspected compromise, so it
     * has to end the sessions they did not make this request from.
     */
    static async completeEnrollment(user: User, setupToken: MFAToken | null, wasFirstFactor: boolean, currentToken: Token | null): Promise<MFAEnrollmentResult> {
        let recoveryCodes: RecoveryCodes | null = null;
        if (wasFirstFactor) {
            const codes = await RecoveryCodeHelper.regenerateForUser(user.id);
            recoveryCodes = RecoveryCodes.create({ codes });
        }

        // Before minting the new session, so it is never signed out by its own enrollment.
        await Token.deleteOtherSessions(user.id, currentToken?.accessToken ?? null);

        let token: TokenStruct | null = null;
        if (setupToken) {
            await setupToken.consume();
            const t = await SessionService.createSession(user, { loginMethod: setupToken.loginMethod, authenticatedAt: new Date() });
            await user.markActive();
            token = new TokenStruct(t);
        }

        const status = await TwoFactorHelper.buildStatus(user);
        return MFAEnrollmentResult.create({ status, token, recoveryCodes });
    }

    /**
     * Clean up after a factor was deleted.
     *
     * Recovery codes exist to get back in when the enrolled factors are unavailable, so
     * they are meaningless — and an unnecessary long-lived credential — once the last
     * factor is gone. Every other session is signed out for the same reason enrollment
     * does it: removing a factor is a security-relevant change to the account.
     */
    static async completeRemoval(user: User, currentToken: Token | null): Promise<MFAStatus> {
        if (!(await TwoFactorHelper.userHasFactors(user.id))) {
            await MFARecoveryCode.deleteForUser(user.id);
        }

        await Token.deleteOtherSessions(user.id, currentToken?.accessToken ?? null);

        return await TwoFactorHelper.buildStatus(user);
    }

    static async buildStatus(user: User): Promise<MFAStatus> {
        const userId = user.id;
        const totp = await MFATOTP.getConfirmedForUser(userId);
        const passkeys = await WebauthnCredential.getForUser(userId);
        const recovery = await MFARecoveryCode.getUnusedForUser(userId);

        return MFAStatus.create({
            totp: totp.map(t => TOTPCredential.create({
                id: t.id,
                name: t.name,
                createdAt: t.createdAt,
                lastUsedAt: t.lastUsedAt,
            })).sort((a, b) => Sorter.byDateValue(a.lastUsedAt ?? a.createdAt, b.lastUsedAt ?? b.createdAt)),
            passkeys: passkeys.map(p => PasskeyCredential.create({
                id: p.id,
                name: p.name,
                createdAt: p.createdAt,
                lastUsedAt: p.lastUsedAt,
                providerId: p.providerId,
                providerName: p.providerName,
                transports: p.transportsArray,
            })).sort((a, b) => Sorter.byDateValue(a.lastUsedAt ?? a.createdAt, b.lastUsedAt ?? b.createdAt)),
            hasRecoveryCodes: recovery.length > 0,
            recoveryCodesRemaining: recovery.length,
            canUsePasskeys: user.canUsePasskeys(),
        });
    }
}
