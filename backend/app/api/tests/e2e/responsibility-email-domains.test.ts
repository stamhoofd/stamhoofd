import { Request } from '@simonbackx/simple-endpoints';
import type { Organization } from '@stamhoofd/models';
import { MemberFactory, MemberResponsibilityRecordFactory, OrganizationFactory, Platform, User, UserFactory } from '@stamhoofd/models';
import { PermissionLevel } from '@stamhoofd/types/PermissionLevel';
import { MemberDetails, MemberResponsibility, OrganizationAdmins, PermissionRoleForResponsibility, PlatformConfig, Platform as PlatformStruct, Version } from '@stamhoofd/structures';
import { STExpect, TestUtils } from '@stamhoofd/test-utils';
import { v4 as uuidv4 } from 'uuid';

import { GetPlatformAdminsEndpoint } from '../../src/endpoints/global/platform/GetPlatformAdminsEndpoint.js';
import { GetPlatformEndpoint } from '../../src/endpoints/global/platform/GetPlatformEndpoint.js';
import { PatchPlatformEndpoint } from '../../src/endpoints/global/platform/PatchPlatformEnpoint.js';
import { GetOrganizationAdminsEndpoint } from '../../src/endpoints/organization/dashboard/users/GetOrganizationAdminsEndpoint.js';
import { MemberUserSyncer } from '../../src/helpers/MemberUserSyncer.js';
import { SessionService } from '../../src/services/SessionService.js';
import { testServer } from '../helpers/TestServer.js';

/**
 * A member with a platform responsibility that grants full platform access has two email addresses: one on a
 * whitelisted domain and one on another domain. Both users receive the responsibility, but only the user with
 * the whitelisted email address can actually use the permissions.
 */
