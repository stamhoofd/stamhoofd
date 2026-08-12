import type { Organization } from '@stamhoofd/models';
import { OrganizationFactory, Payment, Platform, StripeAccount } from '@stamhoofd/models';
import { ApplicationFee } from '@stamhoofd/models/models/ApplicationFee.js';
import { PaymentSettlement } from '@stamhoofd/models/models/PaymentSettlement.js';
import { Settlement } from '@stamhoofd/models/models/Settlement.js';
import { SettlementCharge } from '@stamhoofd/models/models/SettlementCharge.js';
import { PaymentMethod, PaymentProvider, PaymentStatus, PaymentType, SettlementReference } from '@stamhoofd/structures';
import { ApplicationFeeType } from '@stamhoofd/structures/settlements/ApplicationFeeType.js';
import { SettlementChargeType } from '@stamhoofd/structures/settlements/SettlementChargeType.js';
import { TestUtils } from '@stamhoofd/test-utils';
import { Formatter } from '@stamhoofd/utility';
import { v4 as uuidv4 } from 'uuid';
import { createFakeSettlements } from './fake-settlements.js';

describe('Cron.fake-settlements', () => {
    let organization: Organization;
    let membershipOrganization: Organization;

    beforeAll(async () => {
        membershipOrganization = await new OrganizationFactory({}).create();
    });

    beforeEach(async () => {
        TestUtils.setEnvironment('environment', 'development');
        organization = await new OrganizationFactory({}).create();

        // The platform's own accounts belong to the membership organization
        const platform = await Platform.getForEditing();
        platform.membershipOrganizationId = membershipOrganization.id;
        await platform.save();
    });

    /**
     * A moment in a week that has already ended. Week 0 is the current week, so anything from week 2
     * on is a week that is paid out no matter which day the test runs on.
     */
    const inWeek = (weeksAgo: number) => {
        return Formatter.luxon(new Date()).startOf('week').minus({ weeks: weeksAgo }).plus({ days: 2, hours: 12 }).toJSDate();
    };

    const createPayment = async ({ price = 50_0000, paidAt = inWeek(2), provider = PaymentProvider.Mollie as PaymentProvider | null, status = PaymentStatus.Succeeded, method = PaymentMethod.Bancontact, type = PaymentType.Payment, organizationId = undefined as string | undefined, stripeAccountId = null as string | null, serviceFeePayout = 0, transferFee = 0 }: {
        price?: number;
        paidAt?: Date | null;
        provider?: PaymentProvider | null;
        status?: PaymentStatus;
        method?: PaymentMethod;
        type?: PaymentType;
        organizationId?: string;
        stripeAccountId?: string | null;
        serviceFeePayout?: number;
        transferFee?: number;
    } = {}) => {
        const payment = new Payment();
        payment.organizationId = organizationId ?? organization.id;
        payment.method = method;
        payment.provider = provider;
        payment.status = status;
        payment.type = type;
        payment.price = price;
        payment.paidAt = paidAt;
        payment.stripeAccountId = stripeAccountId;
        payment.serviceFeePayout = serviceFeePayout;
        payment.transferFee = transferFee;
        await payment.save();
        return payment;
    };

    const createStripeAccount = async (forOrganization: Organization) => {
        const stripeAccount = new StripeAccount();
        stripeAccount.organizationId = forOrganization.id;
        stripeAccount.accountId = 'acct_' + uuidv4();
        await stripeAccount.save();
        return stripeAccount;
    };

    const getSettlement = async (payment: Payment) => {
        const updated = await Payment.getByID(payment.id);
        return updated!.settlement;
    };

    test('Payments of the same week and provider are paid out together', async () => {
        const first = await createPayment({ price: 50_0000 });
        const second = await createPayment({ price: 25_0000 });
        const refund = await createPayment({ price: -10_0000, type: PaymentType.Refund });

        await createFakeSettlements();

        const settlement = await getSettlement(first);
        expect(settlement).toMatchObject({
            settledAt: Formatter.luxon(inWeek(2)).startOf('week').plus({ weeks: 1, days: 2 }).toJSDate(),

            // Refunds are taken out of the payout, just like the provider does, and so are the
            // fake Mollie costs: 3 payments x 0.30 + 21% VAT
            amount: 65_0000 - 90_00 - 18_90,
        });

        // All payments of the week point to the same payout
        expect(await getSettlement(second)).toEqual(settlement);
        expect(await getSettlement(refund)).toEqual(settlement);
    });

    test('Every week gets its own payout', async () => {
        const older = await createPayment({ paidAt: inWeek(3) });
        const newer = await createPayment({ paidAt: inWeek(2) });

        await createFakeSettlements();

        const olderSettlement = await getSettlement(older);
        const newerSettlement = await getSettlement(newer);

        expect(olderSettlement).not.toBeNull();
        expect(newerSettlement).not.toBeNull();
        expect(olderSettlement!.id).not.toBe(newerSettlement!.id);
        expect(olderSettlement!.reference).not.toBe(newerSettlement!.reference);
        expect(olderSettlement!.settledAt.getTime()).toBeLessThan(newerSettlement!.settledAt.getTime());
    });

    test('Money held on another account is paid out separately', async () => {
        const otherOrganization = await new OrganizationFactory({}).create();
        const stripeAccount = await createStripeAccount(organization);
        const otherStripeAccount = await createStripeAccount(organization);

        const mollie = await createPayment({ price: 50_0000 });
        const otherMollie = await createPayment({ price: 30_0000, organizationId: otherOrganization.id });
        const stripe = await createPayment({ price: 20_0000, provider: PaymentProvider.Stripe, stripeAccountId: stripeAccount.id });
        const otherStripe = await createPayment({ price: 15_0000, provider: PaymentProvider.Stripe, stripeAccountId: otherStripeAccount.id });

        await createFakeSettlements();

        const settlements = [
            await getSettlement(mollie),
            await getSettlement(otherMollie),
            await getSettlement(stripe),
            await getSettlement(otherStripe),
        ];

        // Same week, but four accounts: four payouts, each holding only its own money. The Mollie
        // payouts are reduced by the fake cost of one payment (0.30 + 21% VAT); the Stripe payments
        // carry no fees here
        expect(settlements.map(s => s!.amount)).toEqual([50_0000 - 36_30, 30_0000 - 36_30, 20_0000, 15_0000]);
        expect(new Set(settlements.map(s => s!.id)).size).toBe(4);
        expect(new Set(settlements.map(s => s!.reference)).size).toBe(4);
    });

    test('Payments that a provider would still be holding on to are not paid out', async () => {
        // The payout of the current week didn't happen yet
        const thisWeek = await createPayment({ paidAt: new Date() });

        const pending = await createPayment({ status: PaymentStatus.Pending });
        const failed = await createPayment({ status: PaymentStatus.Failed });

        // These providers don't hold on to the money
        const transfer = await createPayment({ method: PaymentMethod.Transfer, provider: null });
        const payconiq = await createPayment({ provider: PaymentProvider.Payconiq, method: PaymentMethod.Payconiq });

        await createFakeSettlements();

        for (const payment of [thisWeek, pending, failed, transfer, payconiq]) {
            expect(await getSettlement(payment)).toBeNull();
        }
    });

    test('A payment that was already paid out keeps its own payout', async () => {
        const settlement = SettlementReference.create({
            id: 'stl_1',
            reference: '1234.1234.1234',
            settledAt: inWeek(1),
            amount: 100_0000,
        });

        const payment = await createPayment();
        payment.settlement = settlement;
        await payment.save();

        await createFakeSettlements();

        expect(await getSettlement(payment)).toEqual(settlement);
    });

    test('Nothing is paid out outside development', async () => {
        TestUtils.setEnvironment('environment', 'staging');
        const payment = await createPayment();

        await createFakeSettlements();

        expect(await getSettlement(payment)).toBeNull();
    });

    describe('Settlement rows', () => {
        const getSettlementRow = async (payment: Payment) => {
            const reference = await getSettlement(payment);
            return await Settlement.select().where('externalId', reference!.id).first(true);
        };

        test('A Mollie payout stores payment lines and cost rows, and reconciles to zero', async () => {
            const first = await createPayment({ price: 50_0000 });
            const second = await createPayment({ price: -10_0000, type: PaymentType.Refund });

            await createFakeSettlements();

            const settlement = await getSettlementRow(first);
            expect(settlement.provider).toBe(PaymentProvider.Mollie);
            expect(settlement.organizationId).toBe(organization.id);
            expect(settlement.amount).toBe(40_0000 - 60_00 - 12_60);
            expect(settlement.unexplainedAmount).toBe(0);
            expect(settlement.syncedAt).not.toBeNull();

            const lines = await PaymentSettlement.select().where('settlementId', settlement.id).fetch();
            expect(lines.map(l => [l.paymentId, l.amount]).sort()).toEqual([
                [first.id, 50_0000],
                [second.id, -10_0000],
            ].sort());

            const settledMonth = settlement.settledAt.getFullYear() + '-' + (settlement.settledAt.getMonth() + 1).toString().padStart(2, '0');
            const charges = await SettlementCharge.select().where('settlementId', settlement.id).fetch();
            expect(charges.map(c => ({ type: c.type, amount: c.amount, providerInvoiceId: c.providerInvoiceId })).sort((a, b) => a.amount - b.amount)).toEqual([
                { type: SettlementChargeType.ProviderTransactionFee, amount: -60_00, providerInvoiceId: 'fake-invoice-mollie-' + settledMonth },
                { type: SettlementChargeType.Tax, amount: -12_60, providerInvoiceId: 'fake-invoice-mollie-' + settledMonth },
            ]);
        });

        test('A Stripe application fee is mirrored on the payout and a monthly platform payout', async () => {
            const stripeAccount = await createStripeAccount(organization);
            const payment = await createPayment({
                price: 20_0000,
                provider: PaymentProvider.Stripe,
                stripeAccountId: stripeAccount.id,
                serviceFeePayout: 2_0000,
                transferFee: 50_00,
            });

            await createFakeSettlements();

            const settlement = await getSettlementRow(payment);
            expect(settlement.amount).toBe(20_0000 - 2_0000 - 50_00);
            expect(settlement.unexplainedAmount).toBe(0);
            expect(settlement.stripeAccountId).toBe(stripeAccount.id);

            const applicationFeeId = 'fake-fee-' + payment.id;
            const feeRows = await SettlementCharge.select().where('applicationFeeId', applicationFeeId).fetch();

            const byType = new Map(feeRows.map(row => [row.type, row]));
            expect(byType.get(SettlementChargeType.ApplicationFeeService)).toMatchObject({
                amount: -2_0000, settlementId: settlement.id, paymentId: payment.id, stripeAccountId: stripeAccount.id,
            });
            expect(byType.get(SettlementChargeType.ApplicationFeeTransfer)).toMatchObject({
                amount: -50_00, settlementId: settlement.id,
            });

            // The platform side receives the same fee: per application fee both sides of one kind
            // sum to zero
            const fees = await ApplicationFee.select().where('externalId', applicationFeeId).fetch();
            const feeByType = new Map(fees.map(fee => [fee.type, fee]));
            expect(feeByType.get(ApplicationFeeType.Service)).toMatchObject({
                amount: 2_0000,
                organizationId: membershipOrganization.id,
                payingOrganizationId: organization.id,
                payingStripeAccountId: stripeAccount.id,
                payingPaymentId: payment.id,
            });
            expect(feeByType.get(ApplicationFeeType.Transfer)!.amount).toBe(50_00);

            const platformSettlement = await Settlement.getByID(feeByType.get(ApplicationFeeType.Service)!.settlementId!);
            expect(platformSettlement!.stripeAccountId).toBeNull();
            expect(platformSettlement!.organizationId).toBe(membershipOrganization.id);
            expect(platformSettlement!.externalId).toContain('fake-settlement-Stripe-platform-');

            // The monthly platform settlement is shared: unsettled payments of other tests in the
            // same database land in it too, so only the identity is asserted, not the exact amount
            expect(platformSettlement!.amount).toBeGreaterThanOrEqual(2_5000);
            expect(platformSettlement!.unexplainedAmount).toBe(0);
        });

        test('Payments without fees write no charge rows', async () => {
            const stripeAccount = await createStripeAccount(organization);
            const payment = await createPayment({ price: 20_0000, provider: PaymentProvider.Stripe, stripeAccountId: stripeAccount.id });

            await createFakeSettlements();

            const settlement = await getSettlementRow(payment);
            expect(settlement.amount).toBe(20_0000);
            expect(settlement.unexplainedAmount).toBe(0);
            expect(await SettlementCharge.select().where('settlementId', settlement.id).count()).toBe(0);
        });
    });
});
