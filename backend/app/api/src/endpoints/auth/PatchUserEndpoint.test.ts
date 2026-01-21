import { Request } from '@simonbackx/simple-endpoints';
import { OrganizationFactory, UserFactory } from '@stamhoofd/models';

import { NewUser, PermissionRole, Permissions, UserPermissions } from '@stamhoofd/structures';
import { testServer } from '../../../tests/helpers/TestServer.js';
import { initAdmin } from '../../../tests/init/initAdmin.js';
import { PatchUserEndpoint } from './PatchUserEndpoint.js';

describe('Endpoint.PatchUser', () => {
    // Test endpoint
    const endpoint = new PatchUserEndpoint();

    test('[Regression] Sending a patch for organization permissions that does not exist', async () => {
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
});