describe('E2E.ResponsibilityEmailDomains', () => {
    const getPlatformEndpoint = new GetPlatformEndpoint();
    const getPlatformAdminsEndpoint = new GetPlatformAdminsEndpoint();
    const patchPlatformEndpoint = new PatchPlatformEndpoint();
    const getOrganizationAdminsEndpoint = new GetOrganizationAdminsEndpoint();

    const responsibility = MemberResponsibility.create({
        name: 'Koepelbeheerder',
        organizationBased: false,
        permissions: PermissionRoleForResponsibility.create({ level: PermissionLevel.Full }),
    });

    let organization: Organization;
    let allowed: User;
    let other: User;

    beforeEach(async () => {
        TestUtils.setEnvironment('userMode', 'platform');

        const platform = await Platform.getForEditing();
        platform.config.responsibilities.push(responsibility);
        platform.config.responsibilityEmailDomains = ['ksa.be'];
        await platform.save();

        organization = await new OrganizationFactory({}).create();

        // Email addresses are unique per platform, so every test uses its own addresses
        const allowedEmail = `john.${uuidv4()}@ksa.be`;
        const otherEmail = `john.${uuidv4()}@gmail.com`;
        allowed = await new UserFactory({ email: allowedEmail }).create();
        other = await new UserFactory({ email: otherEmail }).create();

        const member = await new MemberFactory({
            details: MemberDetails.create({
                firstName: 'John',
                lastName: 'Doe',
                email: allowedEmail,
                alternativeEmails: [otherEmail],
            }),
        }).create();
        await new MemberResponsibilityRecordFactory({ member, responsibility }).create();
        await MemberUserSyncer.onChangeMember(member);

        allowed = (await User.getByID(allowed.id))!;
        other = (await User.getByID(other.id))!;
    });

    afterEach(async () => {
        // The platform row is shared by every test file
        const platform = await Platform.getForEditing();
        platform.config.responsibilities = platform.config.responsibilities.filter(r => r.id !== responsibility.id);
        platform.config.responsibilityEmailDomains = [];
        await platform.save();
    });

    async function setDomains(domains: string[]) {
        const platform = await Platform.getForEditing();
        platform.config.responsibilityEmailDomains = domains;
        await platform.save();
    }

    async function request(user: User, method: 'GET' | 'PATCH', path: string, body?: any, host?: string) {
        const token = await SessionService.createSession(user, { authenticatedAt: new Date() });
        const request = Request.buildJson(method, `/v${Version}${path}`, host, body);
        request.headers.authorization = 'Bearer ' + token.accessToken;
        return request;
    }

    async function getPlatform(user: User) {
        return await testServer.test(getPlatformEndpoint, await request(user, 'GET', '/platform'));
    }

    async function getPlatformAdmins(user: User) {
        return await testServer.test(getPlatformAdminsEndpoint, await request(user, 'GET', '/platform/admins'));
    }

    async function patchPlatformDomains(user: User, domains: string[]) {
        const patch = PlatformStruct.patch({
            config: PlatformConfig.patch({
                responsibilityEmailDomains: domains as any,
            }),
        });
        return await testServer.test(patchPlatformEndpoint, await request(user, 'PATCH', '/platform', patch));
    }

    async function getOrganizationAdmins(user: User) {
        return await testServer.test(getOrganizationAdminsEndpoint, await request(user, 'GET', '/organization/admins', undefined, organization.getApiHost()));
    }

    test('the responsibility is linked to both users', async () => {
        for (const user of [allowed, other]) {
            expect(user.permissions?.globalPermissions?.responsibilities.map(r => r.responsibilityId)).toEqual([responsibility.id]);
        }
    });

    test('only the whitelisted user receives the private platform configuration', async () => {
        const allowedResponse = await getPlatform(allowed);
        expect(allowedResponse.body.privateConfig).not.toBeNull();

        // The domain list itself is public, so the frontend of both users can calculate the permissions
        const otherResponse = await getPlatform(other);
        expect(otherResponse.body.privateConfig).toBeNull();
        expect(otherResponse.body.config.responsibilityEmailDomains).toEqual(['ksa.be']);
    });

    test('only the whitelisted user can list the platform admins', async () => {
        const response = await getPlatformAdmins(allowed);
        expect(response.body).toBeInstanceOf(OrganizationAdmins);
        expect(response.body.users.map(u => u.id)).toEqual(expect.arrayContaining([allowed.id]));

        await expect(getPlatformAdmins(other)).rejects.toThrow(STExpect.errorWithCode('permission_denied'));
    });

    test('only the whitelisted user can change the platform settings', async () => {
        await expect(patchPlatformDomains(other, ['ksa.be', 'fos.be'])).rejects.toThrow(STExpect.errorWithCode('permission_denied'));
        expect((await Platform.getForEditing()).config.responsibilityEmailDomains).toEqual(['ksa.be']);

        const response = await patchPlatformDomains(allowed, ['ksa.be', 'fos.be']);
        expect(response.body.config.responsibilityEmailDomains).toEqual(['ksa.be', 'fos.be']);
    });

    test('only the whitelisted user inherits full access to organizations', async () => {
        const response = await getOrganizationAdmins(allowed);
        expect(response.body).toBeInstanceOf(OrganizationAdmins);

        await expect(getOrganizationAdmins(other)).rejects.toThrow(STExpect.errorWithCode('permission_denied'));
    });

    test('changing the whitelist applies immediately without resyncing users', async () => {
        await expect(getPlatformAdmins(other)).rejects.toThrow(STExpect.errorWithCode('permission_denied'));

        await setDomains(['ksa.be', 'gmail.com']);
        expect((await getPlatformAdmins(other)).body).toBeInstanceOf(OrganizationAdmins);

        // No whitelist: no restrictions
        await setDomains([]);
        expect((await getPlatformAdmins(other)).body).toBeInstanceOf(OrganizationAdmins);

        // Only a subdomain: the exact domain is required
        await setDomains(['mail.gmail.com']);
        await expect(getPlatformAdmins(other)).rejects.toThrow(STExpect.errorWithCode('permission_denied'));
        await expect(getPlatformAdmins(allowed)).rejects.toThrow(STExpect.errorWithCode('permission_denied'));
    });
});
