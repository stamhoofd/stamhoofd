import { Request } from '@simonbackx/simple-endpoints';
import type { Organization, User } from '@stamhoofd/models';
import { MFATOTP, OrganizationFactory, Token, UserFactory, WebauthnCredential } from '@stamhoofd/models';
import { OrganizationAdmins, PermissionLevel, Permissions } from '@stamhoofd/structures';
import crypto from 'crypto';

import { MFATestHelper } from '../../../../../tests/helpers/MFATestHelper.js';
import { testServer } from '../../../../../tests/helpers/TestServer.js';
import { GetOrganizationAdminsEndpoint } from './GetOrganizationAdminsEndpoint.js';

describe('Endpoint.GetOrganizationAdmins', () => {
    const endpoint = new GetOrganizationAdminsEndpoint();

    async function createAdmin(organization: Organization): Promise<User> {
        return await new UserFactory({
            organization,
            permissions: Permissions.create({ level: PermissionLevel.Full }),
        }).create();
    }

    async function getAdmins(organization: Organization, user: User) {
        const token = await Token.createToken(user, new Date());
        const request = Request.buildJson('GET', '/organization/admins', organization.getApiHost());
        request.headers.authorization = 'Bearer ' + token.accessToken;

        const response = await testServer.test(endpoint, request);
        expect(response.body).toBeInstanceOf(OrganizationAdmins);
        return (response.body as OrganizationAdmins).users;
    }

    test('The last activity of every admin is returned', async () => {
        const organization = await new OrganizationFactory({}).create();
        const user = await new UserFactory({
            organization,
            permissions: Permissions.create({ level: PermissionLevel.Full }),
        }).create();

        const lastActiveAt = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
        lastActiveAt.setMilliseconds(0);

        const inactiveAdmin = await new UserFactory({
            organization,
            permissions: Permissions.create({ level: PermissionLevel.Full }),
        }).create();
        inactiveAdmin.lastActiveAt = lastActiveAt;
        await inactiveAdmin.save();

        const token = await Token.createToken(user, new Date());
        const request = Request.buildJson('GET', '/organization/admins', organization.getApiHost());
        request.headers.authorization = 'Bearer ' + token.accessToken;

        const response = await testServer.test(endpoint, request);
        expect(response.body).toBeInstanceOf(OrganizationAdmins);

        const users = (response.body as OrganizationAdmins).users;
        expect(users.find(u => u.id === inactiveAdmin.id)?.lastActiveAt?.getTime()).toEqual(lastActiveAt.getTime());

        // The user never signed in: the token was created directly.
        expect(users.find(u => u.id === user.id)?.lastActiveAt).toBeNull();
    });

    test('Whether an admin has two-factor authentication is returned', async () => {
        const organization = await new OrganizationFactory({}).create();
        const me = await createAdmin(organization);

        const withTotp = await createAdmin(organization);
        await MFATestHelper.addConfirmedTOTP(withTotp);

        const withPasskey = await createAdmin(organization);
        const credential = new WebauthnCredential();
        credential.userId = withPasskey.id;
        credential.credentialId = 'cred-' + crypto.randomBytes(16).toString('base64url');
        credential.publicKey = crypto.randomBytes(32).toString('base64url');
        credential.name = 'Test passkey';
        await credential.save();

        const withoutFactors = await createAdmin(organization);

        const users = await getAdmins(organization, me);

        expect(users.find(u => u.id === withTotp.id)?.hasTwoFactor).toBe(true);
        expect(users.find(u => u.id === withPasskey.id)?.hasTwoFactor).toBe(true);
        expect(users.find(u => u.id === withoutFactors.id)?.hasTwoFactor).toBe(false);
        expect(users.find(u => u.id === me.id)?.hasTwoFactor).toBe(false);
    });

    test('An authenticator that was never confirmed does not count as two-factor authentication', async () => {
        const organization = await new OrganizationFactory({}).create();
        const me = await createAdmin(organization);

        const totp = new MFATOTP();
        totp.userId = me.id;
        totp.name = 'Pending authenticator';
        totp.secret = 'encrypted-secret';
        await totp.save();

        const users = await getAdmins(organization, me);
        expect(users.find(u => u.id === me.id)?.hasTwoFactor).toBe(false);
    });
});
