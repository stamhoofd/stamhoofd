import { Request } from '@simonbackx/simple-endpoints';
import { OrganizationFactory, STPackageFactory } from '@stamhoofd/models';
import { AccessRight, LimitedFilteredRequest, STPackageBundle, STPackageType } from '@stamhoofd/structures';
import { STExpect, TestUtils } from '@stamhoofd/test-utils';
import { testServer } from '../../../../../tests/helpers/TestServer.js';
import { initAdmin } from '../../../../../tests/init/index.js';
import { GetPackagesEndpoint } from './GetPackagesEndpoint.js';

const baseUrl = `/organization/packages`;
const endpoint = new GetPackagesEndpoint();

describe('Endpoint.GetPackagesEndpoint', () => {
    beforeEach(async () => {
        TestUtils.setEnvironment('userMode', 'organization');
    });

    test('Can get organization packages as finance director', async () => {
        const organization = await new OrganizationFactory({}).create();

        const package1 = await new STPackageFactory({
            organization,
            bundle: STPackageBundle.Members,
        }).create();

        // This old package is not returned
        const oldPackage = await new STPackageFactory({
            organization,
            bundle: STPackageBundle.Webshops,
            removeAt: new Date(Date.now() - 1000 * 60 * 60),
        }).create();

        // Never activated packages are not returned
        const inactivePackage = await new STPackageFactory({
            organization,
            bundle: STPackageBundle.Webshops,
            validAt: null,
        }).create();

        const package2 = await new STPackageFactory({
            organization,
            bundle: STPackageBundle.TrialWebshops,
        }).create();

        const { adminToken } = await initAdmin({
            organization,
            accessRights: [AccessRight.OrganizationFinanceDirector],
        });

        // Try to request all members at organization
        const request = Request.get({
            path: baseUrl,
            host: organization.getApiHost(),
            query: new LimitedFilteredRequest({
                limit: 10,
            }),
            headers: {
                authorization: 'Bearer ' + adminToken.accessToken,
            },
        });

        const response = await testServer.test(endpoint, request);
        expect(response.status).toBe(200);
        expect(response.body.packages).toHaveLength(2);

        expect(response.body.packages).toIncludeSameMembers([
            expect.objectContaining({
                id: package1.id,
                meta: expect.objectContaining({
                    type: STPackageType.Members,
                }),
            }),
            expect.objectContaining({
                id: package2.id,
                meta: expect.objectContaining({
                    type: STPackageType.TrialWebshops,
                }),
            }),
        ]);
    });

    test('Cannot get organization packages without finance director right', async () => {
        const organization = await new OrganizationFactory({}).create();

        await new STPackageFactory({
            organization,
            bundle: STPackageBundle.Members,
        }).create();

        const { adminToken } = await initAdmin({
            organization,
            accessRights: [AccessRight.OrganizationCreateWebshops],
        });

        // Try to request all members at organization
        const request = Request.get({
            path: baseUrl,
            host: organization.getApiHost(),
            query: new LimitedFilteredRequest({
                limit: 10,
            }),
            headers: {
                authorization: 'Bearer ' + adminToken.accessToken,
            },
        });

        await expect(testServer.test(endpoint, request)).rejects.toThrow(STExpect.errorWithCode('permission_denied'));
    });
});
