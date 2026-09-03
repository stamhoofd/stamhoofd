import { Request } from '@simonbackx/simple-endpoints';
import type { Token } from '@stamhoofd/models';
import { BalanceItemFactory, BlockedPaymentMandate, CachedBalance, Organization, OrganizationFactory, Payment } from '@stamhoofd/models';
import { CountFilteredRequest, MollieOnboarding, MollieStatus, PaymentMethod, PaymentType } from '@stamhoofd/structures';
import { TestUtils } from '@stamhoofd/test-utils';
import { MollieMocker } from '../../../../../tests/helpers/MollieMocker.js';
import { testServer } from '../../../../../tests/helpers/TestServer.js';
import { initAdmin, initPlatformAdmin } from '../../../../../tests/init/index.js';
import { initMembershipOrganization } from '../../../../../tests/init/initMembershipOrganization.js';
import { ChargeReceivableBalancesEndpoint } from './ChargeReceivableBalancesEndpoint.js';

describe('Endpoint.ChargeReceivableBalancesEndpoint', () => {
    const endpoint = new ChargeReceivableBalancesEndpoint();
    let mollieMocker: MollieMocker;
    let sellingOrganization: Organization;
    let sellerToken: Token;

    beforeAll(async () => {
        TestUtils.setEnvironment('userMode', 'organization');
        mollieMocker = new MollieMocker();
        mollieMocker.start();

        sellingOrganization = await initMembershipOrganization();
        sellingOrganization.privateMeta.mollieOnboarding = MollieOnboarding.create({
            canReceivePayments: true,
            canReceiveSettlements: true,
            status: MollieStatus.Completed,
        });
        const config = sellingOrganization.meta.registrationPaymentConfiguration;
        if (!config.paymentMethods.includes(PaymentMethod.CreditCard)) {
            config.paymentMethods.push(PaymentMethod.CreditCard);
        }
        config.enableMandates = true;
        await sellingOrganization.save();
        await mollieMocker.setupToken(sellingOrganization);

        sellerToken = (await initPlatformAdmin()).adminToken;
    });

    afterAll(() => {
        mollieMocker.stop();
    });

    beforeEach(() => {
        TestUtils.setEnvironment('userMode', 'organization');
        mollieMocker.reset();
    });

    const charge = async () => {
        const request = Request.buildJson('POST', '/receivable-balances/charge', sellingOrganization.getApiHost(), new CountFilteredRequest({}));
        request.headers.authorization = 'Bearer ' + sellerToken.accessToken;
        return await testServer.test(endpoint, request);
    };

    /**
     * Create a paying organization with an open balance at the seller and optionally a default mandate
     */
    const init = async ({ withMandate = true, blocked = false, withOtherMandate = false }: { withMandate?: boolean; blocked?: boolean; withOtherMandate?: boolean } = {}) => {
        const payingOrganization = await new OrganizationFactory({}).create();
        await initAdmin({ organization: payingOrganization });
        const customerId = mollieMocker.createId('cst');
        mollieMocker.customers.push({ id: customerId });
        payingOrganization.serverMeta.mollieCustomerId = customerId;

        const mandate = withMandate ? mollieMocker.addMandate({ customerId }) : null;
        if (mandate) {
            payingOrganization.serverMeta.mollieMandateId = mandate.id;
            if (blocked) {
                payingOrganization.serverMeta.blockedMandates.push(BlockedPaymentMandate.create({ id: mandate.id }));
            }
        }
        const otherMandate = withOtherMandate ? mollieMocker.addMandate({ customerId, cardNumber: '9999' }) : null;
        await payingOrganization.save();

        await new BalanceItemFactory({
            organizationId: sellingOrganization.id,
            payingOrganizationId: payingOrganization.id,
            amount: 1,
            unitPrice: 50_0000,
        }).create();
        await CachedBalance.updateForOrganizations(sellingOrganization.id, [payingOrganization.id]);

        return { payingOrganization, mandate, otherMandate };
    };

    const getPayments = async (payingOrganization: Organization) => {
        return await Payment.select().where('payingOrganizationId', payingOrganization.id).fetch();
    };

    test('An open balance is charged on the default mandate', async () => {
        const { payingOrganization, mandate } = await init();

        const response = await charge();
        expect(response.status).toBe(201);

        const payments = await getPayments(payingOrganization);
        expect(payments).toHaveLength(1);
        expect(payments[0]).toMatchObject({
            type: PaymentType.Payment,
            price: 50_0000,
            mandateId: mandate!.id,
        });
        expect(mollieMocker.payments).toHaveLength(1);
        expect(mollieMocker.payments[0].mandateId).toBe(mandate!.id);
    });

    test('An open balance is not charged on a blocked default mandate', async () => {
        const { payingOrganization } = await init({ blocked: true });

        const response = await charge();
        expect(response.status).toBe(201);

        expect(await getPayments(payingOrganization)).toHaveLength(0);
        expect(mollieMocker.payments).toHaveLength(0);
    });

    test('An open balance is charged on another usable mandate when the default is blocked', async () => {
        const { payingOrganization, otherMandate } = await init({ blocked: true, withOtherMandate: true });

        const response = await charge();
        expect(response.status).toBe(201);

        const payments = await getPayments(payingOrganization);
        expect(payments).toHaveLength(1);
        expect(payments[0].mandateId).toBe(otherMandate!.id);
        expect(mollieMocker.payments[0].mandateId).toBe(otherMandate!.id);
    });

    test('An open balance is not charged without a default mandate', async () => {
        const { payingOrganization } = await init({ withMandate: false });

        const response = await charge();
        expect(response.status).toBe(201);

        expect(await getPayments(payingOrganization)).toHaveLength(0);
        expect(mollieMocker.payments).toHaveLength(0);
    });
});
