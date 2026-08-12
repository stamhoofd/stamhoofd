import { Request } from '@simonbackx/simple-endpoints';
import { BalanceItemFactory, Invoice, Organization, OrganizationFactory, Payment } from '@stamhoofd/models';
import { ApplicationFee } from '@stamhoofd/models/models/ApplicationFee.js';
import { SettlementCharge } from '@stamhoofd/models/models/SettlementCharge.js';
import { PatchableArray } from '@simonbackx/simple-encoding';
import type { PatchableArrayAutoEncoder } from '@simonbackx/simple-encoding';
import type { Organization as OrganizationStruct } from '@stamhoofd/structures';
import { PaymentMethod, PaymentStatus } from '@stamhoofd/structures';
import { ApplicationFeeType } from '@stamhoofd/structures/settlements/ApplicationFeeType.js';
import { SettlementChargeType } from '@stamhoofd/structures/settlements/SettlementChargeType.js';
import { STExpect, TestUtils } from '@stamhoofd/test-utils';
import { v4 as uuidv4 } from 'uuid';
import { testServer } from '../../../../tests/helpers/TestServer.js';
import { initPlatformAdmin } from '../../../../tests/init/index.js';
import { initMembershipOrganization } from '../../../../tests/init/initMembershipOrganization.js';
import { PatchOrganizationsEndpoint } from './PatchOrganizationsEndpoint.js';

const baseUrl = `/admin/organizations`;
const endpoint = new PatchOrganizationsEndpoint();

describe('Endpoint.PatchOrganizationsEndpoint', () => {
    let membershipOrganization: Organization;

    beforeEach(async () => {
        TestUtils.setEnvironment('userMode', 'organization');
    });

    beforeAll(async () => {
        membershipOrganization = await initMembershipOrganization();
    });

    const deleteOrganization = async (organization: Organization) => {
        const { adminToken } = await initPlatformAdmin();

        const patch: PatchableArrayAutoEncoder<OrganizationStruct> = new PatchableArray();
        patch.addDelete(organization.id);

        // Platform admins are not scoped to an organization, so no host is required
        const request = Request.patch({
            path: baseUrl,
            host: '',
            body: patch,
            headers: {
                authorization: 'Bearer ' + adminToken.accessToken,
            },
        });

        return await testServer.test(endpoint, request);
    };

    const createPayment = async ({ payingOrganizationId }: { payingOrganizationId: string | null }) => {
        const payment = new Payment();
        payment.organizationId = membershipOrganization.id;
        payment.payingOrganizationId = payingOrganizationId;
        payment.method = PaymentMethod.Transfer;
        payment.status = PaymentStatus.Succeeded;
        payment.price = 10_00;
        await payment.save();
        return payment;
    };

    const createApplicationFee = async ({ payingOrganizationId }: { payingOrganizationId: string }) => {
        const charge = new SettlementCharge();
        charge.type = SettlementChargeType.ApplicationFeeService;
        charge.externalId = uuidv4();
        charge.amount = -30_00;
        charge.organizationId = payingOrganizationId;
        charge.occurredAt = new Date();
        await charge.save();

        const fee = new ApplicationFee();
        fee.externalId = uuidv4();
        fee.type = ApplicationFeeType.Service;
        fee.amount = 30_00;
        fee.organizationId = membershipOrganization.id;
        fee.payingOrganizationId = payingOrganizationId;
        fee.settlementChargeId = charge.id;
        fee.occurredAt = new Date();
        await fee.save();
        return fee;
    };

    const createInvoice = async ({ payingOrganizationId }: { payingOrganizationId: string | null }) => {
        const invoice = new Invoice();
        invoice.organizationId = membershipOrganization.id;
        invoice.payingOrganizationId = payingOrganizationId;
        await invoice.save();
        return invoice;
    };

    test('An organization without financial records can be deleted', async () => {
        const organization = await new OrganizationFactory({}).create();

        const response = await deleteOrganization(organization);

        expect(response.status).toBe(200);
        expect(await Organization.getByID(organization.id)).toBeUndefined();
    });

    const payerRecords = [
        {
            name: 'a balance item it owes',
            create: async (organization: Organization) => {
                await new BalanceItemFactory({
                    organizationId: membershipOrganization.id,
                    payingOrganizationId: organization.id,
                    amount: 1,
                    unitPrice: 10_00,
                }).create();
            },
        },
        {
            name: 'a payment it made',
            create: async (organization: Organization) => {
                await createPayment({ payingOrganizationId: organization.id });
            },
        },
        {
            name: 'an application fee it was charged',
            create: async (organization: Organization) => {
                await createApplicationFee({ payingOrganizationId: organization.id });
            },
        },
        {
            name: 'an invoice it has to pay',
            create: async (organization: Organization) => {
                await createInvoice({ payingOrganizationId: organization.id });
            },
        },
    ];

    test.each(payerRecords)('An organization with $name cannot be deleted', async ({ create }) => {
        const organization = await new OrganizationFactory({}).create();
        await create(organization);

        await expect(deleteOrganization(organization)).rejects.toThrow(STExpect.errorWithCode('organization_has_financial_records'));
        expect(await Organization.getByID(organization.id)).toBeDefined();
    });

    test('Financial records the organization received do not block the delete', async () => {
        const organization = await new OrganizationFactory({}).create();

        await new BalanceItemFactory({
            organizationId: organization.id,
            amount: 1,
            unitPrice: 10_00,
        }).create();

        const payment = new Payment();
        payment.organizationId = organization.id;
        payment.method = PaymentMethod.Transfer;
        payment.status = PaymentStatus.Succeeded;
        payment.price = 10_00;
        await payment.save();

        const invoice = new Invoice();
        invoice.organizationId = organization.id;
        await invoice.save();

        const response = await deleteOrganization(organization);

        expect(response.status).toBe(200);
        expect(await Organization.getByID(organization.id)).toBeUndefined();
    });
});
