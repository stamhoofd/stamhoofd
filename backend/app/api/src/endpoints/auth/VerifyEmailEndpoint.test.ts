import { Request } from '@simonbackx/simple-endpoints';
import { AuditLog, EmailVerificationCode, OrganizationFactory, Token, User, UserFactory } from '@stamhoofd/models';
import type { Organization } from '@stamhoofd/models';
import { AuditLogType, PermissionLevel, PermissionRole, Permissions, Token as TokenStruct } from '@stamhoofd/structures';
import { TestUtils } from '@stamhoofd/test-utils';

import { testServer } from '../../../tests/helpers/TestServer.js';
import { VerifyEmailEndpoint } from './VerifyEmailEndpoint.js';

describe('Endpoint.VerifyEmail', () => {
    const endpoint = new VerifyEmailEndpoint();

    beforeEach(() => {
        TestUtils.setEnvironment('userMode', 'organization');
    });

    /**
     * Create a user with permissions for the given organization.
     */
    async function createUserWithPermissions(organization: Organization, email: string, permissions?: Permissions) {
        return await new UserFactory({
            organization,
            email,
            permissions,
        }).create();
    }

    /**
     * Build a verification code for the given user that will change the user's email to `newEmail`
     * on verification, and run the endpoint with it.
     */
    async function verifyEmail(organization: Organization, user: User, newEmail: string) {
        const code = await EmailVerificationCode.createFor(user, newEmail);

        const request = Request.buildJson('POST', '/verify-email', organization.getApiHost(), {
            token: code.token,
            code: code.code,
        });

        return await testServer.test(endpoint, request);
    }

    test('merges the permissions of the deleted user into the kept user', async () => {
        const organization = await new OrganizationFactory({}).create();

        // The user that keeps existing and changes its email to the other user's email
        const keptUser = await createUserWithPermissions(organization, 'kept@example.com', Permissions.create({
            roles: [PermissionRole.create({ id: 'role-a', name: 'Role A' })],
        }));

        // The user that will be found by its email and merged into (and deleted)
        const otherUser = await createUserWithPermissions(organization, 'other@example.com', Permissions.create({
            level: PermissionLevel.Full,
            roles: [PermissionRole.create({ id: 'role-b', name: 'Role B' })],
        }));

        const response = await verifyEmail(organization, keptUser, otherUser.email);
        expect(response.status).toBe(200);

        // The other user is deleted
        expect(await User.getByID(otherUser.id)).toBeUndefined();

        // The kept user now holds both users' permissions for the organization
        const refreshed = await User.getByID(keptUser.id);
        expect(refreshed).toBeDefined();
        expect(refreshed!.email).toBe('other@example.com');

        const merged = refreshed!.permissions!.organizationPermissions.get(organization.id);
        expect(merged).toBeDefined();
        expect(merged!.level).toBe(PermissionLevel.Full);
        expect(merged!.roles.map(r => r.id).sort()).toEqual(['role-a', 'role-b']);
    });

    test('adopts the permissions of the deleted user when the kept user has none', async () => {
        const organization = await new OrganizationFactory({}).create();

        // The kept user has no permissions
        const keptUser = await createUserWithPermissions(organization, 'kept@example.com');
        expect(keptUser.permissions).toBeNull();

        const otherUser = await createUserWithPermissions(organization, 'other@example.com', Permissions.create({
            roles: [PermissionRole.create({ id: 'role-b', name: 'Role B' })],
        }));

        const response = await verifyEmail(organization, keptUser, otherUser.email);
        expect(response.status).toBe(200);

        expect(await User.getByID(otherUser.id)).toBeUndefined();

        const refreshed = await User.getByID(keptUser.id);
        const merged = refreshed!.permissions?.organizationPermissions.get(organization.id);
        expect(merged).toBeDefined();
        expect(merged!.roles.map(r => r.id)).toEqual(['role-b']);
    });

    test('reassigns audit logs of the deleted user to the kept user', async () => {
        const organization = await new OrganizationFactory({}).create();

        const keptUser = await createUserWithPermissions(organization, 'kept@example.com');
        const otherUser = await createUserWithPermissions(organization, 'other@example.com');

        // An audit log performed by the user that will be deleted
        const auditLog = new AuditLog();
        auditLog.type = AuditLogType.Unknown;
        auditLog.userId = otherUser.id;
        auditLog.organizationId = organization.id;
        auditLog.description = 'Performed by the other user';
        await auditLog.save();

        const response = await verifyEmail(organization, keptUser, otherUser.email);
        expect(response.status).toBe(200);

        expect(await User.getByID(otherUser.id)).toBeUndefined();

        // The audit log is now attributed to the kept user
        const refreshedLog = await AuditLog.getByID(auditLog.id);
        expect(refreshedLog).toBeDefined();
        expect(refreshedLog!.userId).toBe(keptUser.id);
    });

    test('verifies the email and returns a valid token when merging without throwing', async () => {
        const organization = await new OrganizationFactory({}).create();

        const keptUser = await createUserWithPermissions(organization, 'kept@example.com', Permissions.create({
            roles: [PermissionRole.create({ id: 'role-a', name: 'Role A' })],
        }));
        const otherUser = await createUserWithPermissions(organization, 'other@example.com', Permissions.create({
            roles: [PermissionRole.create({ id: 'role-b', name: 'Role B' })],
        }));

        // Also add an audit log to exercise all merge branches together
        const auditLog = new AuditLog();
        auditLog.type = AuditLogType.Unknown;
        auditLog.userId = otherUser.id;
        auditLog.organizationId = organization.id;
        await auditLog.save();

        const response = await verifyEmail(organization, keptUser, otherUser.email);

        expect(response.body).toBeInstanceOf(TokenStruct);
        if (!(response.body instanceof TokenStruct)) {
            throw new Error('Expected TokenStruct');
        }

        // The returned token belongs to the kept user
        const token = await Token.getByAccessToken(response.body.accessToken);
        expect(token).toBeDefined();
        expect(token!.user.id).toBe(keptUser.id);

        const refreshed = await User.getByID(keptUser.id);
        expect(refreshed!.verified).toBe(true);
        expect(refreshed!.email).toBe('other@example.com');
    });
});
