import { Request } from '@simonbackx/simple-endpoints';
import type { Organization } from '@stamhoofd/models';
import { OrganizationFactory, User, UserFactory } from '@stamhoofd/models';
import { PermissionLevel, Permissions } from '@stamhoofd/structures';
import { STExpect, TestUtils } from '@stamhoofd/test-utils';

import { testServer } from '../../../../../tests/helpers/TestServer.js';
import { SessionService } from '../../../../services/SessionService.js';
import { DeleteUserEndpoint } from './DeleteUserEndpoint.js';

describe('Endpoint.DeleteUser', () => {
    const endpoint = new DeleteUserEndpoint();

    async function createFullAdmin(organization: Organization) {
        return await new UserFactory({
            organization,
            permissions: Permissions.create({ level: PermissionLevel.Full }),
        }).create();
    }

    async function deleteUser(organization: Organization, admin: User, userId: string) {
        const token = await SessionService.createSession(admin);
        const request = Request.buildJson('DELETE', '/user/' + userId, organization.getApiHost());
        request.headers.authorization = 'Bearer ' + token.accessToken;
        return await testServer.test(endpoint, request);
    }

    describe('Platform mode', () => {
        beforeEach(() => {
            TestUtils.setEnvironment('userMode', 'platform');
        });

        test('an organization admin cannot delete a platform user without permissions in their organization', async () => {
            const organization = await new OrganizationFactory({}).create();
            const admin = await createFullAdmin(organization);
            const parent = await new UserFactory({}).create();

            await expect(deleteUser(organization, admin, parent.id)).rejects.toThrow(STExpect.errorWithCode('permission_denied'));
            expect(await User.getByID(parent.id)).toBeDefined();
        });

        test('an organization admin cannot delete a platform admin', async () => {
            const organization = await new OrganizationFactory({}).create();
            const admin = await createFullAdmin(organization);
            const platformAdmin = await new UserFactory({ globalPermissions: Permissions.create({ level: PermissionLevel.Full }) }).create();

            await expect(deleteUser(organization, admin, platformAdmin.id)).rejects.toThrow(STExpect.errorWithCode('permission_denied'));
            expect(await User.getByID(platformAdmin.id)).toBeDefined();
        });

        test('deleting an admin of the organization only revokes the permissions for that organization', async () => {
            const organization = await new OrganizationFactory({}).create();
            const other = await new OrganizationFactory({}).create();
            const admin = await createFullAdmin(organization);
            const colleague = await new UserFactory({ organization, permissions: Permissions.create({ level: PermissionLevel.Write }) }).create();
            colleague.permissions!.organizationPermissions.set(other.id, Permissions.create({ level: PermissionLevel.Read }));
            await colleague.save();

            // The admin has full access to the other organization too, so the colleague's permissions are covered
            admin.permissions!.organizationPermissions.set(other.id, Permissions.create({ level: PermissionLevel.Full }));
            await admin.save();

            const response = await deleteUser(organization, admin, colleague.id);
            expect(response.status).toBe(200);

            const refreshed = await User.getByID(colleague.id);
            expect(refreshed).toBeDefined();
            expect(refreshed!.permissions!.organizationPermissions.get(organization.id)).toBeUndefined();
            expect(refreshed!.permissions!.organizationPermissions.get(other.id)?.level).toBe(PermissionLevel.Read);
        });

        test('an organization admin cannot delete an admin with permissions in an organization they do not manage', async () => {
            const organization = await new OrganizationFactory({}).create();
            const other = await new OrganizationFactory({}).create();
            const admin = await createFullAdmin(organization);
            const colleague = await new UserFactory({ organization, permissions: Permissions.create({ level: PermissionLevel.Write }) }).create();
            colleague.permissions!.organizationPermissions.set(other.id, Permissions.create({ level: PermissionLevel.Read }));
            await colleague.save();

            await expect(deleteUser(organization, admin, colleague.id)).rejects.toThrow(STExpect.errorWithCode('permission_denied'));

            const refreshed = await User.getByID(colleague.id);
            expect(refreshed!.permissions!.organizationPermissions.get(organization.id)?.level).toBe(PermissionLevel.Write);
        });

        test('an organization admin can delete an API key of their organization, but not of another organization', async () => {
            const organization = await new OrganizationFactory({}).create();
            const other = await new OrganizationFactory({}).create();
            const admin = await createFullAdmin(organization);
            // API keys are always bound to the organization that created them, also in platform mode
            const ownKey = await new UserFactory({ organization, apiUser: true, permissions: Permissions.create({ level: PermissionLevel.Read }) }).create();
            ownKey.organizationId = organization.id;
            await ownKey.save();
            const otherKey = await new UserFactory({ organization: other, apiUser: true, permissions: Permissions.create({ level: PermissionLevel.Read }) }).create();
            otherKey.organizationId = other.id;
            await otherKey.save();
            expect(ownKey.isApiUser).toBe(true);

            await expect(deleteUser(organization, admin, otherKey.id)).rejects.toThrow(STExpect.errorWithCode('permission_denied'));
            expect(await User.getByID(otherKey.id)).toBeDefined();

            const response = await deleteUser(organization, admin, ownKey.id);
            expect(response.status).toBe(200);
            expect(await User.getByID(ownKey.id)).toBeUndefined();
        });

        test('a platform admin deleting a platform-level user on an organization host only revokes the organization permissions', async () => {
            const organization = await new OrganizationFactory({}).create();
            const platformAdmin = await new UserFactory({ globalPermissions: Permissions.create({ level: PermissionLevel.Full }) }).create();
            const colleague = await new UserFactory({ organization, permissions: Permissions.create({ level: PermissionLevel.Write }) }).create();

            const response = await deleteUser(organization, platformAdmin, colleague.id);
            expect(response.status).toBe(200);

            const refreshed = await User.getByID(colleague.id);
            expect(refreshed).toBeDefined();
            expect(refreshed!.permissions).toBeNull();
        });

        test('an admin cannot delete their own account', async () => {
            const organization = await new OrganizationFactory({}).create();
            const admin = await createFullAdmin(organization);

            await expect(deleteUser(organization, admin, admin.id)).rejects.toThrow(STExpect.errorWithCode('permission_denied'));
            expect(await User.getByID(admin.id)).toBeDefined();
        });

        test('an unknown user id is refused', async () => {
            const organization = await new OrganizationFactory({}).create();
            const admin = await createFullAdmin(organization);

            await expect(deleteUser(organization, admin, 'does-not-exist')).rejects.toThrow(STExpect.errorWithCode('permission_denied'));
        });

        test('an admin without full access cannot delete anything', async () => {
            const organization = await new OrganizationFactory({}).create();
            const admin = await new UserFactory({ organization, permissions: Permissions.create({ level: PermissionLevel.Write }) }).create();
            const colleague = await new UserFactory({ organization, permissions: Permissions.create({ level: PermissionLevel.Read }) }).create();

            await expect(deleteUser(organization, admin, colleague.id)).rejects.toThrow(STExpect.errorWithCode('permission_denied'));
        });
    });

    describe('Organization mode', () => {
        beforeEach(() => {
            TestUtils.setEnvironment('userMode', 'organization');
        });

        test('a full admin deletes an admin of their organization', async () => {
            const organization = await new OrganizationFactory({}).create();
            const admin = await createFullAdmin(organization);
            const colleague = await new UserFactory({ organization, permissions: Permissions.create({ level: PermissionLevel.Write }) }).create();

            const response = await deleteUser(organization, admin, colleague.id);
            expect(response.status).toBe(200);
            expect(await User.getByID(colleague.id)).toBeUndefined();
        });

        test('a full admin cannot delete a user of another organization', async () => {
            const organization = await new OrganizationFactory({}).create();
            const other = await new OrganizationFactory({}).create();
            const admin = await createFullAdmin(organization);
            const stranger = await new UserFactory({ organization: other }).create();

            await expect(deleteUser(organization, admin, stranger.id)).rejects.toThrow(STExpect.errorWithCode('permission_denied'));
            expect(await User.getByID(stranger.id)).toBeDefined();
        });
    });
});
