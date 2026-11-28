import { Request } from '@stamhoofd/node-endpoints';
import {
    EmailTemplateFactory,
    EmailVerificationCode,
    MFARecoveryCode,
    MFATOTP,
    MFAToken,
    OrganizationFactory,
    PasswordToken,
    Token,
    User,
    UserFactory,
    UserSession,
    WebauthnChallenge,
    WebauthnCredential,
} from '@stamhoofd/models';
import { EmailTemplateType, LoginProviderType, UserMeta } from '@stamhoofd/structures';
import { STExpect } from '@stamhoofd/test-utils';

import { MFATestHelper } from '../../../tests/helpers/MFATestHelper.js';
import { testServer } from '../../../tests/helpers/TestServer.js';
import { RecoveryCodeHelper } from '../../helpers/RecoveryCodeHelper.js';
import { SessionService } from '../../services/SessionService.js';
import { DeleteUserEndpoint } from './DeleteUserEndpoint.js';

describe('Endpoint.DeleteUser', () => {
    const endpoint = new DeleteUserEndpoint();

    beforeEach(async () => {
        await new EmailTemplateFactory({
            type: EmailTemplateType.DeleteAccountConfirmation,
        }).create();
    });

    async function deleteAccount(host: string, accessToken: string) {
        const request = Request.buildJson('DELETE', '/user', host);
        request.headers.authorization = 'Bearer ' + accessToken;
        return await testServer.test(endpoint, request);
    }

    async function freshSession(user: User) {
        return await SessionService.createSession(user, { authenticatedAt: new Date() });
    }

    test('a session without a recent authentication cannot delete the account', async () => {
        const organization = await new OrganizationFactory({}).create();
        const user = await new UserFactory({ organization }).create();
        const session = await SessionService.createSession(user);

        await expect(deleteAccount(organization.getApiHost(), session.accessToken)).rejects.toThrow(
            STExpect.simpleError({ code: 'require_fresh_auth' }),
        );

        const kept = await User.getByID(user.id);
        expect(kept!.password).not.toBeNull();
        expect(await Token.getByAccessToken(session.accessToken, true)).toBeDefined();
    });

    test('every session of the user ends, not only the one that made the request', async () => {
        const organization = await new OrganizationFactory({}).create();
        const user = await new UserFactory({ organization }).create();
        const current = await freshSession(user);
        const otherDevice = await SessionService.createSession(user);

        await deleteAccount(organization.getApiHost(), current.accessToken);

        expect(await Token.getByAccessToken(current.accessToken, true)).toBeUndefined();
        expect(await Token.getByAccessToken(otherDevice.accessToken, true)).toBeUndefined();
        expect(await UserSession.getByID(current.sessionId)).toBeUndefined();
        expect(await UserSession.getByID(otherDevice.sessionId)).toBeUndefined();
    });

    test('the login provider link is removed, so the account cannot be reopened through SSO', async () => {
        const organization = await new OrganizationFactory({}).create();
        const user = await new UserFactory({ organization, password: null }).create();
        user.meta = user.meta ?? UserMeta.create({});
        user.meta.loginProviderIds = new Map([[LoginProviderType.SSO, 'subject-1']]);
        await user.save();
        expect(user.hasAccount()).toBe(true);

        const session = await freshSession(user);
        await deleteAccount(organization.getApiHost(), session.accessToken);

        const deleted = await User.getByID(user.id);
        expect(deleted).toBeDefined();
        expect(deleted!.meta?.loginProviderIds.size ?? 0).toBe(0);
        expect(deleted!.password).toBeNull();
        expect(deleted!.verified).toBe(false);
        expect(deleted!.hasAccount()).toBe(false);
    });

    test('outstanding password, email and second factor tokens are dropped', async () => {
        const organization = await new OrganizationFactory({}).create();
        const user = await new UserFactory({ organization }).create();

        const passwordToken = await PasswordToken.createToken(user);
        await passwordToken.save();
        const verificationCode = await EmailVerificationCode.createFor(user, user.email);
        const mfaToken = await MFAToken.createFor(user.id, 'login');

        const session = await freshSession(user);
        await deleteAccount(organization.getApiHost(), session.accessToken);

        expect(await PasswordToken.getToken(passwordToken.token)).toBeUndefined();
        expect(
            await EmailVerificationCode.select().where('id', verificationCode.id).first(false),
        ).toBeNull();
        expect(await MFAToken.getValid(mfaToken.token, 'login')).toBeUndefined();
    });

    test('authenticator apps, recovery codes and passkeys are removed', async () => {
        const organization = await new OrganizationFactory({}).create();
        const user = await new UserFactory({ organization }).create();

        await MFATestHelper.addConfirmedTOTP(user);
        await RecoveryCodeHelper.regenerateForUser(user.id);
        const passkey = new WebauthnCredential();
        passkey.userId = user.id;
        passkey.credentialId = 'cred-' + user.id;
        passkey.publicKey = 'public-key';
        await passkey.save();
        const challenge = await WebauthnChallenge.createFor(user.id, 'pending-challenge');

        const session = await freshSession(user);
        await deleteAccount(organization.getApiHost(), session.accessToken);

        expect(await MFATOTP.getForUser(user.id)).toHaveLength(0);
        expect(await MFARecoveryCode.getForUser(user.id)).toHaveLength(0);
        expect(await WebauthnCredential.getForUser(user.id)).toHaveLength(0);
        expect(await WebauthnChallenge.getByID(challenge.id)).toBeUndefined();
    });
});
