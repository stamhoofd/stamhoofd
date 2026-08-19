import { Request } from '@simonbackx/simple-endpoints';
import type { Organization, User } from '@stamhoofd/models';
import { OrganizationFactory, Token, UserFactory } from '@stamhoofd/models';
import { PermissionLevel, Permissions, UserPermissions } from '@stamhoofd/structures';
import { STExpect, TestUtils } from '@stamhoofd/test-utils';
import { SessionService } from '../../../../services/SessionService.js';

import { testServer } from '../../../../../tests/helpers/TestServer.js';
import { AdminSessionService } from '../../../../services/AdminSessionService.js';
import { SignOutOrganizationAdminsEndpoint } from './SignOutOrganizationAdminsEndpoint.js';

describe('Endpoint.SignOutOrganizationAdmins', () => {
    const endpoint = new SignOutOrganizationAdminsEndpoint();

    beforeEach(() => {
        TestUtils.setEnvironment('userMode', 'platform');
    });

    const signOut = async (organization: Organization, token: Token) => {
        const request = Request.buildJson('POST', '/organization/admins/sign-out', organization.getApiHost());
        request.headers.authorization = 'Bearer ' + token.accessToken;
        return await testServer.test(endpoint, request);
    };

    /**
     * In platform mode users are not owned by an organization: they have permissions for it.
     */
    const createAdmin = async (organization: Organization, level = PermissionLevel.Full) => {
        const user = await new UserFactory({
            organization,
            permissions: Permissions.create({ level }),
        }).create();
        user.organizationId = null;
        await user.save();
        return user;
    };

    const tokenExists = async (token: Token) => {
        return !!(await Token.getByAccessToken(token.accessToken, true));
    };

    test('all sessions of all admins are signed out, except the one making the request', async () => {
        const organization = await new OrganizationFactory({}).create();
        const otherOrganization = await new OrganizationFactory({}).create();

        const admin = await createAdmin(organization);
        const otherAdmin = await createAdmin(organization);
        const otherOrganizationAdmin = await createAdmin(otherOrganization);
        const member = await new UserFactory({ organization }).create();

        const currentToken = await SessionService.createSession(admin, { authenticatedAt: new Date() });
        const secondDeviceOfAdmin = await SessionService.createSession(admin, { authenticatedAt: new Date() });
        const otherAdminToken = await SessionService.createSession(otherAdmin, { authenticatedAt: new Date() });
        const otherOrganizationAdminToken = await SessionService.createSession(otherOrganizationAdmin, { authenticatedAt: new Date() });
        const memberToken = await SessionService.createSession(member, { authenticatedAt: new Date() });

        const response = await signOut(organization, currentToken);

        // The other device of the admin is signed out too: only this session is spared
        expect(response.body.count).toBe(2);
        expect(await tokenExists(currentToken)).toBe(true);
        expect(await tokenExists(secondDeviceOfAdmin)).toBe(false);
        expect(await tokenExists(otherAdminToken)).toBe(false);

        // Users without permissions in this organization are not affected
        expect(await tokenExists(otherOrganizationAdminToken)).toBe(true);
        expect(await tokenExists(memberToken)).toBe(true);
    });

    test('an admin without full access cannot sign out the other admins', async () => {
        const organization = await new OrganizationFactory({}).create();

        const admin = await createAdmin(organization, PermissionLevel.Write);
        const otherAdmin = await createAdmin(organization);
        const otherAdminToken = await SessionService.createSession(otherAdmin, { authenticatedAt: new Date() });

        await expect(signOut(organization, await SessionService.createSession(admin, { authenticatedAt: new Date() }))).rejects.toThrow(STExpect.simpleError({
            code: 'permission_denied',
        }));
        expect(await tokenExists(otherAdminToken)).toBe(true);
    });

    test('an api user cannot sign out the admins', async () => {
        const organization = await new OrganizationFactory({}).create();

        const apiUser = await new UserFactory({ organization, apiUser: true }).create();
        apiUser.permissions = UserPermissions.create({
            organizationPermissions: new Map([[organization.id, Permissions.create({ level: PermissionLevel.Full })]]),
        });
        await apiUser.save();

        const otherAdmin = await createAdmin(organization);
        const otherAdminToken = await SessionService.createSession(otherAdmin, { authenticatedAt: new Date() });

        await expect(signOut(organization, await SessionService.createApiSession(apiUser))).rejects.toThrow(STExpect.simpleError({
            code: 'permission_denied',
        }));
        expect(await tokenExists(otherAdminToken)).toBe(true);
    });

    test('an organization without admins is a no-op', async () => {
        const organization = await new OrganizationFactory({}).create();
        const member = await new UserFactory({ organization }).create();
        const memberToken = await SessionService.createSession(member, { authenticatedAt: new Date() });

        // Not reachable through the endpoint (the caller is an admin themselves), but the
        // empty list of users may not turn into a query that deletes everything.
        expect(await AdminSessionService.signOutOrganizationAdmins(organization.id, null)).toBe(0);
        expect(await tokenExists(memberToken)).toBe(true);
    });

    describe('userMode organization', () => {
        beforeEach(() => {
            TestUtils.setEnvironment('userMode', 'organization');
        });

        test('all sessions of all admins are signed out, except the one making the request', async () => {
            const organization = await new OrganizationFactory({}).create();

            const admin: User = await new UserFactory({
                organization,
                permissions: Permissions.create({ level: PermissionLevel.Full }),
            }).create();
            const otherAdmin: User = await new UserFactory({
                organization,
                permissions: Permissions.create({ level: PermissionLevel.Full }),
            }).create();
            const member = await new UserFactory({ organization }).create();

            const otherAdminToken = await SessionService.createSession(otherAdmin, { authenticatedAt: new Date() });
            const memberToken = await SessionService.createSession(member, { authenticatedAt: new Date() });

            const response = await signOut(organization, await SessionService.createSession(admin, { authenticatedAt: new Date() }));

            expect(response.body.count).toBe(1);
            expect(await tokenExists(otherAdminToken)).toBe(false);
            expect(await tokenExists(memberToken)).toBe(true);
        });

        test('api users keep their token, because they cannot complete a login', async () => {
            const organization = await new OrganizationFactory({}).create();

            const admin: User = await new UserFactory({
                organization,
                permissions: Permissions.create({ level: PermissionLevel.Full }),
            }).create();

            const apiUser = await new UserFactory({ organization, apiUser: true }).create();
            apiUser.permissions = UserPermissions.create({
                organizationPermissions: new Map([[organization.id, Permissions.create({ level: PermissionLevel.Full })]]),
            });
            await apiUser.save();
            const apiToken = await SessionService.createApiSession(apiUser);

            const response = await signOut(organization, await SessionService.createSession(admin, { authenticatedAt: new Date() }));

            expect(response.body.count).toBe(0);
            expect(await tokenExists(apiToken)).toBe(true);
        });
    });
});
