import { Request } from '@simonbackx/simple-endpoints';
import { OrganizationFactory, User, UserFactory } from '@stamhoofd/models';

import { NewUser, PermissionLevel, PermissionRole, Permissions, UserPermissions } from '@stamhoofd/structures';
import { STExpect, TestUtils } from '@stamhoofd/test-utils';
import { testServer } from '../../../tests/helpers/TestServer.js';
import { initAdmin } from '../../../tests/init/initAdmin.js';
import { initPlatformAdmin } from '../../../tests/init/initPlatformAdmin.js';
import { PatchUserEndpoint } from './PatchUserEndpoint.js';

describe('Endpoint.PatchUser', () => {
    // Test endpoint
    const endpoint = new PatchUserEndpoint();

    beforeEach(() => {
        TestUtils.setEnvironment('userMode', 'platform');
    });

    test('[Regression] Sending a patch for organization permissions that does not exist', async () => {
        TestUtils.setEnvironment('userMode', 'organization');

        // Case: User A does not have permissions for organization A.
        // You send a patch to change User A's permissions for organization A
        // In the past, this caused data corruption because the way simple-encoding was implemented

        const organization = await new OrganizationFactory({}).create();
        const user = await new UserFactory({ organization }).create();

        const { adminToken } = await initAdmin({ organization });

        // Try to request members for this group
        const userPermissions = UserPermissions.patch({});
        const permissionsPatch = Permissions.patch({});
        permissionsPatch.roles.addPut(PermissionRole.create({
            id: 'test',
            name: 'Test role',
        }));
        userPermissions.organizationPermissions.set(organization.id, permissionsPatch);

        const request = Request.patch({
            path: `/user/${user.id}`,
            host: organization.getApiHost(),
            headers: {
                authorization: 'Bearer ' + adminToken.accessToken,
            },
            body: NewUser.patch({
                id: user.id,
                permissions: userPermissions,
            }),
        });

        const response = await testServer.test(endpoint, request);
        expect(response.status).toBe(200);

        // This threw in the past when something was wrong
        await user.refresh();

        expect(user.permissions?.organizationPermissions.size).toEqual(1);

        expect(user.permissions?.organizationPermissions.get(organization.id)).toBeDefined();
        expect(user.permissions?.organizationPermissions.get(organization.id)?.roles.length).toEqual(1);
        expect(user.permissions?.organizationPermissions.get(organization.id)?.roles[0].id).toEqual('test');
    });

    test('An organization admin cannot edit the email of a platform account', async () => {
        const organization = await new OrganizationFactory({}).create();
        const target = await User.register(null, NewUser.create({
            email: 'platform-account@example.com',
            password: 'password123',
        }), {
            allowPlatform: true,
        });
        if (!target) {
            throw new Error('Failed to create platform account');
        }
        target.permissions = UserPermissions.create({
            organizationPermissions: new Map([
                [organization.id, Permissions.create({ level: PermissionLevel.Full })],
            ]),
        });
        await target.save();

        const { adminToken } = await initAdmin({ organization });

        const request = Request.patch({
            path: `/user/${target.id}`,
            host: organization.getApiHost(),
            headers: {
                authorization: 'Bearer ' + adminToken.accessToken,
            },
            body: NewUser.patch({
                id: target.id,
                firstName: 'Updated',
                email: 'blocked-platform-email@example.com',
            }),
        });

        const response = await testServer.test(endpoint, request);
        expect(response.status).toBe(200);

        await target.refresh();
        expect(target.firstName).toBe('Updated');
        expect(target.email).toBe('platform-account@example.com');
    });

    test('A platform admin can still edit the email of a platform account', async () => {
        const organization = await new OrganizationFactory({}).create();
        const target = await new UserFactory({}).create();
        const { adminToken } = await initPlatformAdmin();

        const request = Request.patch({
            path: `/user/${target.id}`,
            host: organization.getApiHost(),
            headers: {
                authorization: 'Bearer ' + adminToken.accessToken,
            },
            body: NewUser.patch({
                id: target.id,
                email: 'updated-platform-email@example.com',
            }),
        });

        await expect(testServer.test(endpoint, request)).rejects.toThrow(STExpect.simpleError({
            code: 'verify_email',
        }));
    });

    test('An admin cannot edit the email of a user with full access to another organization', async () => {
        const organizationA = await new OrganizationFactory({}).create();
        const organizationB = await new OrganizationFactory({}).create();
        const target = await new UserFactory({ organization: organizationA, email: 'full-access@example.com' }).create();
        target.permissions = UserPermissions.create({
            organizationPermissions: new Map([
                [organizationA.id, Permissions.create({ level: PermissionLevel.Full })],
                [organizationB.id, Permissions.create({ level: PermissionLevel.Full })],
            ]),
        });
        await target.save();

        const { adminToken } = await initAdmin({ organization: organizationA });

        const request = Request.patch({
            path: `/user/${target.id}`,
            host: organizationA.getApiHost(),
            headers: {
                authorization: 'Bearer ' + adminToken.accessToken,
            },
            body: NewUser.patch({
                id: target.id,
                firstName: 'Updated',
                email: 'blocked-full-access@example.com',
            }),
        });

        const response = await testServer.test(endpoint, request);
        expect(response.status).toBe(200);

        await target.refresh();
        expect(target.firstName).toBe('Updated');
        expect(target.email).toBe('full-access@example.com');
    });
});
