import { Request } from '@simonbackx/simple-endpoints';
import { isSimpleError, isSimpleErrors, SimpleError } from '@simonbackx/simple-errors';
import { EmailVerificationCode, MFARecoveryCode, MFATOTP, MFAToken, Organization, OrganizationFactory, PasswordToken, Token, User, UserFactory, WebauthnCredential } from '@stamhoofd/models';
import { PermissionLevel, Permissions, Token as TokenStruct } from '@stamhoofd/structures';
import { TestUtils } from '@stamhoofd/test-utils';
import crypto from 'crypto';
import { authenticator } from 'otplib';

import { MFATestHelper } from '../../../tests/helpers/MFATestHelper.js';
import { testServer } from '../../../tests/helpers/TestServer.js';
import { RecoveryCodeHelper } from '../../helpers/RecoveryCodeHelper.js';
import { TOTPHelper } from '../../helpers/TOTPHelper.js';
import { ConfirmTOTPEndpoint } from './ConfirmTOTPEndpoint.js';
import { CreateTokenEndpoint } from './CreateTokenEndpoint.js';
import { DeletePasskeyEndpoint } from './DeletePasskeyEndpoint.js';
import { DeleteTOTPEndpoint } from './DeleteTOTPEndpoint.js';
import { GetMFAChallengeEndpoint } from './GetMFAChallengeEndpoint.js';
import { GetMFAStatusEndpoint } from './GetMFAStatusEndpoint.js';
import { RegisterPasskeyOptionsEndpoint } from './RegisterPasskeyOptionsEndpoint.js';
import { SetupTOTPEndpoint } from './SetupTOTPEndpoint.js';
import { VerifyEmailEndpoint } from './VerifyEmailEndpoint.js';

/**
 * Adversarial counterpart of MFA.test.ts.
 *
 * Where MFA.test.ts describes what the feature does, every test here plays an attacker
 * that already got *one* thing (the password, a reset link, a stolen refresh token, a
 * setup token, their own account) and tries to turn it into a session that should have
 * required a second factor, or into the removal of someone's second factor.
 *
 * Each test therefore asserts a rejection. If one of these ever starts passing a request
 * through, that is a real authentication bypass, not a change in behaviour.
 */

const tokenEndpoint = new CreateTokenEndpoint();
const password = 'test-password-1234';

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
    throw new Error('Expected the request to be rejected, but it succeeded');
}

function passwordLogin(organization: Organization | null, email: string, pw: string) {
    return Request.buildJson('POST', '/oauth/token', organization?.getApiHost(), {
        grant_type: 'password',
        username: email,
        password: pw,
    });
}

function mfaGrant(organization: Organization | null, body: Record<string, unknown>) {
    return Request.buildJson('POST', '/oauth/token', organization?.getApiHost(), { grant_type: 'mfa', ...body });
}

function bearer(request: Request, token: Token | string) {
    request.headers.authorization = 'Bearer ' + (typeof token === 'string' ? token : token.accessToken);
    return request;
}

function withSetup(request: Request, setupToken: string) {
    request.headers.authorization = 'MFASetup ' + setupToken;
    return request;
}

async function freshToken(user: User): Promise<Token> {
    return await Token.createToken(user, new Date());
}

async function addConfirmedTOTP(user: User): Promise<{ id: string; secret: string }> {
    return await MFATestHelper.addConfirmedTOTP(user, 'Confirmed authenticator');
}

async function addPasskey(user: User): Promise<WebauthnCredential> {
    const credential = new WebauthnCredential();
    credential.userId = user.id;
    credential.credentialId = 'cred-' + crypto.randomBytes(16).toString('base64url');
    credential.publicKey = crypto.randomBytes(32).toString('base64url');
    credential.counter = 0;
    credential.name = 'Test passkey';
    await credential.save();
    return credential;
}

async function requireMfa(organization: Organization | null, email: string): Promise<{ token: string; methods: string[] }> {
    const err = await captureError(testServer.test(tokenEndpoint, passwordLogin(organization, email, password)));
    expect(err.code).toBe('require_mfa');
    return err.meta as { token: string; methods: string[] };
}

