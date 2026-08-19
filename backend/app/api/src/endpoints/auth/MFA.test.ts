import { Endpoint, Request } from '@simonbackx/simple-endpoints';
import { isSimpleError, isSimpleErrors, SimpleError } from '@simonbackx/simple-errors';
import { EmailMocker } from '@stamhoofd/email';
import { AuditLog, EmailTemplateFactory, EmailVerificationCode, MFARecoveryCode, MFATOTP, MFAToken, Organization, PasswordToken, Platform, Token, User, UserFactory, OrganizationFactory, UserSession, WebauthnChallenge, WebauthnCredential } from '@stamhoofd/models';
import { AuditLogReplacementType, AuditLogType, EmailTemplateType, MFAMethodType, PermissionLevel, Permissions, SessionLoginMethod, Token as TokenStruct } from '@stamhoofd/structures';
import { authenticator } from 'otplib';
import crypto from 'crypto';

import { MFATestHelper } from '../../../tests/helpers/MFATestHelper.js';
import { testServer } from '../../../tests/helpers/TestServer.js';
import { RECOVERY_CODE_ALPHABET, RecoveryCodeHelper } from '../../helpers/RecoveryCodeHelper.js';
import { INACTIVE_ADMIN_ENROLLMENT_DAYS, TwoFactorHelper } from '../../helpers/TwoFactorHelper.js';
import { WebauthnHelper } from '../../helpers/WebauthnHelper.js';
import { PasswordForgotService } from '../../services/PasswordForgotService.js';
import { ConfirmTOTPEndpoint } from './ConfirmTOTPEndpoint.js';
import { CreateTokenEndpoint } from './CreateTokenEndpoint.js';
import { DeletePasskeyEndpoint } from './DeletePasskeyEndpoint.js';
import { DeleteTOTPEndpoint } from './DeleteTOTPEndpoint.js';
import { GetMFAChallengeEndpoint } from './GetMFAChallengeEndpoint.js';
import { GetMFAStatusEndpoint } from './GetMFAStatusEndpoint.js';
import { RegenerateRecoveryCodesEndpoint } from './RegenerateRecoveryCodesEndpoint.js';
import { RegisterPasskeyEndpoint } from './RegisterPasskeyEndpoint.js';
import { RegisterPasskeyOptionsEndpoint } from './RegisterPasskeyOptionsEndpoint.js';
import { SetupTOTPEndpoint } from './SetupTOTPEndpoint.js';
import { VerifyEmailEndpoint } from './VerifyEmailEndpoint.js';

const tokenEndpoint = new CreateTokenEndpoint();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function firstError(e: unknown): SimpleError {
    if (isSimpleErrors(e)) {
        return e.errors[0];
    }
    if (isSimpleError(e)) {
        return e;
    }
    throw new Error('Not a SimpleError: ' + String(e));
}

async function captureError(promise: Promise<unknown>): Promise<SimpleError> {
    try {
        await promise;
    }
    catch (e) {
        return firstError(e);
    }
    throw new Error('Expected the request to throw');
}

async function addConfirmedTOTP(user: User): Promise<{ id: string; secret: string }> {
    return await MFATestHelper.addConfirmedTOTP(user, 'Confirmed authenticator');
}

/**
 * A user without an organization of their own: the only kind that may use passkeys.
 * In organization mode the factory only leaves organizationId null for platform admins.
 */
async function platformUser(): Promise<User> {
    const user = await new UserFactory({ password, globalPermissions: Permissions.create({ level: PermissionLevel.None }) }).create();
    expect(user.organizationId).toBeNull();
    return user;
}

const twoFactorLogTypes = [AuditLogType.UserTwoFactorMethodAdded, AuditLogType.UserTwoFactorMethodDeleted, AuditLogType.UserRecoveryCodesRegenerated];

/**
 * The two-factor audit logs of a user, oldest first (the ids are uuidv7, so they sort by
 * creation). Other logs about the same account (e.g. UserAdded) are left out.
 */
async function twoFactorLogs(user: User): Promise<AuditLog[]> {
    const logs = await AuditLog.select().where('objectId', user.id).fetch();
    return logs
        .filter(l => twoFactorLogTypes.includes(l.type))
        .sort((a, b) => a.id.localeCompare(b.id));
}

async function addPasskey(user: User, credentialId?: string): Promise<WebauthnCredential> {
    const credential = new WebauthnCredential();
    credential.userId = user.id;
    credential.credentialId = credentialId ?? 'cred-' + crypto.randomBytes(16).toString('base64url');
    credential.publicKey = crypto.randomBytes(32).toString('base64url');
    credential.counter = 0;
    credential.name = 'Test passkey';
    await credential.save();
    return credential;
}

function passwordLogin(organization: Organization | null, email: string, password: string) {
    return Request.buildJson('POST', '/oauth/token', organization?.getApiHost(), {
        grant_type: 'password',
        username: email,
        password,
    });
}

function mfaGrant(organization: Organization, body: Record<string, unknown>) {
    return Request.buildJson('POST', '/oauth/token', organization.getApiHost(), { grant_type: 'mfa', ...body });
}

function bearer(request: Request, token: Token) {
    request.headers.authorization = 'Bearer ' + token.accessToken;
    return request;
}

async function freshToken(user: User): Promise<Token> {
    return await Token.createToken(user, new Date());
}

async function staleToken(user: User): Promise<Token> {
    // A token as produced by a refresh_token rotation (never authenticatedAt).
    return await Token.createToken(user);
}

async function requireMfa(organization: Organization | null, email: string, password: string): Promise<{ token: string; methods: string[]; webauthnAuthenticationOptions: unknown }> {
    const err = await captureError(testServer.test(tokenEndpoint, passwordLogin(organization, email, password)));
    expect(err.code).toBe('require_mfa');
    return err.meta as { token: string; methods: string[]; webauthnAuthenticationOptions: unknown };
}

/**
 * The platform row is shared by every test file, so tests that flip this have to reset it
 * again (see the afterEach below).
 */
async function setPlatformRequiresTwoFactor(requireTwoFactor: boolean) {
    const platform = await Platform.getForEditing();
    platform.privateConfig.requireTwoFactor = requireTwoFactor;
    await platform.save();
}

const password = 'test-password-1234';

