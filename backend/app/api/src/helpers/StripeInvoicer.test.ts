import type { StripeAccount } from '@stamhoofd/models';
import { BalanceItem, BalanceItemPayment, Organization, OrganizationFactory, Payment } from '@stamhoofd/models';
import { SettlementCharge } from '@stamhoofd/models/models/SettlementCharge.js';
import { Address, BalanceItemType, Company, PaymentMethod, PaymentProvider, PaymentStatus } from '@stamhoofd/structures';
import { Country } from '@stamhoofd/types/Country';
import { SettlementChargeType } from '@stamhoofd/structures/settlements/SettlementChargeType.js';

import { StripeMocker } from '../../tests/helpers/StripeMocker.js';
import { initMembershipOrganization } from '../../tests/init/initMembershipOrganization.js';
import { StripeInvoicer } from './StripeInvoicer.js';

describe('StripeInvoicer', () => {
    const stripeMocker = new StripeMocker();
    let membershipOrganization: Organization;

    // Invoice May 2030: a month no other test writes fee rows in
    const month = new Date(2030, 4, 15);
    const created = new Date(2030, 4, 10);
    const reference = 'stripe-fees-2030-05-01';

    const belgianAddress = () => Address.create({
        street: 'Teststraat',
        number: '1',
        postalCode: '9000',
        city: 'Gent',
        country: Country.Belgium,
    });

    beforeAll(async () => {
        stripeMocker.start();

        membershipOrganization = await initMembershipOrganization();
        membershipOrganization.meta.companies = [
            Company.create({
                name: 'Platform BV',
                companyNumber: '0700000000',
                VATNumber: 'BE0700000000',
                address: belgianAddress(),
            }),
        ];
        await membershipOrganization.save();
    });

    afterAll(() => {
        stripeMocker.stop();
    });

    beforeEach(async () => {
        stripeMocker.clear();

        // The test database persists across runs: remove this month's leftover fee rows (earlier
        // runs' organizations were cleaned up, cascading their account link away)
        await SettlementCharge.delete()
            .where('occurredAt', '>=', new Date(2030, 4, 1))
            .where('occurredAt', '<', new Date(2030, 5, 1));
    });

    const init = async () => {
        const organization = await new OrganizationFactory({}).create();
        organization.meta.companies = [
            Company.create({
                name: 'Testvereniging VZW ' + organization.id,
                companyNumber: '0500000000',
                VATNumber: 'BE0500000000',
                address: belgianAddress(),
            }),
        ];
        await organization.save();

        const stripeAccount = await stripeMocker.createStripeAccount(organization.id);

        const payment = new Payment();
        payment.organizationId = organization.id;
        payment.stripeAccountId = stripeAccount.id;
        payment.method = PaymentMethod.Bancontact;
        payment.provider = PaymentProvider.Stripe;
        payment.status = PaymentStatus.Succeeded;
        payment.price = 25_00_00;
        payment.paidAt = created;
        await payment.save();

        return { organization, stripeAccount, payment };
    };

    /**
     * The application fee the fee sync will find for the month: 2.50 with a 0.30 service part.
     */
    const mockFeeTransaction = (stripeAccount: StripeAccount, payment: Payment, { feeCents = 250, serviceFeeCents = '30' as string | null } = {}) => {
        const metadata: Record<string, string> = { payment: payment.id };
        if (serviceFeeCents !== null) {
            metadata.serviceFee = serviceFeeCents;
        }

        return stripeMocker.createBalanceTransaction({
            type: 'application_fee',
            amount: feeCents,
            created,
            source: stripeMocker.createApplicationFee({
                amount: feeCents,
                account: stripeAccount.accountId,
                originatingTransaction: stripeMocker.createChargeObject({ metadata }),
            }),
        });
    };

    const getFeePayment = async (organization: Organization) => {
        return await Payment.select()
            .where('payingOrganizationId', organization.id)
            .where('reference', reference)
            .where('method', PaymentMethod.AccountDeductions)
            .first(false);
    };

    test('a month is invoiced from the stored fee rows and the rows are marked invoiced', async () => {
        const { organization, stripeAccount, payment } = await init();
        mockFeeTransaction(stripeAccount, payment);

        const invoicer = new StripeInvoicer({ secretKey: STAMHOOFD.STRIPE_SECRET_KEY! });
        await invoicer.generateInvoices(membershipOrganization, month, { force: true });

        const feePayment = await getFeePayment(organization);
        expect(feePayment).not.toBeNull();
        expect(feePayment!.price).toBe(2_50_00);
        expect(feePayment!.status).toBe(PaymentStatus.Succeeded);
        expect(feePayment!.provider).toBe(PaymentProvider.Stripe);
        expect(feePayment!.stripeAccountId).toBe(stripeAccount.id);

        const balanceItemPayments = await BalanceItemPayment.select().where('paymentId', feePayment!.id).fetch();
        const balanceItems = await BalanceItem.select().where('id', balanceItemPayments.map(b => b.balanceItemId)).fetch();
        const serviceItem = balanceItems.find(i => i.type === BalanceItemType.ServiceFee);
        const transferItem = balanceItems.find(i => i.type === BalanceItemType.TransferFee);

        expect(serviceItem?.unitPrice).toBe(30_00);
        expect(transferItem?.unitPrice).toBe(2_20_00);

        // The invoiced fee rows carry the balance item that billed them
        const rows = await SettlementCharge.select().where('stripeAccountId', stripeAccount.id).fetch();
        expect(rows).toHaveLength(2);
        expect(rows.find(r => r.type === SettlementChargeType.ReceivedApplicationFeeService)?.balanceItemId).toBe(serviceItem!.id);
        expect(rows.find(r => r.type === SettlementChargeType.ReceivedApplicationFeeTransfer)?.balanceItemId).toBe(transferItem!.id);
    });

    test('re-running an invoiced month creates no second payment', async () => {
        const { organization, stripeAccount, payment } = await init();
        mockFeeTransaction(stripeAccount, payment);

        const invoicer = new StripeInvoicer({ secretKey: STAMHOOFD.STRIPE_SECRET_KEY! });
        await invoicer.generateInvoices(membershipOrganization, month, { force: true });
        await invoicer.generateInvoices(membershipOrganization, month, { force: true });

        const feePayments = await Payment.select()
            .where('payingOrganizationId', organization.id)
            .where('reference', reference)
            .where('method', PaymentMethod.AccountDeductions)
            .fetch();
        expect(feePayments).toHaveLength(1);
    });

    test('a month with a broken fee waits instead of invoicing short', async () => {
        const { organization, stripeAccount, payment } = await init();
        mockFeeTransaction(stripeAccount, payment, { serviceFeeCents: null });

        const invoicer = new StripeInvoicer({ secretKey: STAMHOOFD.STRIPE_SECRET_KEY! });
        await invoicer.generateInvoices(membershipOrganization, month, { force: true });

        expect(await getFeePayment(organization)).toBeNull();
    });
});
