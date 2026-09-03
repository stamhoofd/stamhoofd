import type { PatchableArrayAutoEncoder } from '@simonbackx/simple-encoding';
import { PatchableArray } from '@simonbackx/simple-encoding';
import { Request } from '@simonbackx/simple-endpoints';
import type { Token } from '@stamhoofd/models';
import { BlockedPaymentMandate, Organization, OrganizationFactory } from '@stamhoofd/models';
import { PaymentMandate } from '@stamhoofd/structures/PaymentMandate.js';
import { TestUtils } from '@stamhoofd/test-utils';
import { MollieMocker } from '../../../../../tests/helpers/MollieMocker.js';
import { testServer } from '../../../../../tests/helpers/TestServer.js';
import { initAdmin, initPlatformAdmin } from '../../../../../tests/init/index.js';
import { initMembershipOrganization } from '../../../../../tests/init/initMembershipOrganization.js';
import { PatchOrganizationMandatesEndpoint } from './PatchOrganizationMandatesEndpoint.js';

describe('Endpoint.PatchOrganizationMandatesEndpoint', () => {
    const endpoint = new PatchOrganizationMandatesEndpoint();
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

    const patch = async (body: PatchableArrayAutoEncoder<PaymentMandate>, organization: Organization, token: Token) => {
        const request = Request.buildJson('PATCH', `/billing/${sellingOrganization.id}/mandates`, organization.getApiHost(), body);
        request.headers.authorization = 'Bearer ' + token.accessToken;
        return await testServer.test(endpoint, request);
    };

    const init = async () => {
        const organization = await new OrganizationFactory({}).create();
        const { adminToken } = await initAdmin({ organization });

        const customerId = mollieMocker.createId('cst');
        mollieMocker.customers.push({ id: customerId });
        const defaultMandate = mollieMocker.addMandate({ customerId, cardNumber: '1234' });
        const blockedMandate = mollieMocker.addMandate({ customerId, cardNumber: '9999' });

        organization.serverMeta.mollieCustomerId = customerId;
        organization.serverMeta.mollieMandateId = defaultMandate.id;
        organization.serverMeta.blockedMandates.push(BlockedPaymentMandate.create({ id: blockedMandate.id }));
        await organization.save();

        return { organization, token: adminToken, defaultMandate, blockedMandate };
    };

    const setDefaultPatch = (mandateId: string) => {
        const arr: PatchableArrayAutoEncoder<PaymentMandate> = new PatchableArray();
        arr.addPatch(PaymentMandate.patch({ id: mandateId, isDefault: true }));
        return arr;
    };

    const setBlockedPatch = (mandateId: string, blocked: boolean) => {
        const arr: PatchableArrayAutoEncoder<PaymentMandate> = new PatchableArray();
        arr.addPatch(PaymentMandate.patch({ id: mandateId, blockedAt: blocked ? new Date() : null }));
        return arr;
    };

    const getBlockedIds = async (organization: Organization) => {
        return (await Organization.getByID(organization.id))!.serverMeta.blockedMandates.map(b => b.id).sort();
    };

    test('A blocked mandate cannot be set as default', async () => {
        const { organization, token, defaultMandate, blockedMandate } = await init();

        await expect(patch(setDefaultPatch(blockedMandate.id), organization, token)).rejects.toMatchObject({ code: 'mandate_blocked' });

        const updated = (await Organization.getByID(organization.id))!;
        expect(updated.serverMeta.mollieMandateId).toBe(defaultMandate.id);
    });

    test('The seller can block and unblock a mandate', async () => {
        const { organization, defaultMandate, blockedMandate } = await init();
        const { adminToken: sellerToken } = await initPlatformAdmin();

        // Another mandate for the same card as the default one (the response groups these per card)
        const sameCardMandate = mollieMocker.addMandate({ customerId: organization.serverMeta.mollieCustomerId!, cardNumber: '1234' });

        const blockResponse = await patch(setBlockedPatch(defaultMandate.id, true), organization, sellerToken);
        expect(blockResponse.status).toBe(200);
        expect(blockResponse.body.find(m => m.id === defaultMandate.id)!.blockedAt).not.toBeNull();
        expect(await getBlockedIds(organization)).toEqual([defaultMandate.id, sameCardMandate.id, blockedMandate.id].sort());

        const unblockResponse = await patch(setBlockedPatch(defaultMandate.id, false), organization, sellerToken);
        expect(unblockResponse.status).toBe(200);
        expect(unblockResponse.body.find(m => m.id === defaultMandate.id)!.blockedAt).toBeNull();
        expect(unblockResponse.body.find(m => m.id === blockedMandate.id)!.blockedAt).not.toBeNull();
        expect(await getBlockedIds(organization)).toEqual([blockedMandate.id]);
    });

    test('The paying organization cannot block or unblock a mandate', async () => {
        const { organization, token, defaultMandate, blockedMandate } = await init();

        await expect(patch(setBlockedPatch(defaultMandate.id, true), organization, token)).rejects.toMatchObject({ code: 'permission_denied' });
        await expect(patch(setBlockedPatch(blockedMandate.id, false), organization, token)).rejects.toMatchObject({ code: 'permission_denied' });
        expect(await getBlockedIds(organization)).toEqual([blockedMandate.id]);
    });

    test('Blocked mandates are returned as blocked', async () => {
        const { organization, token, defaultMandate, blockedMandate } = await init();

        const response = await patch(setDefaultPatch(defaultMandate.id), organization, token);
        expect(response.status).toBe(200);

        const blocked = response.body.find(m => m.id === blockedMandate.id);
        expect(blocked?.blockedAt).not.toBeNull();
        expect(blocked?.isDefault).toBe(false);

        const defaultResponse = response.body.find(m => m.id === defaultMandate.id);
        expect(defaultResponse?.blockedAt).toBeNull();
        expect(defaultResponse?.isDefault).toBe(true);
    });
});
