import type { Endpoint } from '@simonbackx/simple-endpoints';
import { Request } from '@simonbackx/simple-endpoints';
import { OrganizationFactory, OrganizationTagFactory, Token, UserFactory, WebshopFactory } from '@stamhoofd/models';
import { CountFilteredRequest, LimitedFilteredRequest, PermissionLevel, Permissions, PermissionsResourceType, ResourcePermissions, SortItemDirection } from '@stamhoofd/structures';
import { STExpect, TestUtils } from '@stamhoofd/test-utils';
import { testServer } from '../../../../tests/helpers/TestServer.js';
import { GetWebshopsCountEndpoint } from './GetWebshopsCountEndpoint.js';
import { GetWebshopsEndpoint } from './GetWebshopsEndpoint.js';

const baseUrl = '/webshops';
const endpoint = new GetWebshopsEndpoint();
const countEndpoint = new GetWebshopsCountEndpoint();
type EndpointType = typeof endpoint;
type Body = EndpointType extends Endpoint<any, any, infer B, any> ? B : never;

describe('Endpoint.GetWebshopsEndpoint', () => {
    beforeEach(async () => {
        TestUtils.setEnvironment('userMode', 'platform');
    });

    describe('Organization context', () => {
        test('An org admin with full access can fetch all webshops in their organization', async () => {
            const organization = await new OrganizationFactory({}).create();

            const user = await new UserFactory({
                organization,
                permissions: Permissions.create({
                    level: PermissionLevel.Full,
                }),
            }).create();

            const token = await Token.createToken(user);

            const webshop1 = await new WebshopFactory({ organizationId: organization.id, name: 'Webshop A' }).create();
            const webshop2 = await new WebshopFactory({ organizationId: organization.id, name: 'Webshop B' }).create();

            // Create a webshop in a different organization - should not appear
            const otherOrg = await new OrganizationFactory({}).create();
            await new WebshopFactory({ organizationId: otherOrg.id, name: 'Other Webshop' }).create();

            const request = Request.get({
                path: baseUrl,
                host: organization.getApiHost(),
                query: new LimitedFilteredRequest({ limit: 100 }),
                headers: { authorization: 'Bearer ' + token.accessToken },
            });

            const response = await testServer.test(endpoint, request);
            expect(response.status).toBe(200);
            expect(response.body.results).toHaveLength(2);
            expect(response.body.results).toIncludeSameMembers([
                expect.objectContaining({ id: webshop1.id }),
                expect.objectContaining({ id: webshop2.id }),
            ]);
        });

        test('An org admin with access to a specific webshop only sees that webshop', async () => {
            const organization = await new OrganizationFactory({}).create();

            const webshop1 = await new WebshopFactory({ organizationId: organization.id, name: 'Accessible Webshop' }).create();
            const webshop2 = await new WebshopFactory({ organizationId: organization.id, name: 'Inaccessible Webshop' }).create();

            const user = await new UserFactory({
                organization,
                permissions: Permissions.create({
                    level: PermissionLevel.None,
                    resources: new Map([[
                        PermissionsResourceType.Webshops,
                        new Map([[
                            webshop1.id,
                            ResourcePermissions.create({ level: PermissionLevel.Read }),
                        ]]),
                    ]]),
                }),
            }).create();

            const token = await Token.createToken(user);

            const request = Request.get({
                path: baseUrl,
                host: organization.getApiHost(),
                query: new LimitedFilteredRequest({ limit: 100 }),
                headers: { authorization: 'Bearer ' + token.accessToken },
            });

            const response = await testServer.test(endpoint, request);
            expect(response.status).toBe(200);
            expect(response.body.results).toHaveLength(1);
            expect(response.body.results[0].id).toBe(webshop1.id);
        });

        test('An org admin with no webshop access gets an empty result', async () => {
            const organization = await new OrganizationFactory({}).create();
            await new WebshopFactory({ organizationId: organization.id }).create();

            const user = await new UserFactory({
                organization,
                permissions: Permissions.create({
                    level: PermissionLevel.None,
                }),
            }).create();

            const token = await Token.createToken(user);

            const request = Request.get({
                path: baseUrl,
                host: organization.getApiHost(),
                query: new LimitedFilteredRequest({ limit: 100 }),
                headers: { authorization: 'Bearer ' + token.accessToken },
            });

            const response = await testServer.test(endpoint, request);
            expect(response.status).toBe(200);
            expect(response.body.results).toHaveLength(0);
        });

        test('Unauthenticated request is rejected', async () => {
            const organization = await new OrganizationFactory({}).create();

            const request = Request.get({
                path: baseUrl,
                host: organization.getApiHost(),
                query: new LimitedFilteredRequest({ limit: 10 }),
            });

            await expect(testServer.test(endpoint, request)).rejects.toThrow(
                STExpect.errorWithCode('not_authenticated'),
            );
        });
    });

    describe('Platform context', () => {
        test('A platform admin with full access can fetch all webshops across organizations', async () => {
            const org1 = await new OrganizationFactory({}).create();
            const org2 = await new OrganizationFactory({}).create();

            const webshop1 = await new WebshopFactory({ organizationId: org1.id }).create();
            const webshop2 = await new WebshopFactory({ organizationId: org2.id }).create();

            const platformAdmin = await new UserFactory({
                globalPermissions: Permissions.create({ level: PermissionLevel.Full }),
            }).create();

            const token = await Token.createToken(platformAdmin);

            const request = Request.get({
                path: baseUrl,
                host: 'platform.stamhoofd.app',
                query: new LimitedFilteredRequest({
                    filter: {
                        id: { $in: [webshop1.id, webshop2.id] },
                    },
                    limit: 100,
                }),
                headers: { authorization: 'Bearer ' + token.accessToken },
            });

            const response = await testServer.test(endpoint, request);
            expect(response.status).toBe(200);
            expect(response.body.results).toHaveLength(2);
            expect(response.body.results).toIncludeSameMembers([
                expect.objectContaining({ id: webshop1.id }),
                expect.objectContaining({ id: webshop2.id }),
            ]);
        });

        test('A platform user with no platform access is rejected', async () => {
            const platformUser = await new UserFactory({
                globalPermissions: Permissions.create({ level: PermissionLevel.None }),
            }).create();

            const token = await Token.createToken(platformUser);

            const request = Request.get({
                path: baseUrl,
                host: 'platform.stamhoofd.app',
                query: new LimitedFilteredRequest({ limit: 10 }),
                headers: { authorization: 'Bearer ' + token.accessToken },
            });

            await expect(testServer.test(endpoint, request)).rejects.toThrow(
                STExpect.errorWithCode('permission_denied'),
            );
        });

        test('A platform admin with tag-based access only sees webshops of organizations with that tag', async () => {
            const tag = await new OrganizationTagFactory({}).create();

            // Organization WITH the tag
            const orgWithTag = await new OrganizationFactory({ tags: [tag.id] }).create();
            // Organization WITHOUT the tag
            const orgWithoutTag = await new OrganizationFactory({}).create();

            const webshopInTaggedOrg = await new WebshopFactory({ organizationId: orgWithTag.id }).create();
            const webshopInUntaggedOrg = await new WebshopFactory({ organizationId: orgWithoutTag.id }).create();

            // Platform user with read access to organizations with the specific tag
            const platformUser = await new UserFactory({
                globalPermissions: Permissions.create({
                    level: PermissionLevel.None,
                    resources: new Map([[
                        PermissionsResourceType.OrganizationTags,
                        new Map([[
                            tag.id,
                            ResourcePermissions.create({ level: PermissionLevel.Read }),
                        ]]),
                    ]]),
                }),
            }).create();

            const token = await Token.createToken(platformUser);

            const request = Request.get({
                path: baseUrl,
                host: 'platform.stamhoofd.app',
                query: new LimitedFilteredRequest({
                    filter: {
                        id: { $in: [webshopInTaggedOrg.id, webshopInUntaggedOrg.id] },
                    },
                    limit: 100,
                }),
                headers: { authorization: 'Bearer ' + token.accessToken },
            });

            const response = await testServer.test(endpoint, request);
            expect(response.status).toBe(200);

            // Only the webshop from the tagged organization should be visible
            expect(response.body.results).toHaveLength(1);
            expect(response.body.results[0].id).toBe(webshopInTaggedOrg.id);
        });

        test('A platform admin with tag-based access to multiple tags sees webshops from all matching organizations', async () => {
            const tag1 = await new OrganizationTagFactory({}).create();
            const tag2 = await new OrganizationTagFactory({}).create();

            const orgTag1 = await new OrganizationFactory({ tags: [tag1.id] }).create();
            const orgTag2 = await new OrganizationFactory({ tags: [tag2.id] }).create();
            const orgNoTag = await new OrganizationFactory({}).create();

            const webshop1 = await new WebshopFactory({ organizationId: orgTag1.id }).create();
            const webshop2 = await new WebshopFactory({ organizationId: orgTag2.id }).create();
            const webshopNoTag = await new WebshopFactory({ organizationId: orgNoTag.id }).create();

            const platformUser = await new UserFactory({
                globalPermissions: Permissions.create({
                    level: PermissionLevel.None,
                    resources: new Map([[
                        PermissionsResourceType.OrganizationTags,
                        new Map([
                            [tag1.id, ResourcePermissions.create({ level: PermissionLevel.Read })],
                            [tag2.id, ResourcePermissions.create({ level: PermissionLevel.Read })],
                        ]),
                    ]]),
                }),
            }).create();

            const token = await Token.createToken(platformUser);

            const request = Request.get({
                path: baseUrl,
                host: 'platform.stamhoofd.app',
                query: new LimitedFilteredRequest({
                    filter: {
                        id: { $in: [webshop1.id, webshop2.id, webshopNoTag.id] },
                    },
                    limit: 100,
                }),
                headers: { authorization: 'Bearer ' + token.accessToken },
            });

            const response = await testServer.test(endpoint, request);
            expect(response.status).toBe(200);
            expect(response.body.results).toHaveLength(2);
            expect(response.body.results).toIncludeSameMembers([
                expect.objectContaining({ id: webshop1.id }),
                expect.objectContaining({ id: webshop2.id }),
            ]);
        });
    });

    describe('Filtering', () => {
        test('Can filter webshops by id', async () => {
            const organization = await new OrganizationFactory({}).create();

            const user = await new UserFactory({
                organization,
                permissions: Permissions.create({ level: PermissionLevel.Full }),
            }).create();

            const token = await Token.createToken(user);

            const webshop1 = await new WebshopFactory({ organizationId: organization.id }).create();
            const webshop2 = await new WebshopFactory({ organizationId: organization.id }).create();

            const request = Request.get({
                path: baseUrl,
                host: organization.getApiHost(),
                query: new LimitedFilteredRequest({
                    filter: { id: { $eq: webshop1.id } },
                    limit: 100,
                }),
                headers: { authorization: 'Bearer ' + token.accessToken },
            });

            const response = await testServer.test(endpoint, request);
            expect(response.status).toBe(200);
            expect(response.body.results).toHaveLength(1);
            expect(response.body.results[0].id).toBe(webshop1.id);
        });

        test('Can search webshops by name', async () => {
            const organization = await new OrganizationFactory({}).create();

            const user = await new UserFactory({
                organization,
                permissions: Permissions.create({ level: PermissionLevel.Full }),
            }).create();

            const token = await Token.createToken(user);

            const webshop1 = await new WebshopFactory({ organizationId: organization.id, name: 'Summer Sale' }).create();
            const webshop2 = await new WebshopFactory({ organizationId: organization.id, name: 'Winter Collection' }).create();

            const request = Request.get({
                path: baseUrl,
                host: organization.getApiHost(),
                query: new LimitedFilteredRequest({
                    search: 'Summer',
                    limit: 100,
                }),
                headers: { authorization: 'Bearer ' + token.accessToken },
            });

            const response = await testServer.test(endpoint, request);
            expect(response.status).toBe(200);
            expect(response.body.results).toHaveLength(1);
            expect(response.body.results[0].id).toBe(webshop1.id);
        });
    });

    describe('Sorting and pagination stability', () => {
        test('Sorting by id is stable across pages', async () => {
            const organization = await new OrganizationFactory({}).create();

            const user = await new UserFactory({
                organization,
                permissions: Permissions.create({ level: PermissionLevel.Full }),
            }).create();

            const token = await Token.createToken(user);

            // Create 5 webshops
            const webshops = await Promise.all(
                Array.from({ length: 5 }, (_, i) =>
                    new WebshopFactory({ organizationId: organization.id, name: `Webshop ${i}` }).create(),
                ),
            );

            // Fetch page 1 (limit 2)
            const page1Request = Request.get({
                path: baseUrl,
                host: organization.getApiHost(),
                query: new LimitedFilteredRequest({
                    sort: [{ key: 'id', order: SortItemDirection.ASC }],
                    limit: 2,
                }),
                headers: { authorization: 'Bearer ' + token.accessToken },
            });

            const page1 = await testServer.test(endpoint, page1Request);
            expect(page1.body.results).toHaveLength(2);
            expect(page1.body.next).toBeDefined();

            // Fetch page 2 using the next cursor
            const page2Request = Request.get({
                path: baseUrl,
                host: organization.getApiHost(),
                query: page1.body.next!,
                headers: { authorization: 'Bearer ' + token.accessToken },
            });

            const page2 = await testServer.test(endpoint, page2Request);
            expect(page2.body.results).toHaveLength(2);
            expect(page2.body.next).toBeDefined();

            // Fetch page 3
            const page3Request = Request.get({
                path: baseUrl,
                host: organization.getApiHost(),
                query: page2.body.next!,
                headers: { authorization: 'Bearer ' + token.accessToken },
            });

            const page3 = await testServer.test(endpoint, page3Request);
            expect(page3.body.results).toHaveLength(1);
            expect(page3.body.next).toBeUndefined();

            // All pages combined should equal all webshops (no duplicates, no missing)
            const allIds = [
                ...page1.body.results.map(w => w.id),
                ...page2.body.results.map(w => w.id),
                ...page3.body.results.map(w => w.id),
            ];
            expect(allIds).toHaveLength(5);
            expect(allIds).toIncludeSameMembers(webshops.map(w => w.id));

            // Check ordering is stable: each page's ids should be in ascending order
            const allSorted = [...allIds].sort();
            expect(allIds).toEqual(allSorted);
        });

        test('Sorting by name is stable across pages', async () => {
            const organization = await new OrganizationFactory({}).create();

            const user = await new UserFactory({
                organization,
                permissions: Permissions.create({ level: PermissionLevel.Full }),
            }).create();

            const token = await Token.createToken(user);

            // Create webshops with deterministic names for ordering
            const names = ['Apple Shop', 'Banana Market', 'Cherry Stand', 'Date Store', 'Elderberry Emporium'];
            const webshops = await Promise.all(
                names.map(name => new WebshopFactory({ organizationId: organization.id, name }).create()),
            );

            // Fetch all in pages of 2 sorted by name ASC
            const allResults: string[] = [];
            let currentQuery: LimitedFilteredRequest | undefined = new LimitedFilteredRequest({
                sort: [{ key: 'name', order: SortItemDirection.ASC }, { key: 'id', order: SortItemDirection.ASC }],
                limit: 2,
            });

            while (currentQuery) {
                const request = Request.get({
                    path: baseUrl,
                    host: organization.getApiHost(),
                    query: currentQuery,
                    headers: { authorization: 'Bearer ' + token.accessToken },
                });

                const response = await testServer.test(endpoint, request);
                allResults.push(...response.body.results.map((w: { id: string }) => w.id));
                currentQuery = response.body.next;
            }

            expect(allResults).toHaveLength(5);
            expect(allResults).toIncludeSameMembers(webshops.map(w => w.id));

            // Verify sorted order matches expected alphabetical order
            const expectedOrder = webshops
                .sort((a, b) => a.meta.name.localeCompare(b.meta.name))
                .map(w => w.id);
            expect(allResults).toEqual(expectedOrder);
        });
    });

    describe('Count endpoint', () => {
        test('Returns correct count for organization context', async () => {
            const organization = await new OrganizationFactory({}).create();

            const user = await new UserFactory({
                organization,
                permissions: Permissions.create({ level: PermissionLevel.Full }),
            }).create();

            const token = await Token.createToken(user);

            await new WebshopFactory({ organizationId: organization.id }).create();
            await new WebshopFactory({ organizationId: organization.id }).create();
            await new WebshopFactory({ organizationId: organization.id }).create();

            const request = Request.get({
                path: baseUrl + '/count',
                host: organization.getApiHost(),
                query: new CountFilteredRequest({}),
                headers: { authorization: 'Bearer ' + token.accessToken },
            });

            const response = await testServer.test(countEndpoint, request);
            expect(response.status).toBe(200);
            // Count includes all webshops in the org (the query doesn't filter by permission)
            expect(response.body.count).toBeGreaterThanOrEqual(3);
        });

        test('Count matches number of results from list endpoint', async () => {
            const organization = await new OrganizationFactory({}).create();

            const user = await new UserFactory({
                organization,
                permissions: Permissions.create({ level: PermissionLevel.Full }),
            }).create();

            const token = await Token.createToken(user);

            const webshop1 = await new WebshopFactory({ organizationId: organization.id, name: 'Alpha' }).create();
            const webshop2 = await new WebshopFactory({ organizationId: organization.id, name: 'Beta' }).create();

            const nameFilter = { name: { $contains: 'Alpha' } };

            // List request
            const listRequest = Request.get({
                path: baseUrl,
                host: organization.getApiHost(),
                query: new LimitedFilteredRequest({ filter: nameFilter, limit: 100 }),
                headers: { authorization: 'Bearer ' + token.accessToken },
            });

            // Count request
            const countRequest = Request.get({
                path: baseUrl + '/count',
                host: organization.getApiHost(),
                query: new CountFilteredRequest({ filter: nameFilter }),
                headers: { authorization: 'Bearer ' + token.accessToken },
            });

            const [listResponse, countResponse] = await Promise.all([
                testServer.test(endpoint, listRequest),
                testServer.test(countEndpoint, countRequest),
            ]);

            expect(listResponse.body.results).toHaveLength(1);
            expect(countResponse.body.count).toBe(1);
        });
    });

    describe('Pagination with post-query permission filtering', () => {
        test('Paginating through 100 webshops where only 1 is accessible eventually returns the accessible webshop without looping infinitely', async () => {
            const organization = await new OrganizationFactory({}).create();

            // Create 99 inaccessible webshops and 1 accessible one. Their UUIDs are random,
            // so the accessible webshop can end up anywhere in the sort order (sort key: id).
            // The test verifies that pagination still finds it regardless of position.
            const inaccessibleWebshops = await Promise.all(
                Array.from({ length: 99 }, () =>
                    new WebshopFactory({ organizationId: organization.id }).create(),
                ),
            );

            const accessibleWebshop = await new WebshopFactory({
                organizationId: organization.id,
                name: 'Accessible Webshop',
            }).create();

            // User only has explicit access to the one accessible webshop.
            const user = await new UserFactory({
                organization,
                permissions: Permissions.create({
                    level: PermissionLevel.None,
                    resources: new Map([[
                        PermissionsResourceType.Webshops,
                        new Map([[
                            accessibleWebshop.id,
                            ResourcePermissions.create({ level: PermissionLevel.Read }),
                        ]]),
                    ]]),
                }),
            }).create();

            const token = await Token.createToken(user);

            // Use a small page size (10) so we exercise multiple pages.
            const pageSize = 10;
            let currentRequest: LimitedFilteredRequest | null = new LimitedFilteredRequest({
                limit: pageSize,
                sort: [],
            });

            const allResults: string[] = [];
            let pageCount = 0;
            const maxPages = 20; // safety cap — 100 webshops / 10 per page = at most 10 pages

            while (currentRequest !== null) {
                expect(pageCount).toBeLessThan(maxPages); // guard against infinite loop

                const request = Request.get({
                    path: baseUrl,
                    host: organization.getApiHost(),
                    query: currentRequest,
                    headers: { authorization: 'Bearer ' + token.accessToken },
                });

                const response = await testServer.test(endpoint, request);
                expect(response.status).toBe(200);

                for (const result of response.body.results) {
                    allResults.push(result.id);
                }

                currentRequest = response.body.next ?? null;
                pageCount++;
            }

            // The accessible webshop must appear exactly once.
            expect(allResults).toContain(accessibleWebshop.id);
            expect(allResults.filter(id => id === accessibleWebshop.id)).toHaveLength(1);

            // None of the inaccessible webshops should appear.
            const inaccessibleIds = new Set(inaccessibleWebshops.map(w => w.id));
            for (const id of allResults) {
                expect(inaccessibleIds.has(id)).toBe(false);
            }
        });
    });
});
