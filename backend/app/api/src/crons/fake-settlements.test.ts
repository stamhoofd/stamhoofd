import type { Organization } from '@stamhoofd/models';
import { OrganizationFactory, Payment, StripeAccount } from '@stamhoofd/models';
import { PaymentMethod, PaymentProvider, PaymentStatus, PaymentType, Settlement } from '@stamhoofd/structures';
import { TestUtils } from '@stamhoofd/test-utils';
import { Formatter } from '@stamhoofd/utility';
import { v4 as uuidv4 } from 'uuid';
import { createFakeSettlements } from './fake-settlements.js';

describe('Cron.fake-settlements', () => {
    let organization: Organization;

    beforeEach(async () => {
        TestUtils.setEnvironment('environment', 'development');
        organization = await new OrganizationFactory({}).create();
    });

    /**
     * A moment in a week that has already ended. Week 0 is the current week, so anything from week 2
     * on is a week that is paid out no matter which day the test runs on.
     */
    const inWeek = (weeksAgo: number) => {
        return Formatter.luxon(new Date()).startOf('week').minus({ weeks: weeksAgo }).plus({ days: 2, hours: 12 }).toJSDate();
    };

    const createPayment = async ({ price = 50_0000, paidAt = inWeek(2), provider = PaymentProvider.Mollie as PaymentProvider | null, status = PaymentStatus.Succeeded, method = PaymentMethod.Bancontact, type = PaymentType.Payment, organizationId = undefined as string | undefined, stripeAccountId = null as string | null }: {
        price?: number;
        paidAt?: Date | null;
        provider?: PaymentProvider | null;
        status?: PaymentStatus;
        method?: PaymentMethod;
        type?: PaymentType;
        organizationId?: string;
        stripeAccountId?: string | null;
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

            // Refunds are taken out of the payout, just like the provider does
            amount: 65_0000,
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

        // Same week, but four accounts: four payouts, each holding only its own money
        expect(settlements.map(s => s!.amount)).toEqual([50_0000, 30_0000, 20_0000, 15_0000]);
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
        const settlement = Settlement.create({
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
});