async function organizationRequiringTwoFactor(): Promise<Organization> {
    const organization = await new OrganizationFactory({}).create();
    organization.privateMeta.requireTwoFactor = true;
    await organization.save();
    return organization;
}

/**
 * The code an authenticator app would have shown at a different point in time.
 * Uses a cloned otplib instance so the shared singleton keeps its own options.
 */
function totpCodeAt(secret: string, epoch: number): string {
    return authenticator.clone({ epoch }).generate(secret);
}

describe('MFA security', () => {
    // -----------------------------------------------------------------------
    // The attacker knows the password and tries to skip the second factor
    // -----------------------------------------------------------------------
    describe('attacker knows the password', () => {
        test('a second factor of their own account does not unlock someone else\'s login', async () => {
            const organization = await new OrganizationFactory({}).create();
            const victim = await new UserFactory({ organization, password }).create();
            await addConfirmedTOTP(victim);

            const attacker = await new UserFactory({ organization, password }).create();
            const attackerTotp = await addConfirmedTOTP(attacker);

            const challenge = await requireMfa(organization, victim.email);
            const err = await captureError(testServer.test(tokenEndpoint, mfaGrant(organization, {
                mfa_token: challenge.token,
                method: 'TOTP',
                code: authenticator.generate(attackerTotp.secret),
            })));
            expect(err.code).toBe('invalid_mfa_code');
        });

        test('a recovery code of their own account does not unlock someone else\'s login', async () => {
            const organization = await new OrganizationFactory({}).create();
            const victim = await new UserFactory({ organization, password }).create();
            await addConfirmedTOTP(victim);

            const attacker = await new UserFactory({ organization, password }).create();
            await addConfirmedTOTP(attacker);
            const attackerCodes = await RecoveryCodeHelper.regenerateForUser(attacker.id);

            const challenge = await requireMfa(organization, victim.email);
            const err = await captureError(testServer.test(tokenEndpoint, mfaGrant(organization, {
                mfa_token: challenge.token,
                method: 'RecoveryCode',
                code: attackerCodes[0],
            })));
            expect(err.code).toBe('invalid_mfa_code');

            // The attacker's own code must not have been consumed by the attempt either.
            expect((await MFARecoveryCode.getUnusedForUser(attacker.id)).length).toBe(attackerCodes.length);
        });

        test('an unconfirmed authenticator is not a usable second factor', async () => {
            const organization = await new OrganizationFactory({}).create();
            const user = await new UserFactory({ organization, password }).create();
            await addConfirmedTOTP(user);

            // A never-confirmed enrolment attempt (e.g. abandoned, or started by an
            // attacker with a stolen session) must not be accepted at login.
            const pending = new MFATOTP();
            const pendingSecret = authenticator.generateSecret();
            pending.userId = user.id;
            pending.name = 'Pending';
            pending.secret = TOTPHelper.encrypt(pendingSecret);
            pending.confirmedAt = null;
            await pending.save();

            const challenge = await requireMfa(organization, user.email);
            const err = await captureError(testServer.test(tokenEndpoint, mfaGrant(organization, {
                mfa_token: challenge.token,
                method: 'TOTP',
                code: authenticator.generate(pendingSecret),
            })));
            expect(err.code).toBe('invalid_mfa_code');
        });

        test('a TOTP code from outside the accepted time window is rejected', async () => {
            const organization = await new OrganizationFactory({}).create();
            const user = await new UserFactory({ organization, password }).create();
            const { secret } = await addConfirmedTOTP(user);

            // A code intercepted 5 minutes ago (e.g. from a phishing page or a screenshot)
            // must no longer be worth anything.
            const stale = await captureError(testServer.test(tokenEndpoint, mfaGrant(organization, {
                mfa_token: (await requireMfa(organization, user.email)).token,
                method: 'TOTP',
                code: totpCodeAt(secret, Date.now() - 5 * 60 * 1000),
            })));
            expect(stale.code).toBe('invalid_mfa_code');

            // Nor may a code be accepted far ahead of the current step.
            const future = await captureError(testServer.test(tokenEndpoint, mfaGrant(organization, {
                mfa_token: (await requireMfa(organization, user.email)).token,
                method: 'TOTP',
                code: totpCodeAt(secret, Date.now() + 5 * 60 * 1000),
            })));
            expect(future.code).toBe('invalid_mfa_code');
        });

        test('the challenge never leaks the secret, the recovery codes or a session token', async () => {
            const organization = await new OrganizationFactory({}).create();
            const user = await new UserFactory({ organization, password }).create();
            const { secret } = await addConfirmedTOTP(user);
            const codes = await RecoveryCodeHelper.regenerateForUser(user.id);

            const err = await captureError(testServer.test(tokenEndpoint, passwordLogin(organization, user.email, password)));
            expect(err.code).toBe('require_mfa');

            const meta = err.meta as Record<string, unknown>;
            expect(Object.keys(meta).sort()).toEqual(['methods', 'token', 'webauthnAuthenticationOptions']);

            const serialized = JSON.stringify(meta);
            expect(serialized).not.toContain(secret);
            for (const code of codes) {
                expect(serialized).not.toContain(code);
            }
            // No access/refresh token is smuggled along with the challenge.
            expect(serialized).not.toContain('access_token');
        });
    });

    // -----------------------------------------------------------------------
    // Using one kind of token where another is expected
    // -----------------------------------------------------------------------
    describe('token confusion', () => {
        test('a login MFA token cannot be used as a setup token to enrol a new factor', async () => {
            // The nastiest variant: the attacker knows the password, gets a `require_mfa`
            // challenge, and tries to enrol a factor of their own with that same token.
            const organization = await new OrganizationFactory({}).create();
            const user = await new UserFactory({ organization, password }).create();
            await addConfirmedTOTP(user);

            const challenge = await requireMfa(organization, user.email);

            const err = await captureError(testServer.test(new SetupTOTPEndpoint(), withSetup(Request.buildJson('POST', '/mfa/totp', organization.getApiHost()), challenge.token)));
            expect(err.code).toBe('mfa_setup_expired');
            expect(await MFATOTP.getForUser(user.id)).toHaveLength(1);
        });

        test('a login MFA token cannot be used as an access token', async () => {
            const organization = await new OrganizationFactory({}).create();
            const user = await new UserFactory({ organization, password }).create();
            await addConfirmedTOTP(user);

            const challenge = await requireMfa(organization, user.email);
            const err = await captureError(testServer.test(new GetMFAStatusEndpoint(), bearer(Request.buildJson('GET', '/mfa', organization.getApiHost()), challenge.token)));
            expect(err.code).toBe('invalid_access_token');
        });

        test('a setup token cannot be redeemed through the mfa grant', async () => {
            const organization = await organizationRequiringTwoFactor();
            const user = await new UserFactory({ organization, password, permissions: Permissions.create({ level: PermissionLevel.Full }) }).create();

            const err = await captureError(testServer.test(tokenEndpoint, passwordLogin(organization, user.email, password)));
            expect(err.code).toBe('require_mfa_setup');
            const setupToken = (err.meta as { setupToken: string }).setupToken;

            const reuse = await captureError(testServer.test(tokenEndpoint, mfaGrant(organization, { mfa_token: setupToken, method: 'TOTP', code: '000000' })));
            expect(reuse.code).toBe('invalid_mfa_token');
        });

        test('a password reset token cannot be used as a setup token', async () => {
            const organization = await new OrganizationFactory({}).create();
            const user = await new UserFactory({ organization, password }).create();
            const passwordToken = await PasswordToken.createToken(user);

            const err = await captureError(testServer.test(new SetupTOTPEndpoint(), withSetup(Request.buildJson('POST', '/mfa/totp', organization.getApiHost()), passwordToken.token)));
            expect(err.code).toBe('mfa_setup_expired');
        });
    });

    // -----------------------------------------------------------------------
    // Abusing the forced-enrollment setup token
    // -----------------------------------------------------------------------
    describe('setup token abuse', () => {
        async function startForcedSetup() {
            const organization = await organizationRequiringTwoFactor();
            const user = await new UserFactory({ organization, password, permissions: Permissions.create({ level: PermissionLevel.Full }) }).create();
            const err = await captureError(testServer.test(tokenEndpoint, passwordLogin(organization, user.email, password)));
            expect(err.code).toBe('require_mfa_setup');
            return { organization, user, setupToken: (err.meta as { setupToken: string }).setupToken };
        }

        test('a setup token stops working once the user enrolled a factor elsewhere', async () => {
            const { organization, user, setupToken } = await startForcedSetup();

            // The attacker (who only knows the password) starts enrolling an authenticator
            // of their own with the setup token they were handed.
            const setup = await testServer.test(new SetupTOTPEndpoint(), withSetup(Request.buildJson('POST', '/mfa/totp', organization.getApiHost()), setupToken));
            const { totpId, secret } = setup.body as { totpId: string; secret: string };

            // In the meantime the real user completes the enrolment on their own device.
            await addConfirmedTOTP(user);

            // The account is protected now, so the password-only setup token must be dead.
            const err = await captureError(testServer.test(new ConfirmTOTPEndpoint(), withSetup(Request.buildJson('POST', `/mfa/totp/${totpId}/confirm`, organization.getApiHost(), { code: authenticator.generate(secret), name: 'Attacker' }), setupToken)));
            expect(err.code).toBe('mfa_setup_expired');

            // The attacker's authenticator was never confirmed, so it is not a factor.
            expect((await MFATOTP.getByID(totpId))?.confirmedAt ?? null).toBeNull();

            // And the token is gone: retrying does not help.
            expect(await MFAToken.getValid(setupToken, 'setup')).toBeUndefined();
        });

        test('a dead setup token cannot start a passkey enrolment either', async () => {
            const { organization, user, setupToken } = await startForcedSetup();
            await addPasskey(user);

            const err = await captureError(testServer.test(new RegisterPasskeyOptionsEndpoint(), withSetup(Request.buildJson('POST', '/mfa/passkeys/options', organization.getApiHost()), setupToken)));
            expect(err.code).toBe('mfa_setup_expired');
        });

        test('a setup token only acts for its own user', async () => {
            const { organization, setupToken } = await startForcedSetup();

            const victim = await new UserFactory({ organization, password }).create();
            const victimTotp = await addConfirmedTOTP(victim);

            const err = await captureError(testServer.test(new ConfirmTOTPEndpoint(), withSetup(Request.buildJson('POST', `/mfa/totp/${victimTotp.id}/confirm`, organization.getApiHost(), { code: authenticator.generate(victimTotp.secret), name: 'x' }), setupToken)));
            expect(err.code).toBe('not_found');
        });

        test('an expired setup token is refused', async () => {
            const { organization, setupToken } = await startForcedSetup();

            const row = await MFAToken.select().where('token', setupToken).first(true);
            row.expiresAt = new Date(Date.now() - 1000);
            await row.save();

            const err = await captureError(testServer.test(new SetupTOTPEndpoint(), withSetup(Request.buildJson('POST', '/mfa/totp', organization.getApiHost()), setupToken)));
            expect(err.code).toBe('mfa_setup_expired');
        });
    });

    // -----------------------------------------------------------------------
    // Attacker holds a session and tries to strip the second factor
    // -----------------------------------------------------------------------
    describe('removing a second factor', () => {
        test('a stolen refresh token cannot be traded for a session that removes a factor', async () => {
            const organization = await new OrganizationFactory({}).create();
            const user = await new UserFactory({ organization, password }).create();
            const { id: totpId, secret } = await addConfirmedTOTP(user);

            // A complete, legitimate login (password + TOTP).
            const challenge = await requireMfa(organization, user.email);
            const login = await testServer.test(tokenEndpoint, mfaGrant(organization, { mfa_token: challenge.token, method: 'TOTP', code: authenticator.generate(secret) }));
            const refreshToken = (login.body as TokenStruct).refreshToken;

            // The attacker exfiltrates the refresh token and rotates it into a session.
            const refreshed = await testServer.test(tokenEndpoint, Request.buildJson('POST', '/oauth/token', organization.getApiHost(), {
                grant_type: 'refresh_token',
                refresh_token: refreshToken,
            }));
            const accessToken = (refreshed.body as TokenStruct).accessToken;
            expect((await Token.getByAccessToken(accessToken))?.isFresh()).toBe(false);

            // That session must not be enough to disable two-factor authentication.
            const err = await captureError(testServer.test(new DeleteTOTPEndpoint(), bearer(Request.buildJson('DELETE', `/mfa/totp/${totpId}`, organization.getApiHost()), accessToken)));
            expect(err.code).toBe('require_fresh_auth');
            expect(await MFATOTP.getByID(totpId)).toBeDefined();
        });

        test('a session that authenticated longer ago than the freshness window is refused', async () => {
            const organization = await new OrganizationFactory({}).create();
            const user = await new UserFactory({ organization, password }).create();
            const { id: totpId } = await addConfirmedTOTP(user);

            const token = await freshToken(user);
            token.authenticatedAt = new Date(Date.now() - Token.FRESH_WINDOW - 60 * 1000);
            await token.save();

            const err = await captureError(testServer.test(new DeleteTOTPEndpoint(), bearer(Request.buildJson('DELETE', `/mfa/totp/${totpId}`, organization.getApiHost()), token)));
            expect(err.code).toBe('require_fresh_auth');
            expect(await MFATOTP.getByID(totpId)).toBeDefined();
        });

        test('another user\'s passkey cannot be deleted, not even with a fresh session', async () => {
            const organization = await new OrganizationFactory({}).create();
            const victim = await new UserFactory({ organization, password }).create();
            const passkey = await addPasskey(victim);

            const attacker = await new UserFactory({ organization, password }).create();
            const err = await captureError(testServer.test(new DeletePasskeyEndpoint(), bearer(Request.buildJson('DELETE', `/mfa/passkeys/${passkey.id}`, organization.getApiHost()), await freshToken(attacker))));
            expect(err.code).toBe('not_found');
            expect(await WebauthnCredential.getByID(passkey.id)).toBeDefined();
        });
    });

    // -----------------------------------------------------------------------
    // Evading the organization scope (platform mode)
    // -----------------------------------------------------------------------
    describe('organization scope evasion', () => {
        /**
         * In platform mode users are not bound to an organization: the scope comes from the
         * API host, while the session that comes out works everywhere. So the requirement of
         * an organization may never depend on which host the request happened to hit.
         */
        async function platformModeAdmin() {
            TestUtils.setEnvironment('userMode', 'platform');
            const organization = await organizationRequiringTwoFactor();
            const user = await new UserFactory({ organization, password, permissions: Permissions.create({ level: PermissionLevel.Full }) }).create();
            expect(user.organizationId).toBeNull();
            return { organization, user };
        }

        test('an admin cannot dodge forced enrollment by signing in on the unscoped host', async () => {
            const { organization, user } = await platformModeAdmin();

            // Sanity check: on the organization's own host, enrollment is enforced.
            const scoped = await captureError(testServer.test(tokenEndpoint, passwordLogin(organization, user.email, password)));
            expect(scoped.code).toBe('require_mfa_setup');

            // Same account, same password, no organization in scope.
            const unscoped = await captureError(testServer.test(tokenEndpoint, passwordLogin(null, user.email, password)));
            expect(unscoped.code).toBe('require_mfa_setup');
        });

        test('an admin cannot remove their last factor by dropping the organization scope', async () => {
            const { user } = await platformModeAdmin();
            const { id: totpId } = await addConfirmedTOTP(user);

            const err = await captureError(testServer.test(new DeleteTOTPEndpoint(), bearer(Request.buildJson('DELETE', `/mfa/totp/${totpId}`, undefined), await freshToken(user))));
            expect(err.code).toBe('cannot_remove_last_factor');
            expect(await MFATOTP.getByID(totpId)).toBeDefined();
        });

        test('a user without permissions in the organization is still not forced', async () => {
            TestUtils.setEnvironment('userMode', 'platform');
            await organizationRequiringTwoFactor();
            const user = await new UserFactory({ password }).create();

            const response = await testServer.test(tokenEndpoint, passwordLogin(null, user.email, password));
            expect(response.body).toBeInstanceOf(TokenStruct);
        });

        test('an MFA challenge cannot be completed from another organization\'s scope', async () => {
            const organization = await new OrganizationFactory({}).create();
            const other = await new OrganizationFactory({}).create();
            const user = await new UserFactory({ organization, password }).create();
            const { secret } = await addConfirmedTOTP(user);

            const challenge = await requireMfa(organization, user.email);
            const err = await captureError(testServer.test(tokenEndpoint, mfaGrant(other, {
                mfa_token: challenge.token,
                method: 'TOTP',
                code: authenticator.generate(secret),
            })));
            expect(err.code).toBe('invalid_mfa_token');
        });

        test('an MFA challenge for an organization user cannot be completed unscoped', async () => {
            const organization = await new OrganizationFactory({}).create();
            const user = await new UserFactory({ organization, password }).create();
            const { secret } = await addConfirmedTOTP(user);

            const challenge = await requireMfa(organization, user.email);
            const err = await captureError(testServer.test(tokenEndpoint, mfaGrant(null, {
                mfa_token: challenge.token,
                method: 'TOTP',
                code: authenticator.generate(secret),
            })));
            expect(err.code).toBe('invalid_mfa_token');
        });
    });

    // -----------------------------------------------------------------------
    // Email verification as an alternative way in
    // -----------------------------------------------------------------------
    describe('email verification', () => {
        test('an invalid session header does not turn into a skipped second factor', async () => {
            // The signed-in shortcut in VerifyEmailEndpoint swallows every authentication
            // error, so an unusable Authorization header must not read as "already signed
            // in as this user".
            const organization = await new OrganizationFactory({}).create();
            const user = await new UserFactory({ organization, password }).create();
            await addConfirmedTOTP(user);

            const code = await EmailVerificationCode.createFor(user, user.email);
            const request = bearer(Request.buildJson('POST', '/verify-email', organization.getApiHost(), { token: code.token, code: code.code }), 'not-a-real-access-token');

            const err = await captureError(testServer.test(new VerifyEmailEndpoint(), request));
            expect(err.code).toBe('require_mfa');
        });

        test('an expired session of the same user does not skip the second factor', async () => {
            const organization = await new OrganizationFactory({}).create();
            const user = await new UserFactory({ organization, password }).create();
            await addConfirmedTOTP(user);

            const expired = await freshToken(user);
            expired.accessTokenValidUntil = new Date(Date.now() - 60 * 1000);
            await expired.save();

            const code = await EmailVerificationCode.createFor(user, user.email);
            const err = await captureError(testServer.test(new VerifyEmailEndpoint(), bearer(Request.buildJson('POST', '/verify-email', organization.getApiHost(), { token: code.token, code: code.code }), expired)));
            expect(err.code).toBe('require_mfa');
        });
    });

    // -----------------------------------------------------------------------
    // Changing the factors of an account ends the sessions the user is not on
    // -----------------------------------------------------------------------
    describe('other sessions are signed out', () => {
        /**
         * Enrolling or removing a factor is what a user does when they suspect someone else
         * is in their account. A session the attacker already holds must not survive it.
         */
        test('enrolling a factor signs out the sessions the user is not enrolling from', async () => {
            const organization = await new OrganizationFactory({}).create();
            const user = await new UserFactory({ organization, password }).create();

            const stolen = await freshToken(user);
            const current = await freshToken(user);

            const setup = await testServer.test(new SetupTOTPEndpoint(), bearer(Request.buildJson('POST', '/mfa/totp', organization.getApiHost()), current));
            const { totpId, secret } = setup.body as { totpId: string; secret: string };
            await testServer.test(new ConfirmTOTPEndpoint(), bearer(Request.buildJson('POST', `/mfa/totp/${totpId}/confirm`, organization.getApiHost(), { code: authenticator.generate(secret), name: 'Phone' }), current));

            expect(await Token.getByAccessToken(stolen.accessToken, true)).toBeUndefined();
            // The session that did the enrolling stays signed in.
            expect(await Token.getByAccessToken(current.accessToken, true)).toBeDefined();
        });

        test('removing a factor signs out the other sessions', async () => {
            const organization = await new OrganizationFactory({}).create();
            const user = await new UserFactory({ organization, password }).create();
            const { id: totpId } = await addConfirmedTOTP(user);
            await addConfirmedTOTP(user);

            const stolen = await freshToken(user);
            const current = await freshToken(user);

            await testServer.test(new DeleteTOTPEndpoint(), bearer(Request.buildJson('DELETE', `/mfa/totp/${totpId}`, organization.getApiHost()), current));

            expect(await Token.getByAccessToken(stolen.accessToken, true)).toBeUndefined();
            expect(await Token.getByAccessToken(current.accessToken, true)).toBeDefined();
        });

        test('forced enrollment signs out the temporary session it started from', async () => {
            // The password-token grant hands out a temporary session before enrollment.
            // Once the user enrolls, only the session returned by the enrollment survives.
            const organization = await organizationRequiringTwoFactor();
            const user = await new UserFactory({ organization, password, permissions: Permissions.create({ level: PermissionLevel.Full }) }).create();

            const passwordToken = await PasswordToken.createToken(user);
            const err = await captureError(testServer.test(tokenEndpoint, Request.buildJson('POST', '/oauth/token', organization.getApiHost(), { grant_type: 'password_token', token: passwordToken.token })));
            expect(err.code).toBe('require_mfa_setup');

            const meta = err.meta as { setupToken: string; token: { access_token: string } };
            const temporary = meta.token.access_token;

            const setup = await testServer.test(new SetupTOTPEndpoint(), withSetup(Request.buildJson('POST', '/mfa/totp', organization.getApiHost()), meta.setupToken));
            const { totpId, secret } = setup.body as { totpId: string; secret: string };
            const confirm = await testServer.test(new ConfirmTOTPEndpoint(), withSetup(Request.buildJson('POST', `/mfa/totp/${totpId}/confirm`, organization.getApiHost(), { code: authenticator.generate(secret), name: 'Phone' }), meta.setupToken));

            const issued = (confirm.body as { token: { accessToken: string } }).token;
            expect(await Token.getByAccessToken(temporary, true)).toBeUndefined();
            expect(await Token.getByAccessToken(issued.accessToken, true)).toBeDefined();
        });

        test('an API user keeps its key when its own permissions are unrelated', async () => {
            // Guards against a future caller wiping machine credentials: they are managed
            // separately and are not browser sessions.
            const organization = await new OrganizationFactory({}).create();
            const apiUser = await new UserFactory({ organization, apiUser: true }).create();
            const apiToken = await Token.createToken(apiUser);

            expect(await Token.deleteOtherSessions(apiUser.id, null)).toBe(0);
            expect(await Token.getByAccessToken(apiToken.accessToken, true)).toBeDefined();
        });
    });

    // -----------------------------------------------------------------------
    // Brute force: parallel guesses must each cost a try
    // -----------------------------------------------------------------------
    describe('parallel guessing', () => {
        test('guesses sent at the same time all count towards the try limit', async () => {
            const organization = await new OrganizationFactory({}).create();
            const user = await new UserFactory({ organization, password }).create();
            const created = await MFAToken.createFor(user.id, 'login');

            // Every request loads its own copy of the row, exactly like five concurrent
            // requests to the mfa grant would. A read-modify-write counter would end at 1.
            const copies = await Promise.all(
                Array.from({ length: MFAToken.MAX_TRIES }, () => MFAToken.getValid(created.token, 'login')),
            );
            await Promise.all(copies.map(copy => copy!.registerFailedAttempt()));

            const after = await MFAToken.select().where('token', created.token).first(true);
            expect(after.tries).toBe(MFAToken.MAX_TRIES);

            // And the token is spent: it is no longer accepted.
            expect(await MFAToken.getValid(created.token, 'login')).toBeUndefined();
        });

        test('a superseded challenge token stops working', async () => {
            const organization = await new OrganizationFactory({}).create();
            const user = await new UserFactory({ organization, password }).create();
            const { secret } = await addConfirmedTOTP(user);

            const first = await requireMfa(organization, user.email);
            await requireMfa(organization, user.email);

            const err = await captureError(testServer.test(tokenEndpoint, mfaGrant(organization, {
                mfa_token: first.token,
                method: 'TOTP',
                code: authenticator.generate(secret),
            })));
            expect(err.code).toBe('invalid_mfa_token');
        });
    });

    // -----------------------------------------------------------------------
    // The SSO challenge endpoint is not a way to reach anything else
    // -----------------------------------------------------------------------
    describe('challenge endpoint', () => {
        test('a setup token cannot be described as a login challenge', async () => {
            const organization = await organizationRequiringTwoFactor();
            const user = await new UserFactory({ organization, password, permissions: Permissions.create({ level: PermissionLevel.Full }) }).create();
            const err = await captureError(testServer.test(tokenEndpoint, passwordLogin(organization, user.email, password)));
            const setupToken = (err.meta as { setupToken: string }).setupToken;

            const rejected = await captureError(testServer.test(new GetMFAChallengeEndpoint(), Request.buildJson('POST', '/mfa/challenge', organization.getApiHost(), { token: setupToken })));
            expect(rejected.code).toBe('invalid_mfa_token');
        });

        test('an unknown token is rejected', async () => {
            const organization = await new OrganizationFactory({}).create();
            const err = await captureError(testServer.test(new GetMFAChallengeEndpoint(), Request.buildJson('POST', '/mfa/challenge', organization.getApiHost(), { token: 'does-not-exist' })));
            expect(err.code).toBe('invalid_mfa_token');
        });

        test('a locked out token is rejected', async () => {
            const organization = await new OrganizationFactory({}).create();
            const user = await new UserFactory({ organization, password }).create();
            await addConfirmedTOTP(user);
            const challenge = await requireMfa(organization, user.email);

            const row = await MFAToken.select().where('token', challenge.token).first(true);
            row.tries = MFAToken.MAX_TRIES;
            await row.save();

            const err = await captureError(testServer.test(new GetMFAChallengeEndpoint(), Request.buildJson('POST', '/mfa/challenge', organization.getApiHost(), { token: challenge.token })));
            expect(err.code).toBe('invalid_mfa_token');
        });
    });

    // -----------------------------------------------------------------------
    // Storage: nothing that unlocks an account may be readable in the database
    // -----------------------------------------------------------------------
    describe('secrets at rest', () => {
        test('TOTP secrets are not stored in plaintext', async () => {
            const organization = await new OrganizationFactory({}).create();
            const user = await new UserFactory({ organization, password }).create();
            const { id, secret } = await addConfirmedTOTP(user);

            const stored = await MFATOTP.getByID(id);
            expect(stored!.secret).not.toContain(secret);
        });

        test('recovery codes are only stored as hashes', async () => {
            const organization = await new OrganizationFactory({}).create();
            const user = await new UserFactory({ organization, password }).create();
            const codes = await RecoveryCodeHelper.regenerateForUser(user.id);

            const stored = await MFARecoveryCode.getForUser(user.id);
            expect(stored.length).toBe(codes.length);

            for (const row of stored) {
                expect(row.codeHash.startsWith('$argon2')).toBe(true);
                for (const code of codes) {
                    expect(row.codeHash).not.toContain(code.replace(/-/g, ''));
                }
            }
        });
    });
});
