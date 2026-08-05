import type { Organization, StripeAccount } from '@stamhoofd/models';
import { OrganizationFactory, Payment } from '@stamhoofd/models';
import { SettlementCharge } from '@stamhoofd/models/models/SettlementCharge.js';
import { PaymentMethod, PaymentProvider, PaymentStatus } from '@stamhoofd/structures';
import { SettlementChargeType } from '@stamhoofd/structures/settlements/SettlementChargeType.js';

import { StripeMocker } from '../../tests/helpers/StripeMocker.js';
import { StripeFeeSync } from './StripeFeeSync.js';

describe('StripeFeeSync', () => {
    const stripeMocker = new StripeMocker();
    let organization: Organization;
    let stripeAccount: StripeAccount;

    const start = new Date(2026, 0, 1);
    const end = new Date(2026, 1, 1);
    const created = new Date(2026, 0, 15);

    beforeAll(async () => {
        stripeMocker.start();
        organization = await new OrganizationFactory({}).create();
        stripeAccount = await stripeMocker.createStripeAccount(organization.id);
    });

    afterAll(() => {
        stripeMocker.stop();
    });

    beforeEach(() => {
        stripeMocker.clear();
    });

    const createSync = () => new StripeFeeSync({ secretKey: STAMHOOFD.STRIPE_SECRET_KEY! });

    const createPayment = async () => {
        const payment = new Payment();
        payment.organizationId = organization.id;
        payment.stripeAccountId = stripeAccount.id;
        payment.method = PaymentMethod.Bancontact;
        payment.provider = PaymentProvider.Stripe;
        payment.status = PaymentStatus.Succeeded;
        payment.price = 25_00_00;
        payment.paidAt = created;
        await payment.save();
        return payment;
    };

    /**
     * One application_fee balance transaction of `feeCents`, of which `serviceFeeCents` is the
     * service part (stored in the originating charge metadata, like the payment flow does).
     */
    const mockFeeTransaction = ({ payment, feeCents = 250, serviceFeeCents = 30 as number | string | null, account = undefined as string | undefined }: { payment: Payment | null; feeCents?: number; serviceFeeCents?: number | string | null; account?: string }) => {
        const metadata: Record<string, string> = {};
        if (payment) {
            metadata.payment = payment.id;
        }
        if (serviceFeeCents !== null) {
            metadata.serviceFee = serviceFeeCents.toString();
        }

        const charge = stripeMocker.createChargeObject({ metadata });
        const fee = stripeMocker.createApplicationFee({
            amount: feeCents,
            account: account ?? stripeAccount.accountId,
            originatingTransaction: charge,
        });

        const transaction = stripeMocker.createBalanceTransaction({
            type: 'application_fee',
            amount: feeCents,
            created,
            source: fee,
        });

        return { charge, fee, transaction };
    };

    test('one fee becomes two Received rows with the metadata split', async () => {
        const payment = await createPayment();
        const { fee } = mockFeeTransaction({ payment, feeCents: 250, serviceFeeCents: 30 });

        await createSync().syncFees({ start, end });

        const rows = await SettlementCharge.select().where('applicationFeeId', fee.id).fetch();
        const byType = new Map(rows.map(r => [r.type, r]));

        expect(rows).toHaveLength(2);
        expect(byType.get(SettlementChargeType.ReceivedApplicationFeeService)).toMatchObject({
            externalId: fee.id + ':' + SettlementChargeType.ReceivedApplicationFeeService,
            amount: 30_00,
            settlementId: null,
            paymentId: payment.id,
            organizationId: organization.id,
            stripeAccountId: stripeAccount.id,
            occurredAt: created,
        });
        expect(byType.get(SettlementChargeType.ReceivedApplicationFeeTransfer)).toMatchObject({
            amount: 2_20_00,
            paymentId: payment.id,
        });
    });

    test('re-running stores identical rows', async () => {
        const payment = await createPayment();
        const { fee } = mockFeeTransaction({ payment });

        const sync = createSync();
        await sync.syncFees({ start, end });
        const before = (await SettlementCharge.select().where('applicationFeeId', fee.id).fetch()).map(r => r.id).sort();

        await sync.syncFees({ start, end });
        const after = (await SettlementCharge.select().where('applicationFeeId', fee.id).fetch()).map(r => r.id).sort();

        expect(after).toEqual(before);
    });

    test('missing serviceFee metadata stores nothing for that fee, but not at the cost of the others', async () => {
        const payment = await createPayment();
        const broken = mockFeeTransaction({ payment, serviceFeeCents: null });
        const good = mockFeeTransaction({ payment, feeCents: 300, serviceFeeCents: 50 });

        await expect(createSync().syncFees({ start, end })).rejects.toThrow(/Fee sync failed for 1 transaction/);

        expect(await SettlementCharge.select().where('applicationFeeId', broken.fee.id).count()).toBe(0);
        expect(await SettlementCharge.select().where('applicationFeeId', good.fee.id).count()).toBe(2);
    });

    test('an unresolvable payment throws instead of storing a guessed row', async () => {
        const { fee } = mockFeeTransaction({ payment: null });

        await expect(createSync().syncFees({ start, end })).rejects.toThrow(/Fee sync failed/);
        expect(await SettlementCharge.select().where('applicationFeeId', fee.id).count()).toBe(0);
    });

    test('an unknown Stripe account throws', async () => {
        const payment = await createPayment();
        mockFeeTransaction({ payment, account: 'acct_unknown' });

        await expect(createSync().syncFees({ start, end })).rejects.toThrow(/No Stripe account found/);
    });

    test('a zero service fee only writes the transfer row', async () => {
        const payment = await createPayment();
        const { fee } = mockFeeTransaction({ payment, feeCents: 100, serviceFeeCents: 0 });

        await createSync().syncFees({ start, end });

        const rows = await SettlementCharge.select().where('applicationFeeId', fee.id).fetch();
        expect(rows).toHaveLength(1);
        expect(rows[0].type).toBe(SettlementChargeType.ReceivedApplicationFeeTransfer);
        expect(rows[0].amount).toBe(1_00_00);
    });

    test('transactions outside the window are left alone', async () => {
        const payment = await createPayment();
        const { fee, transaction } = mockFeeTransaction({ payment });
        transaction.created = Math.floor(new Date(2026, 2, 15).getTime() / 1000);

        await createSync().syncFees({ start, end });

        expect(await SettlementCharge.select().where('applicationFeeId', fee.id).count()).toBe(0);
    });
});
