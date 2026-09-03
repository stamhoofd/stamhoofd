import { Request } from '@simonbackx/simple-endpoints';
import type { Token } from '@stamhoofd/models';
import { BlockedPaymentMandate, Organization, OrganizationFactory } from '@stamhoofd/models';
import { TestUtils } from '@stamhoofd/test-utils';
import { MollieMocker } from '../../../../../tests/helpers/MollieMocker.js';
import { testServer } from '../../../../../tests/helpers/TestServer.js';
import { initAdmin } from '../../../../../tests/init/index.js';
import { initMembershipOrganization } from '../../../../../tests/init/initMembershipOrganization.js';
import { DeleteOrganizationMandateEndpoint } from './DeleteOrganizationMandateEndpoint.js';

describe('Endpoint.DeleteOrganizationMandateEndpoint', () => {
    const endpoint = new DeleteOrganizationMandateEndpoint();
    let mollieMocker: MollieMocker;
    let sellingOrganization: Organization;

    beforeAll(async () => {
        TestUtils.setEnvironment('userMode', 'organization');
        mollieMocker = new MollieMocker();
        mollieMocker.start();

        sellingOrganization = await initMembershipOrganization();
        await mollieMocker.setupToken(sellingOrganization);
    });

    afterAll(() => {
        mollieMocker.stop();
    });

    beforeEach(() => {
        TestUtils.setEnvironment('userMode', 'organization');
        mollieMocker.reset();
    });

    const remove = async (mandateId: string, organization: Organization, token: Token) => {
        const request = Request.buildJson('DELETE', `/billing/${sellingOrganization.id}/mandates/${mandateId}`, organization.getApiHost());
        request.headers.authorization = 'Bearer ' + token.accessToken;
        return await testServer.test(endpoint, request);
    };

    /**
     * A paying organization with one usable default mandate and, optionally, blocked mandates
     */
    const init = async ({ usable = 1, blocked = 1 }: { usable?: number; blocked?: number } = {}) => {
        const organization = await new OrganizationFactory({}).create();
        const { adminToken } = await initAdmin({ organization });

        const customerId = mollieMocker.createId('cst');
        mollieMocker.customers.push({ id: customerId });
        organization.serverMeta.mollieCustomerId = customerId;

        const usableMandates = Array.from({ length: usable }, (_, i) => mollieMocker.addMandate({ customerId, cardNumber: '100' + i }));
        const blockedMandates = Array.from({ length: blocked }, (_, i) => mollieMocker.addMandate({ customerId, cardNumber: '900' + i }));

        organization.serverMeta.mollieMandateId = usableMandates[0]?.id ?? null;
        for (const mandate of blockedMandates) {
            organization.serverMeta.blockedMandates.push(BlockedPaymentMandate.create({ id: mandate.id }));
        }
        await organization.save();

        return { organization, token: adminToken, usableMandates, blockedMandates };
    };

    test('A blocked mandate can be deleted even when it is the last one', async () => {
        const { organization, token, blockedMandates } = await init({ usable: 0, blocked: 2 });

        const response = await remove(blockedMandates[0].id, organization, token);
        expect(response.status).toBe(201);
        expect(mollieMocker.mandates.map(m => m.id)).toEqual([blockedMandates[1].id]);

        const last = await remove(blockedMandates[1].id, organization, token);
        expect(last.status).toBe(201);
        expect(mollieMocker.mandates).toHaveLength(0);
    });

    test('The last usable mandate cannot be deleted', async () => {
        const { organization, token, usableMandates } = await init({ usable: 2, blocked: 1 });

        // Delete the usable one that is not the default
        const response = await remove(usableMandates[1].id, organization, token);
        expect(response.status).toBe(201);

        // Only a blocked one remains next to the default: this one is the last usable
        // (the default cannot be deleted either, but that is a separate rule)
        const fresh = (await Organization.getByID(organization.id))!;
        fresh.serverMeta.mollieMandateId = null;
        await fresh.save();

        await expect(remove(usableMandates[0].id, organization, token)).rejects.toMatchObject({ code: 'not_allowed' });
        expect(mollieMocker.mandates.map(m => m.id)).toContain(usableMandates[0].id);
    });
});