describe('MFA', () => {
    afterEach(async () => {
        await setPlatformRequiresTwoFactor(false);
    });

    // -----------------------------------------------------------------------
    // Login: challenge selection
    // -----------------------------------------------------------------------
    describe('login challenge', () => {
        test('a user without factors logs in normally', async () => {
            const organization = await new OrganizationFactory({}).create();
            const user = await new UserFactory({ organization, password }).create();

            const response = await testServer.test(tokenEndpoint, passwordLogin(organization, user.email, password));
            expect(response.body).toBeInstanceOf(TokenStruct);
        });

        test('a user with a TOTP is challenged with require_mfa (no session token)', async () => {
            const organization = await new OrganizationFactory({}).create();
            const user = await new UserFactory({ organization, password }).create();
            await addConfirmedTOTP(user);

            const challenge = await requireMfa(organization, user.email, password);
            expect(challenge.token).toBeTruthy();
            expect(challenge.methods).toContain('TOTP');
            expect(challenge.methods).not.toContain('Passkey');
            expect(challenge.webauthnAuthenticationOptions).toBeNull();
        });

        test('a user with a passkey gets webauthn options in the challenge', async () => {
            const organization = await new OrganizationFactory({}).create();
            const user = await new UserFactory({ organization, password }).create();
            await addPasskey(user);
            await addConfirmedTOTP(user);
            await RecoveryCodeHelper.regenerateForUser(user.id);

            const challenge = await requireMfa(organization, user.email, password);
            expect(challenge.methods).toEqual(expect.arrayContaining(['TOTP', 'Passkey', 'RecoveryCode']));
            expect(challenge.webauthnAuthenticationOptions).not.toBeNull();
            expect((challenge.webauthnAuthenticationOptions as { challenge?: string }).challenge).toBeTruthy();
        });

        test('a wrong password is rejected before any challenge', async () => {
            const organization = await new OrganizationFactory({}).create();
            const user = await new UserFactory({ organization, password }).create();
            await addConfirmedTOTP(user);

            const err = await captureError(testServer.test(tokenEndpoint, passwordLogin(organization, user.email, 'wrong-password')));
            expect(err.code).toBe('invalid_username_or_password');
        });
    });

    // -----------------------------------------------------------------------
    // Login: TOTP grant
    // -----------------------------------------------------------------------
    describe('mfa grant - TOTP', () => {
        test('valid code issues a fresh token and consumes the mfa token', async () => {
            const organization = await new OrganizationFactory({}).create();
            const user = await new UserFactory({ organization, password }).create();
            const { secret } = await addConfirmedTOTP(user);
            const challenge = await requireMfa(organization, user.email, password);

            const response = await testServer.test(tokenEndpoint, mfaGrant(organization, { mfa_token: challenge.token, method: 'TOTP', code: authenticator.generate(secret) }));
            expect(response.body).toBeInstanceOf(TokenStruct);

            const dbToken = await Token.getByAccessToken((response.body as TokenStruct).accessToken);
            expect(dbToken).toBeDefined();
            expect(dbToken!.isFresh()).toBe(true);

            // consumed
            const replay = await captureError(testServer.test(tokenEndpoint, mfaGrant(organization, { mfa_token: challenge.token, method: 'TOTP', code: authenticator.generate(secret) })));
            expect(replay.code).toBe('invalid_mfa_token');
        });

        test('any of the user\'s multiple authenticators can complete the login', async () => {
            const organization = await new OrganizationFactory({}).create();
            const user = await new UserFactory({ organization, password }).create();
            await addConfirmedTOTP(user);
            const second = await addConfirmedTOTP(user);

            const challenge = await requireMfa(organization, user.email, password);
            const response = await testServer.test(tokenEndpoint, mfaGrant(organization, { mfa_token: challenge.token, method: 'TOTP', code: authenticator.generate(second.secret) }));
            expect(response.body).toBeInstanceOf(TokenStruct);
        });

        test('wrong codes fail and lock the token after max tries', async () => {
            const organization = await new OrganizationFactory({}).create();
            const user = await new UserFactory({ organization, password }).create();
            const { secret } = await addConfirmedTOTP(user);
            const challenge = await requireMfa(organization, user.email, password);

            for (let i = 0; i < 4; i++) {
                const e = await captureError(testServer.test(tokenEndpoint, mfaGrant(organization, { mfa_token: challenge.token, method: 'TOTP', code: '000000' })));
                expect(e.code).toBe('invalid_mfa_code');
            }
            const locked = await captureError(testServer.test(tokenEndpoint, mfaGrant(organization, { mfa_token: challenge.token, method: 'TOTP', code: '000000' })));
            expect(locked.code).toBe('too_many_attempts');

            // even a correct code no longer works
            const afterLock = await captureError(testServer.test(tokenEndpoint, mfaGrant(organization, { mfa_token: challenge.token, method: 'TOTP', code: authenticator.generate(secret) })));
            expect(afterLock.code).toBe('invalid_mfa_token');
        });

        test('an expired mfa token is rejected', async () => {
            const organization = await new OrganizationFactory({}).create();
            const user = await new UserFactory({ organization, password }).create();
            const { secret } = await addConfirmedTOTP(user);
            const challenge = await requireMfa(organization, user.email, password);

            const row = await MFAToken.select().where('token', challenge.token).first(true);
            row.expiresAt = new Date(Date.now() - 1000);
            await row.save();

            const err = await captureError(testServer.test(tokenEndpoint, mfaGrant(organization, { mfa_token: challenge.token, method: 'TOTP', code: authenticator.generate(secret) })));
            expect(err.code).toBe('invalid_mfa_token');
        });

        test('an unknown mfa token is rejected', async () => {
            const organization = await new OrganizationFactory({}).create();
            const err = await captureError(testServer.test(tokenEndpoint, mfaGrant(organization, { mfa_token: 'does-not-exist', method: 'TOTP', code: '000000' })));
            expect(err.code).toBe('invalid_mfa_token');
        });

        test('a non-numeric code is rejected as invalid', async () => {
            const organization = await new OrganizationFactory({}).create();
            const user = await new UserFactory({ organization, password }).create();
            await addConfirmedTOTP(user);
            const challenge = await requireMfa(organization, user.email, password);

            const err = await captureError(testServer.test(tokenEndpoint, mfaGrant(organization, { mfa_token: challenge.token, method: 'TOTP', code: 'abcdef' })));
            expect(err.code).toBe('invalid_mfa_code');
        });
    });

    // -----------------------------------------------------------------------
    // Login: last activity
    // -----------------------------------------------------------------------
    describe('last activity', () => {
        test('a password login only counts as activity once the second factor is passed', async () => {
            const organization = await new OrganizationFactory({}).create();
            const user = await new UserFactory({ organization, password }).create();
            const { secret } = await addConfirmedTOTP(user);

            const challenge = await requireMfa(organization, user.email, password);
            expect((await User.getByID(user.id))!.lastActiveAt).toBeNull();

            await testServer.test(tokenEndpoint, mfaGrant(organization, { mfa_token: challenge.token, method: 'TOTP', code: authenticator.generate(secret) }));
            expect((await User.getByID(user.id))!.lastActiveAt).not.toBeNull();
        });

        test('a wrong second factor does not count as activity', async () => {
            const organization = await new OrganizationFactory({}).create();
            const user = await new UserFactory({ organization, password }).create();
            await addConfirmedTOTP(user);

            const challenge = await requireMfa(organization, user.email, password);
            const err = await captureError(testServer.test(tokenEndpoint, mfaGrant(organization, { mfa_token: challenge.token, method: 'TOTP', code: '000000' })));
            expect(err.code).toBe('invalid_mfa_code');

            expect((await User.getByID(user.id))!.lastActiveAt).toBeNull();
        });
    });

    // -----------------------------------------------------------------------
    // Login: recovery codes
    // -----------------------------------------------------------------------
    describe('mfa grant - recovery codes', () => {
        test('a recovery code logs in, is single-use, and other codes still work', async () => {
            const organization = await new OrganizationFactory({}).create();
            const user = await new UserFactory({ organization, password }).create();
            await addConfirmedTOTP(user);
            const codes = await RecoveryCodeHelper.regenerateForUser(user.id);

            const challenge = await requireMfa(organization, user.email, password);
            const response = await testServer.test(tokenEndpoint, mfaGrant(organization, { mfa_token: challenge.token, method: 'RecoveryCode', code: codes[0] }));
            expect(response.body).toBeInstanceOf(TokenStruct);

            const challenge2 = await requireMfa(organization, user.email, password);
            const reuse = await captureError(testServer.test(tokenEndpoint, mfaGrant(organization, { mfa_token: challenge2.token, method: 'RecoveryCode', code: codes[0] })));
            expect(reuse.code).toBe('invalid_mfa_code');

            const response2 = await testServer.test(tokenEndpoint, mfaGrant(organization, { mfa_token: challenge2.token, method: 'RecoveryCode', code: codes[1] }));
            expect(response2.body).toBeInstanceOf(TokenStruct);
        });

        test('an unknown recovery code is rejected', async () => {
            const organization = await new OrganizationFactory({}).create();
            const user = await new UserFactory({ organization, password }).create();
            await addConfirmedTOTP(user);
            await RecoveryCodeHelper.regenerateForUser(user.id);
            const challenge = await requireMfa(organization, user.email, password);

            const err = await captureError(testServer.test(tokenEndpoint, mfaGrant(organization, { mfa_token: challenge.token, method: 'RecoveryCode', code: 'AAAA-BBBB-CCCC-DDDD' })));
            expect(err.code).toBe('invalid_mfa_code');
        });
    });

    // -----------------------------------------------------------------------
    // Login: passkey grant (crypto happy-path is covered by Playwright)
    // -----------------------------------------------------------------------
    describe('mfa grant - passkey (security/validation)', () => {
        async function passkeyChallenge() {
            const organization = await new OrganizationFactory({}).create();
            const user = await new UserFactory({ organization, password }).create();
            const credential = await addPasskey(user);
            const challenge = await requireMfa(organization, user.email, password);
            return { organization, user, credential, challenge };
        }

        function validAssertionShape(credentialId: string) {
            return {
                id: credentialId,
                rawId: credentialId,
                type: 'public-key',
                response: {
                    clientDataJSON: 'x',
                    authenticatorData: 'x',
                    signature: 'x',
                    userHandle: null,
                },
            };
        }

        test('a malformed (non-object) assertion is rejected with a decode error, not a crash', async () => {
            const { organization, challenge } = await passkeyChallenge();
            // captureError() only resolves for handled SimpleError(s); a 500/crash would rethrow.
            const err = await captureError(testServer.test(tokenEndpoint, mfaGrant(organization, { mfa_token: challenge.token, method: 'Passkey', assertion: 'not-an-object' })));
            expect(err.statusCode ?? 400).toBeLessThan(500);
        });

        test('an assertion for an unknown credential is rejected', async () => {
            const { organization, challenge } = await passkeyChallenge();
            const err = await captureError(testServer.test(tokenEndpoint, mfaGrant(organization, { mfa_token: challenge.token, method: 'Passkey', assertion: validAssertionShape('unknown-credential') })));
            expect(err.code).toBe('invalid_mfa_code');
        });

        test('an assertion for another user\'s credential is rejected', async () => {
            const { organization, challenge } = await passkeyChallenge();
            const otherUser = await new UserFactory({ organization, password }).create();
            const otherCredential = await addPasskey(otherUser);

            const err = await captureError(testServer.test(tokenEndpoint, mfaGrant(organization, { mfa_token: challenge.token, method: 'Passkey', assertion: validAssertionShape(otherCredential.credentialId) })));
            expect(err.code).toBe('invalid_mfa_code');
        });

        test('a well-formed but cryptographically invalid assertion is rejected', async () => {
            const { organization, credential, challenge } = await passkeyChallenge();
            const err = await captureError(testServer.test(tokenEndpoint, mfaGrant(organization, { mfa_token: challenge.token, method: 'Passkey', assertion: validAssertionShape(credential.credentialId) })));
            expect(err.code).toBe('invalid_mfa_code');
        });
    });

    // -----------------------------------------------------------------------
    // Enforcement + forced enrollment
    // -----------------------------------------------------------------------
    describe('enforcement', () => {
        async function orgRequiringTwoFactor() {
            const organization = await new OrganizationFactory({}).create();
            organization.privateMeta.requireTwoFactor = true;
            await organization.save();
            return organization;
        }

        test('an org admin without a factor is forced to enroll when the org requires 2FA', async () => {
            const organization = await orgRequiringTwoFactor();
            const user = await new UserFactory({ organization, password, permissions: Permissions.create({ level: PermissionLevel.Full }) }).create();

            const err = await captureError(testServer.test(tokenEndpoint, passwordLogin(organization, user.email, password)));
            expect(err.code).toBe('require_mfa_setup');
            expect((err.meta as { setupToken: string }).setupToken).toBeTruthy();
        });

        test('a member without permissions is NOT forced, even when the org requires 2FA', async () => {
            const organization = await orgRequiringTwoFactor();
            const user = await new UserFactory({ organization, password }).create();

            const response = await testServer.test(tokenEndpoint, passwordLogin(organization, user.email, password));
            expect(response.body).toBeInstanceOf(TokenStruct);
        });

        test('an org admin is NOT forced when the org does not require 2FA', async () => {
            const organization = await new OrganizationFactory({}).create();
            const user = await new UserFactory({ organization, password, permissions: Permissions.create({ level: PermissionLevel.Full }) }).create();

            const response = await testServer.test(tokenEndpoint, passwordLogin(organization, user.email, password));
            expect(response.body).toBeInstanceOf(TokenStruct);
        });

        test('a platform admin without a factor is forced to enroll when the platform requires 2FA', async () => {
            await setPlatformRequiresTwoFactor(true);
            const user = await new UserFactory({ password, globalPermissions: Permissions.create({ level: PermissionLevel.Full }) }).create();

            const err = await captureError(testServer.test(tokenEndpoint, passwordLogin(null, user.email, password)));
            expect(err.code).toBe('require_mfa_setup');
        });

        test('a platform admin is NOT forced when the platform does not require 2FA', async () => {
            const user = await new UserFactory({ password, globalPermissions: Permissions.create({ level: PermissionLevel.Full }) }).create();

            const response = await testServer.test(tokenEndpoint, passwordLogin(null, user.email, password));
            expect(response.body).toBeInstanceOf(TokenStruct);
        });

        test('an org admin without platform permissions is NOT forced when only the platform requires 2FA', async () => {
            await setPlatformRequiresTwoFactor(true);
            const organization = await new OrganizationFactory({}).create();
            const user = await new UserFactory({ organization, password, permissions: Permissions.create({ level: PermissionLevel.Full }) }).create();

            const response = await testServer.test(tokenEndpoint, passwordLogin(organization, user.email, password));
            expect(response.body).toBeInstanceOf(TokenStruct);
        });
    });

    // -----------------------------------------------------------------------
    // Forced enrollment flow (setup token)
    // -----------------------------------------------------------------------
    describe('forced enrollment (setup token)', () => {
        async function startForcedSetup() {
            const organization = await new OrganizationFactory({}).create();
            organization.privateMeta.requireTwoFactor = true;
            await organization.save();
            const user = await new UserFactory({ organization, password, permissions: Permissions.create({ level: PermissionLevel.Full }) }).create();
            const err = await captureError(testServer.test(tokenEndpoint, passwordLogin(organization, user.email, password)));
            expect(err.code).toBe('require_mfa_setup');
            return { organization, user, setupToken: (err.meta as { setupToken: string }).setupToken };
        }

        function withSetup(request: Request, setupToken: string) {
            request.headers.authorization = 'MFASetup ' + setupToken;
            return request;
        }

        test('TOTP setup + confirm issues a session token + recovery codes and consumes the setup token', async () => {
            const { organization, setupToken } = await startForcedSetup();

            const setupResponse = await testServer.test(new SetupTOTPEndpoint(), withSetup(Request.buildJson('POST', '/mfa/totp', organization.getApiHost()), setupToken));
            const totpId = (setupResponse.body as { totpId: string }).totpId;
            const secret = (setupResponse.body as { secret: string }).secret;
            expect(totpId).toBeTruthy();
            expect(secret).toBeTruthy();

            const confirmResponse = await testServer.test(new ConfirmTOTPEndpoint(), withSetup(Request.buildJson('POST', `/mfa/totp/${totpId}/confirm`, organization.getApiHost(), { code: authenticator.generate(secret), name: 'My phone' }), setupToken));
            const body = confirmResponse.body as { token: TokenStruct | null; recoveryCodes: { codes: string[] } | null };
            expect(body.token).toBeTruthy();
            expect(body.recoveryCodes?.codes.length).toBeGreaterThan(0);
            expect(await Token.getByAccessToken(body.token!.accessToken)).toBeDefined();

            // setup token consumed
            const reuse = await captureError(testServer.test(new SetupTOTPEndpoint(), withSetup(Request.buildJson('POST', '/mfa/totp', organization.getApiHost()), setupToken)));
            expect(reuse.code).toBe('mfa_setup_expired');
        });

        test('the temporary setup session does not count as activity until the factor is confirmed', async () => {
            const { organization, user, setupToken } = await startForcedSetup();
            expect((await User.getByID(user.id))!.lastActiveAt).toBeNull();

            const setupResponse = await testServer.test(new SetupTOTPEndpoint(), withSetup(Request.buildJson('POST', '/mfa/totp', organization.getApiHost()), setupToken));
            const { totpId, secret } = setupResponse.body as { totpId: string; secret: string };
            expect((await User.getByID(user.id))!.lastActiveAt).toBeNull();

            await testServer.test(new ConfirmTOTPEndpoint(), withSetup(Request.buildJson('POST', `/mfa/totp/${totpId}/confirm`, organization.getApiHost(), { code: authenticator.generate(secret), name: 'My phone' }), setupToken));
            expect((await User.getByID(user.id))!.lastActiveAt).not.toBeNull();
        });

        test('an invalid setup token is rejected', async () => {
            const organization = await new OrganizationFactory({}).create();
            const err = await captureError(testServer.test(new SetupTOTPEndpoint(), withSetup(Request.buildJson('POST', '/mfa/totp', organization.getApiHost()), 'invalid-setup-token')));
            expect(err.code).toBe('mfa_setup_expired');
        });

        test('a setup token cannot be used on a management endpoint (delete)', async () => {
            const { organization, user, setupToken } = await startForcedSetup();
            const totp = await addConfirmedTOTP(user);

            const err = await captureError(testServer.test(new DeleteTOTPEndpoint(), withSetup(Request.buildJson('DELETE', `/mfa/totp/${totp.id}`, organization.getApiHost()), setupToken)));
            // authenticateFresh() only accepts Bearer, so the MFASetup scheme is refused.
            expect(err.statusCode).toBeGreaterThanOrEqual(400);
            expect(['not_supported_authentication', 'not_authenticated'].includes(err.code)).toBe(true);
        });
    });

    // -----------------------------------------------------------------------
    // Forced enrollment of accounts that were not used for a long time
    // -----------------------------------------------------------------------
    describe('inactive admins confirm their email before enrolling', () => {
        const day = 24 * 60 * 60 * 1000;

        beforeEach(async () => {
            // Without a template no email is built at all, and the assertions below would
            // pass on a version that never sends one.
            await new EmailTemplateFactory({ type: EmailTemplateType.ForgotPassword }).create();
        });

        async function inactiveAdmin({ inactiveDays = INACTIVE_ADMIN_ENROLLMENT_DAYS + 1, requireTwoFactor = true }: { inactiveDays?: number; requireTwoFactor?: boolean } = {}) {
            const organization = await new OrganizationFactory({}).create();
            organization.privateMeta.requireTwoFactor = requireTwoFactor;
            await organization.save();

            const user = await new UserFactory({ organization, password, permissions: Permissions.create({ level: PermissionLevel.Full }) }).create();
            user.lastActiveAt = new Date(Date.now() - inactiveDays * day);
            await user.save();
            return { organization, user };
        }

        async function passwordTokensFor(user: User): Promise<PasswordToken[]> {
            return await PasswordToken.select().where('userId', user.id).fetch();
        }

        async function recoveryEmailsFor(user: User) {
            return (await EmailMocker.transactional.getSucceededEmails()).filter(e => e.to.includes(user.email));
        }

        test('a long inactive admin is locked out and gets a password recovery link', async () => {
            const { organization, user } = await inactiveAdmin();

            const err = await captureError(testServer.test(tokenEndpoint, passwordLogin(organization, user.email, password)));
            expect(err.code).toBe('require_email_confirmation');
            expect(err.statusCode).toBe(403);

            const [passwordToken] = await passwordTokensFor(user);
            expect(passwordToken).toBeDefined();

            // The link in the email is the one that gets them back in.
            const emails = await recoveryEmailsFor(user);
            expect(emails).toHaveLength(1);
            expect(emails[0].html).toContain(encodeURIComponent(passwordToken.token));

            // No setup token was handed out: the enrollment may not start from the password alone.
            expect(await MFAToken.select().where('userId', user.id).fetch()).toHaveLength(0);
            expect((await User.getByID(user.id))!.lastActiveAt!.getTime()).toBeLessThan(Date.now() - INACTIVE_ADMIN_ENROLLMENT_DAYS * day);
        });

        test('an admin who signed in recently is only forced to enroll', async () => {
            const { organization, user } = await inactiveAdmin({ inactiveDays: INACTIVE_ADMIN_ENROLLMENT_DAYS - 1 });

            const err = await captureError(testServer.test(tokenEndpoint, passwordLogin(organization, user.email, password)));
            expect(err.code).toBe('require_mfa_setup');
            expect(await passwordTokensFor(user)).toHaveLength(0);
            expect(await recoveryEmailsFor(user)).toHaveLength(0);
        });

        test('a long inactive platform admin is locked out too', async () => {
            await setPlatformRequiresTwoFactor(true);
            const user = await new UserFactory({ password, globalPermissions: Permissions.create({ level: PermissionLevel.Full }) }).create();
            user.lastActiveAt = new Date(Date.now() - (INACTIVE_ADMIN_ENROLLMENT_DAYS + 1) * day);
            await user.save();

            const err = await captureError(testServer.test(tokenEndpoint, passwordLogin(null, user.email, password)));
            expect(err.code).toBe('require_email_confirmation');
        });

        test('an inactive admin who already enrolled is challenged as usual', async () => {
            const { organization, user } = await inactiveAdmin();
            const { secret } = await addConfirmedTOTP(user);

            const challenge = await requireMfa(organization, user.email, password);
            const response = await testServer.test(tokenEndpoint, mfaGrant(organization, { mfa_token: challenge.token, method: 'TOTP', code: authenticator.generate(secret) }));
            expect(response.body).toBeInstanceOf(TokenStruct);
            expect(await passwordTokensFor(user)).toHaveLength(0);
        });

        test('an inactive user without permissions logs in normally', async () => {
            const organization = await new OrganizationFactory({}).create();
            organization.privateMeta.requireTwoFactor = true;
            await organization.save();

            const user = await new UserFactory({ organization, password }).create();
            user.lastActiveAt = new Date(Date.now() - 400 * day);
            await user.save();

            const response = await testServer.test(tokenEndpoint, passwordLogin(organization, user.email, password));
            expect(response.body).toBeInstanceOf(TokenStruct);
        });

        test('an inactive admin is not blocked when 2FA is not required', async () => {
            const { organization, user } = await inactiveAdmin({ requireTwoFactor: false });

            const response = await testServer.test(tokenEndpoint, passwordLogin(organization, user.email, password));
            expect(response.body).toBeInstanceOf(TokenStruct);
        });

        test('an admin who never signed in is judged on the creation date', async () => {
            const { organization, user } = await inactiveAdmin();
            user.lastActiveAt = null;
            await user.save();

            const fresh = await captureError(testServer.test(tokenEndpoint, passwordLogin(organization, user.email, password)));
            expect(fresh.code).toBe('require_mfa_setup');

            user.createdAt = new Date(Date.now() - (INACTIVE_ADMIN_ENROLLMENT_DAYS + 1) * day);
            await user.save();

            const stale = await captureError(testServer.test(tokenEndpoint, passwordLogin(organization, user.email, password)));
            expect(stale.code).toBe('require_email_confirmation');
        });

        test('the emailed link confirms the email address and unlocks the enrollment', async () => {
            const { organization, user } = await inactiveAdmin();
            await captureError(testServer.test(tokenEndpoint, passwordLogin(organization, user.email, password)));

            const [passwordToken] = await passwordTokensFor(user);
            expect(passwordToken).toBeDefined();

            const err = await captureError(testServer.test(tokenEndpoint, Request.buildJson('POST', '/oauth/token', organization.getApiHost(), { grant_type: 'password_token', token: passwordToken.token })));
            expect(err.code).toBe('require_mfa_setup');
            expect((err.meta as { setupToken: string }).setupToken).toBeTruthy();
        });

        test('an email verification code also unlocks the enrollment', async () => {
            const { organization, user } = await inactiveAdmin();

            const code = await EmailVerificationCode.createFor(user, user.email);
            const err = await captureError(testServer.test(new VerifyEmailEndpoint(), Request.buildJson('POST', '/verify-email', organization.getApiHost(), { token: code.token, code: code.code })));
            expect(err.code).toBe('require_mfa_setup');
        });

        test('repeated logins stop sending new recovery links', async () => {
            const { organization, user } = await inactiveAdmin();

            for (let i = 0; i < 6; i++) {
                const err = await captureError(testServer.test(tokenEndpoint, passwordLogin(organization, user.email, password)));
                expect(err.code).toBe('require_email_confirmation');
            }

            expect(await passwordTokensFor(user)).toHaveLength(3);
            expect(await recoveryEmailsFor(user)).toHaveLength(3);
        });

        test('a failing email does not turn the lockout into a server error', async () => {
            const { organization, user } = await inactiveAdmin();
            const send = vi.spyOn(PasswordForgotService, 'sendPasswordRecoveryEmail').mockRejectedValue(new Error('Mail server down'));

            try {
                const err = await captureError(testServer.test(tokenEndpoint, passwordLogin(organization, user.email, password)));
                expect(err.code).toBe('require_email_confirmation');
                expect(send).toHaveBeenCalledOnce();
            }
            finally {
                send.mockRestore();
            }
        });

        test('the limit is only crossed after a full 45 days', async () => {
            const { user } = await inactiveAdmin();

            // A minute on either side of the limit, so the datetime column losing
            // milliseconds cannot decide the outcome.
            user.lastActiveAt = new Date(Date.now() - INACTIVE_ADMIN_ENROLLMENT_DAYS * day + 60 * 1000);
            expect(TwoFactorHelper.isInactiveForEnrollment(user)).toBe(false);

            user.lastActiveAt = new Date(Date.now() - INACTIVE_ADMIN_ENROLLMENT_DAYS * day - 60 * 1000);
            expect(TwoFactorHelper.isInactiveForEnrollment(user)).toBe(true);
        });

        test('an SSO login of an inactive admin is not blocked', async () => {
            // The identity provider authenticated the user, so there is nothing to confirm.
            const { organization, user } = await inactiveAdmin();

            const requirement = await TwoFactorHelper.getSecondFactorRequirement(user, organization, { loginMethod: SessionLoginMethod.SSO });
            expect(requirement.type).toBe('setup');
        });
    });

    // -----------------------------------------------------------------------
    // Enrollment + management while logged in (happy paths)
    // -----------------------------------------------------------------------
    describe('enrollment while logged in', () => {
        test('setup returns a secret + QR and creates an unconfirmed authenticator', async () => {
            const organization = await new OrganizationFactory({}).create();
            const user = await new UserFactory({ organization, password }).create();
            const token = await freshToken(user);

            const response = await testServer.test(new SetupTOTPEndpoint(), bearer(Request.buildJson('POST', '/mfa/totp', organization.getApiHost()), token));
            const body = response.body as { totpId: string; secret: string; otpauthUri: string };
            expect(body.secret).toBeTruthy();
            expect(body.otpauthUri).toContain('otpauth://');

            const row = await MFATOTP.getByID(body.totpId);
            expect(row?.confirmedAt).toBeNull();
        });

        test('confirming the first factor returns recovery codes and updates the status', async () => {
            const organization = await new OrganizationFactory({}).create();
            const user = await new UserFactory({ organization, password }).create();
            const token = await freshToken(user);

            const setup = await testServer.test(new SetupTOTPEndpoint(), bearer(Request.buildJson('POST', '/mfa/totp', organization.getApiHost()), token));
            const { totpId, secret } = setup.body as { totpId: string; secret: string };

            const confirm = await testServer.test(new ConfirmTOTPEndpoint(), bearer(Request.buildJson('POST', `/mfa/totp/${totpId}/confirm`, organization.getApiHost(), { code: authenticator.generate(secret), name: 'Phone' }), await freshToken(user)));
            const body = confirm.body as { token: unknown; recoveryCodes: { codes: string[] } | null; status: { totp: unknown[] } };
            expect(body.token).toBeNull(); // already logged in
            expect(body.recoveryCodes?.codes.length).toBeGreaterThan(0);
            expect(body.status.totp.length).toBe(1);
        });

        test('confirming a second factor does not re-issue recovery codes', async () => {
            const organization = await new OrganizationFactory({}).create();
            const user = await new UserFactory({ organization, password }).create();
            await addConfirmedTOTP(user);

            const setup = await testServer.test(new SetupTOTPEndpoint(), bearer(Request.buildJson('POST', '/mfa/totp', organization.getApiHost()), await freshToken(user)));
            const { totpId, secret } = setup.body as { totpId: string; secret: string };

            const confirm = await testServer.test(new ConfirmTOTPEndpoint(), bearer(Request.buildJson('POST', `/mfa/totp/${totpId}/confirm`, organization.getApiHost(), { code: authenticator.generate(secret), name: 'Phone 2' }), await freshToken(user)));
            expect((confirm.body as { recoveryCodes: unknown }).recoveryCodes).toBeNull();
        });

        test('confirming with a wrong code fails and leaves the authenticator unconfirmed', async () => {
            const organization = await new OrganizationFactory({}).create();
            const user = await new UserFactory({ organization, password }).create();
            const setup = await testServer.test(new SetupTOTPEndpoint(), bearer(Request.buildJson('POST', '/mfa/totp', organization.getApiHost()), await freshToken(user)));
            const { totpId } = setup.body as { totpId: string };

            const err = await captureError(testServer.test(new ConfirmTOTPEndpoint(), bearer(Request.buildJson('POST', `/mfa/totp/${totpId}/confirm`, organization.getApiHost(), { code: '000000', name: 'x' }), await freshToken(user))));
            expect(err.code).toBe('invalid_mfa_code');
            expect((await MFATOTP.getByID(totpId))?.confirmedAt).toBeNull();
        });

        test('confirming a non-existent authenticator returns not_found', async () => {
            const organization = await new OrganizationFactory({}).create();
            const user = await new UserFactory({ organization, password }).create();
            const err = await captureError(testServer.test(new ConfirmTOTPEndpoint(), bearer(Request.buildJson('POST', '/mfa/totp/does-not-exist/confirm', organization.getApiHost(), { code: '000000', name: 'x' }), await freshToken(user))));
            expect(err.code).toBe('not_found');
        });

        test('GetMFAStatus reflects the enrolled factors', async () => {
            const organization = await new OrganizationFactory({}).create();
            const user = await new UserFactory({ organization, password }).create();
            await addConfirmedTOTP(user);
            await addPasskey(user);
            await RecoveryCodeHelper.regenerateForUser(user.id);

            const response = await testServer.test(new GetMFAStatusEndpoint(), bearer(Request.buildJson('GET', '/mfa', organization.getApiHost()), await freshToken(user)));
            const body = response.body as { totp: unknown[]; passkeys: unknown[]; hasRecoveryCodes: boolean; recoveryCodesRemaining: number };
            expect(body.totp.length).toBe(1);
            expect(body.passkeys.length).toBe(1);
            expect(body.hasRecoveryCodes).toBe(true);
            expect(body.recoveryCodesRemaining).toBeGreaterThan(0);
        });

        test('recovery codes can be regenerated, invalidating the old batch', async () => {
            const organization = await new OrganizationFactory({}).create();
            const user = await new UserFactory({ organization, password }).create();
            await addConfirmedTOTP(user);
            const oldCodes = await RecoveryCodeHelper.regenerateForUser(user.id);

            const response = await testServer.test(new RegenerateRecoveryCodesEndpoint(), bearer(Request.buildJson('POST', '/mfa/recovery-codes', organization.getApiHost()), await freshToken(user)));
            const newCodes = (response.body as { codes: string[] }).codes;
            expect(newCodes.length).toBeGreaterThan(0);

            // old code no longer works at login
            const challenge = await requireMfa(organization, user.email, password);
            const oldFails = await captureError(testServer.test(tokenEndpoint, mfaGrant(organization, { mfa_token: challenge.token, method: 'RecoveryCode', code: oldCodes[0] })));
            expect(oldFails.code).toBe('invalid_mfa_code');

            // a new code works exactly once
            const ok = await testServer.test(tokenEndpoint, mfaGrant(organization, { mfa_token: challenge.token, method: 'RecoveryCode', code: newCodes[0] }));
            expect(ok.body).toBeInstanceOf(TokenStruct);
        });

        test('recovery codes cannot be generated without any factor', async () => {
            const organization = await new OrganizationFactory({}).create();
            const user = await new UserFactory({ organization, password }).create();
            const err = await captureError(testServer.test(new RegenerateRecoveryCodesEndpoint(), bearer(Request.buildJson('POST', '/mfa/recovery-codes', organization.getApiHost()), await freshToken(user))));
            expect(err.code).toBe('no_factors');
        });

        test('passkey registration options are returned and the challenge is stored', async () => {
            const organization = await new OrganizationFactory({}).create();
            // Passkeys are limited to platform level accounts, see User.canUsePasskeys.
            const user = await platformUser();

            const response = await testServer.test(new RegisterPasskeyOptionsEndpoint(), bearer(Request.buildJson('POST', '/mfa/passkeys/options', organization.getApiHost()), await freshToken(user)));
            const options = (response.body as { options: { challenge?: string } }).options;
            expect(options.challenge).toBeTruthy();
            expect(await WebauthnChallenge.consumeForUser(user.id)).toBeTruthy();
        });

        test('an invalid passkey registration response is rejected', async () => {
            const organization = await new OrganizationFactory({}).create();
            const user = await platformUser();
            await testServer.test(new RegisterPasskeyOptionsEndpoint(), bearer(Request.buildJson('POST', '/mfa/passkeys/options', organization.getApiHost()), await freshToken(user)));

            const err = await captureError(testServer.test(new RegisterPasskeyEndpoint(), bearer(Request.buildJson('POST', '/mfa/passkeys', organization.getApiHost(), {
                name: 'My key',
                response: { id: 'x', rawId: 'x', type: 'public-key', response: { clientDataJSON: 'x', attestationObject: 'x' } },
            }), await freshToken(user))));
            expect(err.code).toBe('invalid_passkey');
        });
    });

    // -----------------------------------------------------------------------
    // Deletion + last-factor protection
    // -----------------------------------------------------------------------
    describe('management', () => {
        test('a TOTP authenticator can be deleted', async () => {
            const organization = await new OrganizationFactory({}).create();
            const user = await new UserFactory({ organization, password }).create();
            const first = await addConfirmedTOTP(user);
            await addConfirmedTOTP(user);

            const response = await testServer.test(new DeleteTOTPEndpoint(), bearer(Request.buildJson('DELETE', `/mfa/totp/${first.id}`, organization.getApiHost()), await freshToken(user)));
            expect((response.body as { totp: unknown[] }).totp.length).toBe(1);
            expect(await MFATOTP.getByID(first.id)).toBeUndefined();
        });

        test('deleting an unknown authenticator returns not_found', async () => {
            const organization = await new OrganizationFactory({}).create();
            const user = await new UserFactory({ organization, password }).create();
            const err = await captureError(testServer.test(new DeleteTOTPEndpoint(), bearer(Request.buildJson('DELETE', '/mfa/totp/unknown', organization.getApiHost()), await freshToken(user))));
            expect(err.code).toBe('not_found');
        });

        test('a user cannot delete another user\'s authenticator', async () => {
            const organization = await new OrganizationFactory({}).create();
            const user = await new UserFactory({ organization, password }).create();
            const other = await new UserFactory({ organization, password }).create();
            const otherTotp = await addConfirmedTOTP(other);

            const err = await captureError(testServer.test(new DeleteTOTPEndpoint(), bearer(Request.buildJson('DELETE', `/mfa/totp/${otherTotp.id}`, organization.getApiHost()), await freshToken(user))));
            expect(err.code).toBe('not_found');
        });

        test('the last factor cannot be removed while 2FA is required', async () => {
            const organization = await new OrganizationFactory({}).create();
            organization.privateMeta.requireTwoFactor = true;
            await organization.save();
            const user = await new UserFactory({ organization, password, permissions: Permissions.create({ level: PermissionLevel.Full }) }).create();
            const totp = await addConfirmedTOTP(user);

            const err = await captureError(testServer.test(new DeleteTOTPEndpoint(), bearer(Request.buildJson('DELETE', `/mfa/totp/${totp.id}`, organization.getApiHost()), await freshToken(user))));
            expect(err.code).toBe('cannot_remove_last_factor');
        });

        test('the last factor CAN be removed when 2FA is not required', async () => {
            const organization = await new OrganizationFactory({}).create();
            const user = await new UserFactory({ organization, password }).create();
            const totp = await addConfirmedTOTP(user);

            const response = await testServer.test(new DeleteTOTPEndpoint(), bearer(Request.buildJson('DELETE', `/mfa/totp/${totp.id}`, organization.getApiHost()), await freshToken(user)));
            expect((response.body as { totp: unknown[] }).totp.length).toBe(0);
        });

        test('a passkey can be deleted', async () => {
            const organization = await new OrganizationFactory({}).create();
            const user = await new UserFactory({ organization, password }).create();
            const passkey = await addPasskey(user);
            await addConfirmedTOTP(user);

            const response = await testServer.test(new DeletePasskeyEndpoint(), bearer(Request.buildJson('DELETE', `/mfa/passkeys/${passkey.id}`, organization.getApiHost()), await freshToken(user)));
            expect((response.body as { passkeys: unknown[] }).passkeys.length).toBe(0);
        });

        test('deleting the last passkey is blocked when 2FA is required', async () => {
            const organization = await new OrganizationFactory({}).create();
            organization.privateMeta.requireTwoFactor = true;
            await organization.save();
            const user = await new UserFactory({ organization, password, permissions: Permissions.create({ level: PermissionLevel.Full }) }).create();
            const passkey = await addPasskey(user);

            const err = await captureError(testServer.test(new DeletePasskeyEndpoint(), bearer(Request.buildJson('DELETE', `/mfa/passkeys/${passkey.id}`, organization.getApiHost()), await freshToken(user))));
            expect(err.code).toBe('cannot_remove_last_factor');
        });
    });

    // -----------------------------------------------------------------------
    // Audit logs
    // -----------------------------------------------------------------------
    describe('audit logs', () => {
        afterEach(() => {
            vi.restoreAllMocks();
        });

        test('confirming an authenticator app is logged with its name', async () => {
            const organization = await new OrganizationFactory({}).create();
            const user = await new UserFactory({ organization, password }).create();

            const setup = await testServer.test(new SetupTOTPEndpoint(), bearer(Request.buildJson('POST', '/mfa/totp', organization.getApiHost()), await freshToken(user)));
            const { totpId, secret } = setup.body as { totpId: string; secret: string };
            // Starting a setup is not a change to the account yet, so it is not logged.
            expect(await twoFactorLogs(user)).toHaveLength(0);

            await testServer.test(new ConfirmTOTPEndpoint(), bearer(Request.buildJson('POST', `/mfa/totp/${totpId}/confirm`, organization.getApiHost(), { code: authenticator.generate(secret), name: 'GSM van Jan' }), await freshToken(user)));

            const logs = await twoFactorLogs(user);
            expect(logs).toHaveLength(1);
            expect(logs[0].type).toBe(AuditLogType.UserTwoFactorMethodAdded);
            expect(logs[0].userId).toBe(user.id);
            expect(logs[0].organizationId).toBe(organization.id);
            expect(logs[0].replacements.get('u')).toMatchObject({
                id: user.id,
                value: user.email,
                type: AuditLogReplacementType.User,
            });
            expect(logs[0].replacements.get('method')).toMatchObject({
                id: 'MFAMethodType',
                value: MFAMethodType.TOTP,
                type: AuditLogReplacementType.Enum,
            });
            expect(logs[0].replacements.get('name')?.value).toBe('GSM van Jan');
        });

        test('deleting an authenticator app is logged', async () => {
            const organization = await new OrganizationFactory({}).create();
            const user = await new UserFactory({ organization, password }).create();
            const totp = await MFATestHelper.addConfirmedTOTP(user, 'Oude GSM');
            await addConfirmedTOTP(user);

            await testServer.test(new DeleteTOTPEndpoint(), bearer(Request.buildJson('DELETE', `/mfa/totp/${totp.id}`, organization.getApiHost()), await freshToken(user)));

            const logs = await twoFactorLogs(user);
            expect(logs).toHaveLength(1);
            expect(logs[0].type).toBe(AuditLogType.UserTwoFactorMethodDeleted);
            expect(logs[0].replacements.get('method')?.value).toBe(MFAMethodType.TOTP);
            expect(logs[0].replacements.get('name')?.value).toBe('Oude GSM');
        });

        test('registering and deleting a passkey is logged, without an organization for a platform account', async () => {
            const organization = await new OrganizationFactory({}).create();
            const user = await platformUser();

            await testServer.test(new RegisterPasskeyOptionsEndpoint(), bearer(Request.buildJson('POST', '/mfa/passkeys/options', organization.getApiHost()), await freshToken(user)));

            // The browser part of the registration can't be simulated, so only the
            // verification of the response is replaced.
            const credentialId = 'cred-' + crypto.randomBytes(16).toString('base64url');
            vi.spyOn(WebauthnHelper, 'verifyRegistration').mockResolvedValue({
                rpId: 'stamhoofd.dev',
                providerId: null,
                providerName: null,
                credentialId,
                publicKey: crypto.randomBytes(32).toString('base64url'),
                counter: 0,
                transports: null,
                backedUp: false,
                backupEligible: false,
            });

            await testServer.test(new RegisterPasskeyEndpoint(), bearer(Request.buildJson('POST', '/mfa/passkeys', organization.getApiHost(), {
                name: 'YubiKey',
                response: { id: 'x', rawId: 'x', type: 'public-key', response: { clientDataJSON: 'x', attestationObject: 'x' } },
            }), await freshToken(user)));

            const credential = await WebauthnCredential.getByCredentialId(credentialId);
            expect(credential).toBeDefined();

            await testServer.test(new DeletePasskeyEndpoint(), bearer(Request.buildJson('DELETE', `/mfa/passkeys/${credential!.id}`, organization.getApiHost()), await freshToken(user)));

            const logs = await twoFactorLogs(user);
            expect(logs.map(l => l.type)).toEqual([AuditLogType.UserTwoFactorMethodAdded, AuditLogType.UserTwoFactorMethodDeleted]);
            for (const log of logs) {
                // A platform account has no organization of its own: the log stays private
                // for the platform, even though the request was made on an organization host.
                expect(log.organizationId).toBeNull();
                expect(log.replacements.get('method')?.value).toBe(MFAMethodType.Passkey);
                expect(log.replacements.get('name')?.value).toBe('YubiKey');
            }
        });

        test('regenerating the recovery codes is logged', async () => {
            const organization = await new OrganizationFactory({}).create();
            const user = await new UserFactory({ organization, password }).create();
            await addConfirmedTOTP(user);

            await testServer.test(new RegenerateRecoveryCodesEndpoint(), bearer(Request.buildJson('POST', '/mfa/recovery-codes', organization.getApiHost()), await freshToken(user)));

            const logs = await twoFactorLogs(user);
            expect(logs).toHaveLength(1);
            expect(logs[0].type).toBe(AuditLogType.UserRecoveryCodesRegenerated);
            expect(logs[0].userId).toBe(user.id);
            expect(logs[0].objectId).toBe(user.id);
            expect(logs[0].replacements.get('u')?.value).toBe(user.email);
        });

        test('changes that are refused are not logged', async () => {
            const organization = await new OrganizationFactory({}).create();
            organization.privateMeta.requireTwoFactor = true;
            await organization.save();
            const user = await new UserFactory({ organization, password, permissions: Permissions.create({ level: PermissionLevel.Full }) }).create();

            // A wrong confirmation code
            const setup = await testServer.test(new SetupTOTPEndpoint(), bearer(Request.buildJson('POST', '/mfa/totp', organization.getApiHost()), await freshToken(user)));
            const { totpId } = setup.body as { totpId: string };
            await captureError(testServer.test(new ConfirmTOTPEndpoint(), bearer(Request.buildJson('POST', `/mfa/totp/${totpId}/confirm`, organization.getApiHost(), { code: '000000', name: 'x' }), await freshToken(user))));

            // Removing the last factor while 2FA is required
            const totp = await addConfirmedTOTP(user);
            await captureError(testServer.test(new DeleteTOTPEndpoint(), bearer(Request.buildJson('DELETE', `/mfa/totp/${totp.id}`, organization.getApiHost()), await freshToken(user))));

            expect(await twoFactorLogs(user)).toHaveLength(0);
        });
    });

    // -----------------------------------------------------------------------
    // Fresh-session requirement for ALL sensitive endpoints
    // -----------------------------------------------------------------------
    describe('sensitive endpoints require a fresh session', () => {
        const cases: { name: string; endpoint: () => Endpoint<any, any, any, any>; build: (org: Organization) => Request }[] = [
            { name: 'SetupTOTP', endpoint: () => new SetupTOTPEndpoint(), build: org => Request.buildJson('POST', '/mfa/totp', org.getApiHost()) },
            { name: 'ConfirmTOTP', endpoint: () => new ConfirmTOTPEndpoint(), build: org => Request.buildJson('POST', '/mfa/totp/x/confirm', org.getApiHost(), { code: '000000', name: 'x' }) },
            { name: 'RegisterPasskeyOptions', endpoint: () => new RegisterPasskeyOptionsEndpoint(), build: org => Request.buildJson('POST', '/mfa/passkeys/options', org.getApiHost()) },
            { name: 'RegisterPasskey', endpoint: () => new RegisterPasskeyEndpoint(), build: org => Request.buildJson('POST', '/mfa/passkeys', org.getApiHost(), { name: 'x', response: {} }) },
            { name: 'DeleteTOTP', endpoint: () => new DeleteTOTPEndpoint(), build: org => Request.buildJson('DELETE', '/mfa/totp/x', org.getApiHost()) },
            { name: 'DeletePasskey', endpoint: () => new DeletePasskeyEndpoint(), build: org => Request.buildJson('DELETE', '/mfa/passkeys/x', org.getApiHost()) },
            { name: 'RegenerateRecoveryCodes', endpoint: () => new RegenerateRecoveryCodesEndpoint(), build: org => Request.buildJson('POST', '/mfa/recovery-codes', org.getApiHost()) },
        ];

        for (const c of cases) {
            test(`${c.name} rejects a non-fresh (refresh-derived) token`, async () => {
                const organization = await new OrganizationFactory({}).create();
                const user = await new UserFactory({ organization, password }).create();
                const token = await staleToken(user);

                const err = await captureError(testServer.test(c.endpoint() as never, bearer(c.build(organization), token)));
                expect(err.code).toBe('require_fresh_auth');
            });
        }

        test('GetMFAStatus does NOT require a fresh session (read-only)', async () => {
            const organization = await new OrganizationFactory({}).create();
            const user = await new UserFactory({ organization, password }).create();
            const response = await testServer.test(new GetMFAStatusEndpoint(), bearer(Request.buildJson('GET', '/mfa', organization.getApiHost()), await staleToken(user)));
            expect(response.body).toBeDefined();
        });
    });

    // -----------------------------------------------------------------------
    // MFA cannot be bypassed through alternate login grants
    // -----------------------------------------------------------------------
    describe('no MFA bypass via alternate grants', () => {
        function passwordTokenLogin(organization: Organization, token: string) {
            return Request.buildJson('POST', '/oauth/token', organization.getApiHost(), { grant_type: 'password_token', token });
        }

        test('password_token grant challenges MFA for a user with a factor (no bypass)', async () => {
            const organization = await new OrganizationFactory({}).create();
            const user = await new UserFactory({ organization, password }).create();
            await addConfirmedTOTP(user);

            const pwToken = await PasswordToken.createToken(user);
            const err = await captureError(testServer.test(tokenEndpoint, passwordTokenLogin(organization, pwToken.token)));
            expect(err.code).toBe('require_mfa');
        });

        test('password_token grant forces enrollment when 2FA is required but not set up', async () => {
            const organization = await new OrganizationFactory({}).create();
            organization.privateMeta.requireTwoFactor = true;
            await organization.save();
            const user = await new UserFactory({ organization, password, permissions: Permissions.create({ level: PermissionLevel.Full }) }).create();

            const pwToken = await PasswordToken.createToken(user);
            const err = await captureError(testServer.test(tokenEndpoint, passwordTokenLogin(organization, pwToken.token)));
            expect(err.code).toBe('require_mfa_setup');

            // A temporary session token is included: this flow is also used to choose a
            // first password (invites), which the client can only do with a session. The
            // user has no factor yet, so whoever holds the link could enroll one and get a
            // session anyway.
            const meta = err.meta as { setupToken: string; token: { access_token: string } | null };
            expect(meta.setupToken).toBeTruthy();
            expect(meta.token?.access_token).toBeTruthy();

            const temporary = await Token.getByAccessToken(meta.token!.access_token);
            expect(temporary?.user.id).toBe(user.id);
        });

        test('the password grant does not hand out a temporary session on forced enrollment', async () => {
            const organization = await new OrganizationFactory({}).create();
            organization.privateMeta.requireTwoFactor = true;
            await organization.save();
            const user = await new UserFactory({ organization, password, permissions: Permissions.create({ level: PermissionLevel.Full }) }).create();

            const err = await captureError(testServer.test(tokenEndpoint, passwordLogin(organization, user.email, password)));
            expect(err.code).toBe('require_mfa_setup');
            expect((err.meta as { setupToken: string; token: unknown }).setupToken).toBeTruthy();
            expect((err.meta as { token: unknown }).token).toBeNull();
        });

        test('password_token grant still issues a token when the user has no factors', async () => {
            const organization = await new OrganizationFactory({}).create();
            const user = await new UserFactory({ organization, password }).create();

            const pwToken = await PasswordToken.createToken(user);
            const response = await testServer.test(tokenEndpoint, passwordTokenLogin(organization, pwToken.token));
            expect(response.body).toBeInstanceOf(TokenStruct);
        });

        test('verify-email challenges MFA for a user with a factor (no bypass)', async () => {
            const organization = await new OrganizationFactory({}).create();
            const user = await new UserFactory({ organization, password }).create();
            await addConfirmedTOTP(user);

            const code = await EmailVerificationCode.createFor(user, user.email);
            const err = await captureError(testServer.test(new VerifyEmailEndpoint(), Request.buildJson('POST', '/verify-email', organization.getApiHost(), { token: code.token, code: code.code })));
            expect(err.code).toBe('require_mfa');
        });

        test('verify-email still issues a token when the user has no factors', async () => {
            const organization = await new OrganizationFactory({}).create();
            const user = await new UserFactory({ organization, password }).create();

            const code = await EmailVerificationCode.createFor(user, user.email);
            const response = await testServer.test(new VerifyEmailEndpoint(), Request.buildJson('POST', '/verify-email', organization.getApiHost(), { token: code.token, code: code.code }));
            expect(response.body).toBeInstanceOf(TokenStruct);
        });

        test('verify-email does not challenge a user that is already signed in (changing their email address)', async () => {
            const organization = await new OrganizationFactory({}).create();
            const user = await new UserFactory({ organization, password }).create();
            await addConfirmedTOTP(user);
            const newEmail = 'changed-' + user.email;

            // The user passed their second factor when this session was created.
            const session = await freshToken(user);

            const code = await EmailVerificationCode.createFor(user, newEmail);
            const response = await testServer.test(new VerifyEmailEndpoint(), bearer(Request.buildJson('POST', '/verify-email', organization.getApiHost(), { token: code.token, code: code.code }), session));
            expect(response.body).toBeInstanceOf(TokenStruct);

            const updated = await User.getByID(user.id);
            expect(updated?.email).toBe(newEmail);
        });

        test('verify-email challenges when the session belongs to another user', async () => {
            const organization = await new OrganizationFactory({}).create();
            const user = await new UserFactory({ organization, password }).create();
            await addConfirmedTOTP(user);
            const other = await new UserFactory({ organization, password }).create();

            const code = await EmailVerificationCode.createFor(user, user.email);
            const err = await captureError(testServer.test(new VerifyEmailEndpoint(), bearer(Request.buildJson('POST', '/verify-email', organization.getApiHost(), { token: code.token, code: code.code }), await freshToken(other))));
            expect(err.code).toBe('require_mfa');
        });
    });

    // -----------------------------------------------------------------------
    // TOTP replay protection
    // -----------------------------------------------------------------------
    describe('mfa grant - TOTP replay protection', () => {
        test('a still-valid TOTP code cannot be reused for a second login', async () => {
            const organization = await new OrganizationFactory({}).create();
            const user = await new UserFactory({ organization, password }).create();
            const { secret } = await addConfirmedTOTP(user);

            // A single code, used for the first login and then replayed while still valid.
            const code = authenticator.generate(secret);

            const challenge1 = await requireMfa(organization, user.email, password);
            const ok = await testServer.test(tokenEndpoint, mfaGrant(organization, { mfa_token: challenge1.token, method: 'TOTP', code }));
            expect(ok.body).toBeInstanceOf(TokenStruct);

            const challenge2 = await requireMfa(organization, user.email, password);
            const replay = await captureError(testServer.test(tokenEndpoint, mfaGrant(organization, { mfa_token: challenge2.token, method: 'TOTP', code })));
            expect(replay.code).toBe('invalid_mfa_code');
        });

        test('a TOTP code used during confirmation cannot be replayed as a login', async () => {
            const organization = await new OrganizationFactory({}).create();
            const user = await new UserFactory({ organization, password }).create();
            const token = await freshToken(user);

            const setup = await testServer.test(new SetupTOTPEndpoint(), bearer(Request.buildJson('POST', '/mfa/totp', organization.getApiHost()), token));
            const { totpId, secret } = setup.body as { totpId: string; secret: string };

            const code = authenticator.generate(secret);
            await testServer.test(new ConfirmTOTPEndpoint(), bearer(Request.buildJson('POST', `/mfa/totp/${totpId}/confirm`, organization.getApiHost(), { code, name: 'Phone' }), await freshToken(user)));

            const challenge = await requireMfa(organization, user.email, password);
            const replay = await captureError(testServer.test(tokenEndpoint, mfaGrant(organization, { mfa_token: challenge.token, method: 'TOTP', code })));
            expect(replay.code).toBe('invalid_mfa_code');
        });

        test('a step counter is claimed by one request only', async () => {
            const organization = await new OrganizationFactory({}).create();
            const user = await new UserFactory({ organization, password }).create();
            const { id } = await addConfirmedTOTP(user);

            // Two requests that read the authenticator before either of them wrote to it.
            const first = (await MFATOTP.getByID(id))!;
            const second = (await MFATOTP.getByID(id))!;

            const claims = await Promise.all([first.claimCounter(42), second.claimCounter(42)]);
            expect(claims.filter(claimed => claimed)).toHaveLength(1);

            // A later code is still accepted, an earlier one never again.
            expect(await (await MFATOTP.getByID(id))!.claimCounter(43)).toBe(true);
            expect(await (await MFATOTP.getByID(id))!.claimCounter(42)).toBe(false);
        });

        test('one challenge hands out one session, even when it is completed twice at once', async () => {
            const organization = await new OrganizationFactory({}).create();
            const user = await new UserFactory({ organization, password }).create();
            const { secret } = await addConfirmedTOTP(user);
            const code = authenticator.generate(secret);

            const challenge = await requireMfa(organization, user.email, password);
            const results = await Promise.allSettled([
                testServer.test(tokenEndpoint, mfaGrant(organization, { mfa_token: challenge.token, method: 'TOTP', code })),
                testServer.test(tokenEndpoint, mfaGrant(organization, { mfa_token: challenge.token, method: 'TOTP', code })),
            ]);

            expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1);
            expect(await Token.where({ userId: user.id })).toHaveLength(1);
        });
    });

    // -----------------------------------------------------------------------
    // Aggregate (cross-token) brute-force protection
    // -----------------------------------------------------------------------
    describe('mfa grant - aggregate rate limiting', () => {
        test('once the aggregate limit is hit, even a correct code is rejected', async () => {
            const organization = await new OrganizationFactory({}).create();
            const user = await new UserFactory({ organization, password }).create();
            const { secret } = await addConfirmedTOTP(user);

            // Each attempt uses a brand new challenge token so the per-token limit (5) never
            // trips; only the aggregate per-user limiter can stop this.
            for (let i = 0; i < 10; i++) {
                const challenge = await requireMfa(organization, user.email, password);
                const e = await captureError(testServer.test(tokenEndpoint, mfaGrant(organization, { mfa_token: challenge.token, method: 'TOTP', code: '000000' })));
                expect(e.code).toBe('invalid_mfa_code');
            }

            // The critical case: a *correct* code must NOT be a way around the rate limit.
            // The limiter is checked before verification, so brute-forcing until a lucky
            // (or leaked) code lands still gets rejected once the limit is exceeded.
            const challenge = await requireMfa(organization, user.email, password);
            const limited = await captureError(testServer.test(tokenEndpoint, mfaGrant(organization, { mfa_token: challenge.token, method: 'TOTP', code: authenticator.generate(secret) })));
            expect(limited.code).toBe('rate_limit');
        });
    });

    // -----------------------------------------------------------------------
    // Recovery code generation + consumption
    // -----------------------------------------------------------------------
    describe('recovery codes', () => {
        test('uses a readable, duplicate-free 32-symbol alphabet', () => {
            expect(RECOVERY_CODE_ALPHABET.length).toBe(32);
            // No ambiguous characters (0/O, 1/I, L).
            expect(RECOVERY_CODE_ALPHABET).not.toMatch(/[0OIL]/);
            // base-x requires every symbol to be distinct.
            expect(new Set(RECOVERY_CODE_ALPHABET).size).toBe(RECOVERY_CODE_ALPHABET.length);
        });

        test('generated codes only use the alphabet and the XXXX-XXXX-XXXX-XXXX format', async () => {
            const organization = await new OrganizationFactory({}).create();
            const user = await new UserFactory({ organization, password }).create();

            const codes = await RecoveryCodeHelper.regenerateForUser(user.id);
            expect(codes.length).toBeGreaterThan(0);

            const allowed = new RegExp(`^([${RECOVERY_CODE_ALPHABET}]{4}-){3}[${RECOVERY_CODE_ALPHABET}]{4}$`);
            for (const code of codes) {
                expect(code).toMatch(allowed);
            }
        });

        test('the same recovery code cannot be consumed twice concurrently', async () => {
            const organization = await new OrganizationFactory({}).create();
            const user = await new UserFactory({ organization, password }).create();
            const codes = await RecoveryCodeHelper.regenerateForUser(user.id);

            const results = await Promise.all([
                RecoveryCodeHelper.consume(user.id, codes[0]),
                RecoveryCodeHelper.consume(user.id, codes[0]),
            ]);
            expect(results.filter(Boolean).length).toBe(1);
        });
    });

    // -----------------------------------------------------------------------
    // Setup hygiene: don't leak orphaned unconfirmed authenticators
    // -----------------------------------------------------------------------
    describe('setup hygiene', () => {
        test('starting a new TOTP setup removes earlier unconfirmed authenticators', async () => {
            const organization = await new OrganizationFactory({}).create();
            const user = await new UserFactory({ organization, password }).create();

            const first = await testServer.test(new SetupTOTPEndpoint(), bearer(Request.buildJson('POST', '/mfa/totp', organization.getApiHost()), await freshToken(user)));
            const firstId = (first.body as { totpId: string }).totpId;

            const second = await testServer.test(new SetupTOTPEndpoint(), bearer(Request.buildJson('POST', '/mfa/totp', organization.getApiHost()), await freshToken(user)));
            const secondId = (second.body as { totpId: string }).totpId;

            expect(await MFATOTP.getByID(firstId)).toBeUndefined();
            expect(await MFATOTP.getByID(secondId)).toBeDefined();
        });

        test('starting a new TOTP setup keeps already-confirmed authenticators', async () => {
            const organization = await new OrganizationFactory({}).create();
            const user = await new UserFactory({ organization, password }).create();
            const confirmed = await addConfirmedTOTP(user);

            await testServer.test(new SetupTOTPEndpoint(), bearer(Request.buildJson('POST', '/mfa/totp', organization.getApiHost()), await freshToken(user)));
            expect(await MFATOTP.getByID(confirmed.id)).toBeDefined();
        });

        test('a new challenge replaces the previous one instead of piling up', async () => {
            const organization = await new OrganizationFactory({}).create();
            const user = await new UserFactory({ organization, password }).create();
            await addConfirmedTOTP(user);

            const first = await requireMfa(organization, user.email, password);
            const second = await requireMfa(organization, user.email, password);

            expect(await MFAToken.select().where('userId', user.id).fetch()).toHaveLength(1);
            expect(await MFAToken.getValid(first.token, 'login')).toBeUndefined();
            expect(await MFAToken.getValid(second.token, 'login')).toBeDefined();
        });

        test('expired tokens and challenges are swept up', async () => {
            const organization = await new OrganizationFactory({}).create();
            const user = await new UserFactory({ organization, password }).create();

            const token = await MFAToken.createFor(user.id, 'login');
            token.expiresAt = new Date(Date.now() - 1000);
            await token.save();

            const challenge = await WebauthnChallenge.createFor(user.id, 'abandoned-challenge');
            challenge.expiresAt = new Date(Date.now() - 1000);
            await challenge.save();

            expect(await MFAToken.deleteExpired()).toBeGreaterThanOrEqual(1);
            expect(await WebauthnChallenge.deleteExpired()).toBeGreaterThanOrEqual(1);

            expect(await MFAToken.select().where('token', token.token).first(false)).toBeNull();
            expect(await WebauthnChallenge.getByID(challenge.id)).toBeUndefined();
        });
    });

    // -----------------------------------------------------------------------
    // Recovery codes follow the factors they belong to
    // -----------------------------------------------------------------------
    describe('recovery code lifecycle', () => {
        test('removing the last factor also removes the recovery codes', async () => {
            const organization = await new OrganizationFactory({}).create();
            const user = await new UserFactory({ organization, password }).create();
            const totp = await addConfirmedTOTP(user);
            await RecoveryCodeHelper.regenerateForUser(user.id);

            const response = await testServer.test(new DeleteTOTPEndpoint(), bearer(Request.buildJson('DELETE', `/mfa/totp/${totp.id}`, organization.getApiHost()), await freshToken(user)));

            expect((response.body as { hasRecoveryCodes: boolean }).hasRecoveryCodes).toBe(false);
            expect(await MFARecoveryCode.getForUser(user.id)).toHaveLength(0);
        });

        test('removing one of several factors keeps the recovery codes', async () => {
            const organization = await new OrganizationFactory({}).create();
            const user = await new UserFactory({ organization, password }).create();
            const totp = await addConfirmedTOTP(user);
            await addPasskey(user);
            const codes = await RecoveryCodeHelper.regenerateForUser(user.id);

            await testServer.test(new DeleteTOTPEndpoint(), bearer(Request.buildJson('DELETE', `/mfa/totp/${totp.id}`, organization.getApiHost()), await freshToken(user)));

            expect(await MFARecoveryCode.getUnusedForUser(user.id)).toHaveLength(codes.length);
        });
    });

    // -----------------------------------------------------------------------
    // What SSO logins still have to do
    // -----------------------------------------------------------------------
    describe('second factor requirement per login method', () => {
        async function adminOfOrgRequiringTwoFactor({ withPassword }: { withPassword: boolean }) {
            const organization = await new OrganizationFactory({}).create();
            organization.privateMeta.requireTwoFactor = true;
            await organization.save();

            const user = await new UserFactory({ organization, password, permissions: Permissions.create({ level: PermissionLevel.Full }) }).create();
            if (!withPassword) {
                // An SSO-only account: it was never given a password.
                user.password = null;
                await user.save();
            }
            return { organization, user };
        }

        test('an SSO login still has to pass an enrolled second factor', async () => {
            const { organization, user } = await adminOfOrgRequiringTwoFactor({ withPassword: false });
            await addConfirmedTOTP(user);

            const requirement = await TwoFactorHelper.getSecondFactorRequirement(user, organization, { loginMethod: SessionLoginMethod.SSO });
            expect(requirement.type).toBe('challenge');
        });

        test('an SSO-only account is not forced to enroll: the provider is the second factor', async () => {
            const { organization, user } = await adminOfOrgRequiringTwoFactor({ withPassword: false });

            const requirement = await TwoFactorHelper.getSecondFactorRequirement(user, organization, { loginMethod: SessionLoginMethod.SSO });
            expect(requirement.type).toBe('none');
        });

        test('an account that also has a password is forced to enroll, even through SSO', async () => {
            // The password stays a way in that skips whatever the provider enforces, so the
            // requirement is not satisfied by signing in through SSO.
            const { organization, user } = await adminOfOrgRequiringTwoFactor({ withPassword: true });

            const requirement = await TwoFactorHelper.getSecondFactorRequirement(user, organization, { loginMethod: SessionLoginMethod.SSO });
            expect(requirement.type).toBe('setup');
        });

        test('a password login is always forced to enroll', async () => {
            const { organization, user } = await adminOfOrgRequiringTwoFactor({ withPassword: true });

            const requirement = await TwoFactorHelper.getSecondFactorRequirement(user, organization, { loginMethod: SessionLoginMethod.Password });
            expect(requirement.type).toBe('setup');
        });

        test('the session of an SSO login that passed a second factor is an SSO session', async () => {
            // The session is only created after the second factor, so the challenge has to
            // remember how the user got there: it decides how long the session may live.
            const { organization, user } = await adminOfOrgRequiringTwoFactor({ withPassword: false });
            const { secret } = await addConfirmedTOTP(user);

            const requirement = await TwoFactorHelper.getSecondFactorRequirement(user, organization, { loginMethod: SessionLoginMethod.SSO });
            if (requirement.type !== 'challenge') {
                throw new Error('Expected a challenge');
            }

            const response = await testServer.test(tokenEndpoint, mfaGrant(organization, {
                mfa_token: requirement.challenge.token,
                method: 'TOTP',
                code: authenticator.generate(secret),
            }));
            if (!(response.body instanceof TokenStruct)) {
                throw new Error('Expected TokenStruct');
            }

            const token = await Token.getByAccessToken(response.body.accessToken);
            expect((await UserSession.getByID(token!.sessionId))!.loginMethod).toBe(SessionLoginMethod.SSO);
            expect(token!.refreshTokenValidUntil.getTime()).toBeLessThanOrEqual(Date.now() + 3 * 60 * 60 * 1000);
        });
    });

    // -----------------------------------------------------------------------
    // Passkeys are bound to one domain, which limits who can use them
    // -----------------------------------------------------------------------
    describe('passkey availability', () => {
        test('an account of a single organization cannot start a passkey enrollment', async () => {
            // Those accounts are expected to move to their own authentication domain, which
            // would strand any passkey enrolled against the dashboard domain.
            const organization = await new OrganizationFactory({}).create();
            const user = await new UserFactory({ organization, password }).create();
            expect(user.organizationId).not.toBeNull();

            const err = await captureError(testServer.test(new RegisterPasskeyOptionsEndpoint(), bearer(Request.buildJson('POST', '/mfa/passkeys/options', organization.getApiHost()), await freshToken(user))));
            expect(err.code).toBe('passkeys_not_available');
        });

        test('an account of a single organization cannot register a passkey', async () => {
            const organization = await new OrganizationFactory({}).create();
            const user = await new UserFactory({ organization, password }).create();

            const err = await captureError(testServer.test(new RegisterPasskeyEndpoint(), bearer(Request.buildJson('POST', '/mfa/passkeys', organization.getApiHost(), {
                name: 'My key',
                response: { id: 'x', rawId: 'x', type: 'public-key', response: { clientDataJSON: 'x', attestationObject: 'x' } },
            }), await freshToken(user))));
            expect(err.code).toBe('passkeys_not_available');
        });

        test('the status tells the client whether passkeys are available', async () => {
            const organization = await new OrganizationFactory({}).create();
            const organizationUser = await new UserFactory({ organization, password }).create();
            const platformAdmin = await platformUser();

            const scoped = await testServer.test(new GetMFAStatusEndpoint(), bearer(Request.buildJson('GET', '/mfa', organization.getApiHost()), await freshToken(organizationUser)));
            expect((scoped.body as { canUsePasskeys: boolean }).canUsePasskeys).toBe(false);

            const platform = await testServer.test(new GetMFAStatusEndpoint(), bearer(Request.buildJson('GET', '/mfa', undefined), await freshToken(platformAdmin)));
            expect((platform.body as { canUsePasskeys: boolean }).canUsePasskeys).toBe(true);
        });

        test('the forced enrollment error tells the client whether passkeys are available', async () => {
            const organization = await new OrganizationFactory({}).create();
            organization.privateMeta.requireTwoFactor = true;
            await organization.save();
            const user = await new UserFactory({ organization, password, permissions: Permissions.create({ level: PermissionLevel.Full }) }).create();

            const err = await captureError(testServer.test(tokenEndpoint, passwordLogin(organization, user.email, password)));
            expect(err.code).toBe('require_mfa_setup');
            expect((err.meta as { canUsePasskeys: boolean }).canUsePasskeys).toBe(false);
        });

        test('a passkey of another relying party is not offered at login', async () => {
            // What a credential from a different authentication domain would look like once
            // the platform serves more than one.
            const organization = await new OrganizationFactory({}).create();
            const user = await new UserFactory({ organization, password }).create();
            await addConfirmedTOTP(user);

            const foreign = await addPasskey(user);
            foreign.rpId = 'someone-else.example.com';
            await foreign.save();

            const challenge = await requireMfa(organization, user.email, password);
            expect(challenge.methods).toContain('TOTP');
            expect(challenge.methods).not.toContain('Passkey');
            expect(challenge.webauthnAuthenticationOptions).toBeNull();
        });

        test('a passkey of our own relying party is still offered', async () => {
            const organization = await new OrganizationFactory({}).create();
            const user = await new UserFactory({ organization, password }).create();

            const credential = await addPasskey(user);
            credential.rpId = WebauthnHelper.getRpID();
            await credential.save();

            const challenge = await requireMfa(organization, user.email, password);
            expect(challenge.methods).toContain('Passkey');
        });

        test('the native apps are accepted as an origin of the dashboard domain', async () => {
            // The app's web view is served from the dashboard host on a custom scheme, and
            // the app is listed in the associated domains of that host, so it gets handed
            // the same passkeys. Dropping this origin silently breaks passkeys in the apps.
            const rpId = WebauthnHelper.getRpID();
            const origins = WebauthnHelper.getExpectedOrigins(rpId);

            expect(origins).toContain('https://' + rpId);
            expect(origins).toContain('capacitor://' + rpId);
        });

        test('a credential without a stored relying party falls back to the platform one', async () => {
            // Rows created before rpId was stored.
            const organization = await new OrganizationFactory({}).create();
            const user = await new UserFactory({ organization, password }).create();

            const credential = await addPasskey(user);
            expect(credential.rpId).toBeNull();

            const challenge = await requireMfa(organization, user.email, password);
            expect(challenge.methods).toContain('Passkey');
        });
    });

    // -----------------------------------------------------------------------
    // Resolving a challenge that arrived through a redirect (SSO)
    // -----------------------------------------------------------------------
    describe('challenge endpoint', () => {
        test('describes the methods of a pending login', async () => {
            const organization = await new OrganizationFactory({}).create();
            const user = await new UserFactory({ organization, password }).create();
            await addConfirmedTOTP(user);
            await RecoveryCodeHelper.regenerateForUser(user.id);

            const mfaToken = await MFAToken.createFor(user.id, 'login');
            const response = await testServer.test(new GetMFAChallengeEndpoint(), Request.buildJson('POST', '/mfa/challenge', organization.getApiHost(), { token: mfaToken.token }));

            const body = response.body as { token: string; methods: string[] };
            expect(body.token).toBe(mfaToken.token);
            expect(body.methods).toEqual(expect.arrayContaining(['TOTP', 'RecoveryCode']));
        });

        test('stores a fresh webauthn challenge on the token', async () => {
            const organization = await new OrganizationFactory({}).create();
            const user = await new UserFactory({ organization, password }).create();
            await addPasskey(user);

            const mfaToken = await MFAToken.createFor(user.id, 'login');
            expect(mfaToken.webauthnChallenge).toBeNull();

            const response = await testServer.test(new GetMFAChallengeEndpoint(), Request.buildJson('POST', '/mfa/challenge', organization.getApiHost(), { token: mfaToken.token }));

            const options = (response.body as { webauthnAuthenticationOptions: { challenge?: string } }).webauthnAuthenticationOptions;
            expect(options.challenge).toBeTruthy();

            const stored = await MFAToken.select().where('token', mfaToken.token).first(true);
            expect(stored.webauthnChallenge).toBe(options.challenge);
        });
    });
});
