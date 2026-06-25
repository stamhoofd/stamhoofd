import { Request } from '@simonbackx/simple-endpoints';
import type { Organization, Token } from '@stamhoofd/models';
import { OrganizationFactory, UserFactory } from '@stamhoofd/models';
import { LimitedFilteredRequest, PermissionLevel, Permissions } from '@stamhoofd/structures';
import { TestUtils } from '@stamhoofd/test-utils';
import { testServer } from '../../../../tests/helpers/TestServer.js';
import { initPlatformAdmin } from '../../../../tests/init/index.js';
import { initMembershipOrganization } from '../../../../tests/init/initMembershipOrganization.js';
import { GetOrganizationsEndpoint } from './GetOrganizationsEndpoint.js';

const baseUrl = `/admin/organizations`;
const endpoint = new GetOrganizationsEndpoint();

describe('Endpoint.GetOrganizationsEndpoint', () => {
    beforeEach(async () => {
        TestUtils.setEnvironment('userMode', 'organization');
    });

    beforeAll(async () => {
        await initMembershipOrganization();
    });

    const search = async (searchTerm: string, token: Token): Promise<string[]> => {
        const request = Request.get({
            path: baseUrl,
            // Platform admins are not scoped to an organization, so no host is required
            host: '',
            query: new LimitedFilteredRequest({
                search: searchTerm,
                limit: 100,
            }),
            headers: {
                authorization: 'Bearer ' + token.accessToken,
            },
        });
        const response = await testServer.test(endpoint, request);
        return response.body.results.map(o => o.id);
    };

    // Creates an admin (user with permissions) for the given organization
    const createAdmin = async (organization: Organization, data: { firstName?: string; lastName?: string; email?: string }) => {
        return await new UserFactory({
            organization,
            permissions: Permissions.create({ level: PermissionLevel.Full }),
            ...data,
        }).create();
    };

    test('Searches organizations by name', async () => {
        const { adminToken } = await initPlatformAdmin();
        const organization = await new OrganizationFactory({ name: 'Bombilcious Tennis Club' }).create();

        expect(await search('Bombilcious Tennis Club', adminToken)).toContain(organization.id);
    });

    test('Searches organizations by uri', async () => {
        const { adminToken } = await initPlatformAdmin();
        const organization = await new OrganizationFactory({ }).create();

        expect(await search(organization.uri, adminToken)).toContain(organization.id);
    });

    test('Does not search organizations by admin name', async () => {
        const { adminToken } = await initPlatformAdmin();
        const organization = await new OrganizationFactory({ name: 'Halfnamed Club' }).create();
        await createAdmin(organization, { firstName: 'Zwervinkel' });

        expect(await search('Zwervinkel', adminToken)).not.toContain(organization.id);
    });

    test('Does not match users without permissions (non-admins)', async () => {
        const { adminToken } = await initPlatformAdmin();
        const organization = await new OrganizationFactory({ name: 'Memberonly Club' }).create();

        // A regular user (no permissions) linked to the organization
        await new UserFactory({ organization, firstName: 'Solitary', lastName: 'Pangolin' }).create();

        expect(await search('Solitary Pangolin', adminToken)).not.toContain(organization.id);
    });

    test('Searches admins by email', async () => {
        const { adminToken } = await initPlatformAdmin();
        const organization = await new OrganizationFactory({ name: 'Mailable Club' }).create();
        await createAdmin(organization, { email: 'findme@admin-search-test.com' });

        expect(await search('findme@admin-search-test.com', adminToken)).toContain(organization.id);
    });

    test('Does search the organization name when the search contains an @', async () => {
        const { adminToken } = await initPlatformAdmin();
        // The organization name itself contains an @, but there is no admin with a matching email
        const organization = await new OrganizationFactory({ name: 'weird@orgname-test.com' }).create();

        expect(await search('weird@orgname-test.com', adminToken)).toContain(organization.id);
    });

    test('Does not match admins of other organizations by email', async () => {
        const { adminToken } = await initPlatformAdmin();
        const organization = await new OrganizationFactory({ name: 'Owner Club' }).create();
        const otherOrganization = await new OrganizationFactory({ name: 'Bystander Club' }).create();
        await createAdmin(organization, { email: 'unique-owner@admin-search-test.com' });

        const results = await search('unique-owner@admin-search-test.com', adminToken);
        expect(results).toContain(organization.id);
        expect(results).not.toContain(otherOrganization.id);
    });
});
