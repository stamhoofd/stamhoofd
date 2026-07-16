import { Endpoint, Request } from '@simonbackx/simple-endpoints';
import { isSimpleError, isSimpleErrors, SimpleError } from '@simonbackx/simple-errors';
import { EmailVerificationCode, MFARecoveryCode, MFATOTP, MFAToken, Organization, PasswordToken, Token, User, UserFactory, OrganizationFactory, WebauthnChallenge, WebauthnCredential } from '@stamhoofd/models';
import { PermissionLevel, Permissions, Token as TokenStruct } from '@stamhoofd/structures';
import { authenticator } from 'otplib';
import crypto from 'crypto';

import { testServer } from '../../../tests/helpers/TestServer.js';
import { RECOVERY_CODE_ALPHABET, RecoveryCodeHelper } from '../../helpers/RecoveryCodeHelper.js';
import { TOTPHelper } from '../../helpers/TOTPHelper.js';
import { ConfirmTOTPEndpoint } from './ConfirmTOTPEndpoint.js';
import { CreateTokenEndpoint } from './CreateTokenEndpoint.js';
import { DeletePasskeyEndpoint } from './DeletePasskeyEndpoint.js';
import { DeleteTOTPEndpoint } from './DeleteTOTPEndpoint.js';
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
    const secret = authenticator.generateSecret();
    const totp = new MFATOTP();
    totp.userId = user.id;
    totp.name = 'Confirmed authenticator';
    totp.secret = TOTPHelper.encrypt(secret);
    totp.confirmedAt = new Date();
    await totp.save();
    return { id: totp.id, secret };
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

const password = 'test-password-1234';

describe('MFA', () => {
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

        test('a global/platform admin without a factor is forced to enroll', async () => {
            const user = await new UserFactory({ password, globalPermissions: Permissions.create({ level: PermissionLevel.Full }) }).create();

            const err = await captureError(testServer.test(tokenEndpoint, passwordLogin(null, user.email, password)));
            expect(err.code).toBe('require_mfa_setup');
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
            const user = await new UserFactory({ organization, password }).create();

            const response = await testServer.test(new RegisterPasskeyOptionsEndpoint(), bearer(Request.buildJson('POST', '/mfa/passkeys/options', organization.getApiHost()), await freshToken(user)));
            const options = (response.body as { options: { challenge?: string } }).options;
            expect(options.challenge).toBeTruthy();
            expect(await WebauthnChallenge.consumeForUser(user.id)).toBeTruthy();
        });

        test('an invalid passkey registration response is rejected', async () => {
            const organization = await new OrganizationFactory({}).create();
            const user = await new UserFactory({ organization, password }).create();
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
    });
});
