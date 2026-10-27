import { Request } from '@node/endpoints';
import { Member, MemberFactory, OrganizationFactory, UserFactory } from '@stamhoofd/models';

import { LoginProviderType, NewUser, PermissionRole, Permissions, UserMeta, UserPermissions } from '@stamhoofd/structures';
import { Language } from '@stamhoofd/types/Language';
import { testServer } from '../../../tests/helpers/TestServer.js';
import { initAdmin } from '../../../tests/init/initAdmin.js';
import { SessionService } from '../../services/SessionService.js';
import { PatchUserEndpoint } from './PatchUserEndpoint.js';

describe('Endpoint.PatchUser', () => {
    // Test endpoint
    const endpoint = new PatchUserEndpoint();

    /**
     * A user with both a password and an SSO link needs recent authentication to
     * replace the password or remove either login method. The access token is
     * newly issued, but its authentication timestamp is an hour old: freshness
     * depends on proving identity, not on when the token was issued.
     * Each patch must return the reauthentication signal `require_fresh_auth`.
     */
    test.each(['password', 'remove-password', 'remove-provider'])('an old session cannot change login credentials: %s', async (action) => {
        const organization = await new OrganizationFactory({}).create();
        const user = await new UserFactory({ organization, password: 'test-password-1234' }).create();
        user.meta = UserMeta.create({ loginProviderIds: new Map([[LoginProviderType.SSO, 'subject-1']]) });
        await user.save();
        const body = NewUser.patch({ id: user.id });
        if (action === 'password') {
            body.password = 'replacement-password-1234';
        } else if (action === 'remove-password') {
            body.hasPassword = false;
        } else {
            const meta = UserMeta.patch({});
            meta.loginProviderIds.set(LoginProviderType.SSO, null);
            body.meta = meta;
        }
        const token = await SessionService.createSession(user, { authenticatedAt: new Date(Date.now() - 60 * 60 * 1000) });
        await expect(testServer.test(endpoint, Request.patch({
            path: `/user/${user.id}`,
            host: organization.getApiHost(),
            headers: { authorization: 'Bearer ' + token.accessToken },
            body,
        }))).rejects.toMatchObject({ code: 'require_fresh_auth' });
    });

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

    test('a user can change and clear its preferred language', async () => {
        const organization = await new OrganizationFactory({}).create();
        const user = await new UserFactory({ organization, password: 'test-password-1234' }).create();
        const token = await SessionService.createSession(user);

        const patch = async (language: Language | null) => {
            const response = await testServer.test(endpoint, Request.patch({
                path: `/user/${user.id}`,
                host: organization.getApiHost(),
                headers: { authorization: 'Bearer ' + token.accessToken },
                body: NewUser.patch({ id: user.id, language }),
            }));
            expect(response.status).toBe(200);
            await user.refresh();
            return response.body.language;
        };

        expect(await patch(Language.French)).toBe(Language.French);
        expect(user.language).toBe(Language.French);

        expect(await patch(null)).toBeNull();
        expect(user.language).toBeNull();
    });

    test('changing the user language also changes the language of its members', async () => {
        const organization = await new OrganizationFactory({}).create();
        const user = await new UserFactory({ organization, password: 'test-password-1234' }).create();
        const member = await new MemberFactory({ organization, user }).create();
        const unrelatedMember = await new MemberFactory({ organization }).create();
        const token = await SessionService.createSession(user);

        const patch = async (language: Language | null) => {
            const response = await testServer.test(endpoint, Request.patch({
                path: `/user/${user.id}`,
                host: organization.getApiHost(),
                headers: { authorization: 'Bearer ' + token.accessToken },
                body: NewUser.patch({ id: user.id, language }),
            }));
            expect(response.status).toBe(200);
        };

        await patch(Language.French);
        expect((await Member.getByID(member.id))?.details.language).toBe(Language.French);
        expect((await Member.getByID(unrelatedMember.id))?.details.language).toBeNull();

        // Clearing the user language leaves the members untouched
        await patch(null);
        expect((await Member.getByID(member.id))?.details.language).toBe(Language.French);
    });
});
