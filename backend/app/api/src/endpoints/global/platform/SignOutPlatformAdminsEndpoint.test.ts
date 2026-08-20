import { Request } from '@simonbackx/simple-endpoints';
import type { Organization } from '@stamhoofd/models';
import { OrganizationFactory, Token, UserFactory } from '@stamhoofd/models';
import { PermissionLevel, Permissions } from '@stamhoofd/structures';
import { STExpect, TestUtils } from '@stamhoofd/test-utils';
import { SessionService } from '../../../services/SessionService.js';

import { testServer } from '../../../../tests/helpers/TestServer.js';
import { SignOutPlatformAdminsEndpoint } from './SignOutPlatformAdminsEndpoint.js';

describe('Endpoint.SignOutPlatformAdmins', () => {
    const endpoint = new SignOutPlatformAdminsEndpoint();

    beforeEach(() => {
        TestUtils.setEnvironment('userMode', 'platform');
    });

    const signOut = async (organization: Organization, token: Token) => {
        const request = Request.buildJson('POST', '/platform/admins/sign-out', organization.getApiHost());
        request.headers.authorization = 'Bearer ' + token.accessToken;
        return await testServer.test(endpoint, request);
    };

    const createPlatformAdmin = async (level = PermissionLevel.Full) => {
        return await new UserFactory({
            globalPermissions: Permissions.create({ level }),
        }).create();
    };

    const tokenExists = async (token: Token) => {
        return !!(await Token.getByAccessToken(token.accessToken, true));
    };

    test('all sessions of all platform admins are signed out, except the one making the request', async () => {
        const organization = await new OrganizationFactory({}).create();

        const admin = await createPlatformAdmin();
        const otherAdmin = await createPlatformAdmin();

        // An admin of an organization is not a platform admin
        const organizationAdmin = await new UserFactory({
            organization,
            permissions: Permissions.create({ level: PermissionLevel.Full }),
        }).create();
        organizationAdmin.organizationId = null;
        await organizationAdmin.save();

        const currentToken = await SessionService.createSession(admin, { authenticatedAt: new Date() });
        const secondDeviceOfAdmin = await SessionService.createSession(admin, { authenticatedAt: new Date() });
        const otherAdminToken = await SessionService.createSession(otherAdmin, { authenticatedAt: new Date() });
        const organizationAdminToken = await SessionService.createSession(organizationAdmin, { authenticatedAt: new Date() });

        const response = await signOut(organization, currentToken);

        expect(response.body.count).toBe(2);
        expect(await tokenExists(currentToken)).toBe(true);
        expect(await tokenExists(secondDeviceOfAdmin)).toBe(false);
        expect(await tokenExists(otherAdminToken)).toBe(false);
        expect(await tokenExists(organizationAdminToken)).toBe(true);
    });

    test('a platform admin without full access cannot sign out the other admins', async () => {
        const organization = await new OrganizationFactory({}).create();

        const admin = await createPlatformAdmin(PermissionLevel.Write);
        const otherAdmin = await createPlatformAdmin();
        const otherAdminToken = await SessionService.createSession(otherAdmin, { authenticatedAt: new Date() });

        await expect(signOut(organization, await SessionService.createSession(admin, { authenticatedAt: new Date() }))).rejects.toThrow(STExpect.simpleError({
            code: 'permission_denied',
        }));
        expect(await tokenExists(otherAdminToken)).toBe(true);
    });

    test('an admin of an organization cannot sign out the platform admins', async () => {
        const organization = await new OrganizationFactory({}).create();

        const organizationAdmin = await new UserFactory({
            organization,
            permissions: Permissions.create({ level: PermissionLevel.Full }),
        }).create();
        organizationAdmin.organizationId = null;
        await organizationAdmin.save();

        const platformAdmin = await createPlatformAdmin();
        const platformAdminToken = await SessionService.createSession(platformAdmin, { authenticatedAt: new Date() });

        await expect(signOut(organization, await SessionService.createSession(organizationAdmin, { authenticatedAt: new Date() }))).rejects.toThrow(STExpect.simpleError({
            code: 'permission_denied',
        }));
        expect(await tokenExists(platformAdminToken)).toBe(true);
    });
});
