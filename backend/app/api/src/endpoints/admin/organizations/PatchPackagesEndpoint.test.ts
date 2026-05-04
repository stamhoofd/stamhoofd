import { Request } from '@simonbackx/simple-endpoints';
import { OrganizationFactory, STPackageFactory } from '@stamhoofd/models';
import { AccessRight, OrganizationPackagesStatus, STPackage, STPackageBundle, STPackageBundleHelper } from '@stamhoofd/structures';
import { STExpect, TestUtils } from '@stamhoofd/test-utils';
import { testServer } from '../../../../tests/helpers/TestServer.js';
import { initAdmin, initPlatformAdmin } from '../../../../tests/init/index.js';
import { PatchPackagesEndpoint } from './PatchPackagesEndpoint.js';
import { PatchableArray } from '@simonbackx/simple-encoding';

const baseUrl = `/organization/packages`;
const endpoint = new PatchPackagesEndpoint();

describe('Endpoint.PatchPackagesEndpoint', () => {
    beforeEach(async () => {
        TestUtils.setEnvironment('userMode', 'organization');
    });

    describe('Permission checking', () => {
        test('Cannot patch organization packages as finance director', async () => {
            const organization = await new OrganizationFactory({}).create();

            const package1 = await new STPackageFactory({
                organization,
                bundle: STPackageBundle.Members,
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
            const request = Request.patch({
                path: baseUrl,
                host: organization.getApiHost(),
                body: OrganizationPackagesStatus.patch({
                    
                }),
                headers: {
                    authorization: 'Bearer ' + adminToken.accessToken,
                },
            });

            await expect(testServer.test(endpoint, request)).rejects.toThrow(STExpect.errorWithCode('permission_denied'));
        });
    });

    test('Can create a new package', async () => {
        const organization = await new OrganizationFactory({}).create();

        const { adminToken } = await initPlatformAdmin();

        const patch = OrganizationPackagesStatus.patch({});
        
        const pack = STPackageBundleHelper.getCurrentPackage(STPackageBundle.Webshops, new Date())
        pack.validAt = new Date(); // ignored by backend for now
        patch.packages.addPut(pack);

        // Try to request all members at organization
        const request = Request.patch({
            path: baseUrl,
            host: organization.getApiHost(),
            body: patch,
            headers: {
                authorization: 'Bearer ' + adminToken.accessToken,
            },
        });

        const response = await testServer.test(endpoint, request);
        expect(response.status).toBe(200);
        expect(response.body.packages).toHaveLength(1);

        const reference = response.body.packages[0];

        // Ignore created at
        pack.createdAt = reference.createdAt;
        pack.updatedAt = reference.updatedAt;
        pack.validAt = reference.validAt;
        expect(reference).toEqual(pack);
    });

    test('Can edit a package', async () => {
        const organization = await new OrganizationFactory({}).create();

        const { adminToken } = await initPlatformAdmin();

        const package1 = await new STPackageFactory({
            organization,
            bundle: STPackageBundle.Members,
        }).create();

        const patch = OrganizationPackagesStatus.patch({});
        const removeAt = new Date();
        removeAt.setMilliseconds(0)
        patch.packages.addPatch(STPackage.patch({
            id: package1.id,
            removeAt
        }));

        // Try to request all members at organization
        const request = Request.patch({
            path: baseUrl,
            host: organization.getApiHost(),
            body: patch,
            headers: {
                authorization: 'Bearer ' + adminToken.accessToken,
            },
        });

        const response = await testServer.test(endpoint, request);
        expect(response.status).toBe(200);
        expect(response.body.packages).toHaveLength(1);

        const reference = response.body.packages[0];

        // Ignore created at
        expect(reference.removeAt).toEqual(removeAt);
    });
});
