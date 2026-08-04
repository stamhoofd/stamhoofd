import type { Organization, StripeAccount } from '@stamhoofd/models';
import { OrganizationFactory, Payment, Platform } from '@stamhoofd/models';
import { PaymentSettlement } from '@stamhoofd/models/models/PaymentSettlement.js';
import { Settlement } from '@stamhoofd/models/models/Settlement.js';
import { SettlementCharge } from '@stamhoofd/models/models/SettlementCharge.js';
import { PaymentMethod, PaymentProvider, PaymentStatus, PaymentType } from '@stamhoofd/structures';
import { SettlementChargeType } from '@stamhoofd/structures/settlements/SettlementChargeType.js';

import { StripeMocker } from '../../tests/helpers/StripeMocker.js';
import type { StripeObject } from '../../tests/helpers/StripeMocker.js';
import { StripePayoutSync } from './StripePayoutSync.js';

describe('StripePayoutSync', () => {
    const stripeMocker = new StripeMocker();
    let organization: Organization;
    let stripeAccount: StripeAccount;

    const start = new Date(2026, 0, 1);
    const created = new Date(2026, 0, 15);
    const arrivalDate = new Date(2026, 0, 20);

    let membershipOrganization: Organization;

    beforeAll(async () => {
        stripeMocker.start();
        organization = await new OrganizationFactory({}).create();
        stripeAccount = await stripeMocker.createStripeAccount(organization.id);

        // Platform payouts belong to the membership organization
        membershipOrganization = await new OrganizationFactory({}).create();
        const platform = await Platform.getForEditing();
        platform.membershipOrganizationId = membershipOrganization.id;
        await platform.save();
    });

    afterAll(() => {
        stripeMocker.stop();
    });

    beforeEach(() => {
        stripeMocker.clear();
    });

    const createSync = () => new StripePayoutSync({ secretKey: STAMHOOFD.STRIPE_SECRET_KEY! });

    const createPayment = async ({ price = 100_00_00, type = PaymentType.Payment, reversingPaymentId = null as string | null } = {}) => {
        const payment = new Payment();
        payment.organizationId = organization.id;
        payment.stripeAccountId = stripeAccount.id;
        payment.method = PaymentMethod.Bancontact;
        payment.provider = PaymentProvider.Stripe;
        payment.status = PaymentStatus.Succeeded;
        payment.type = type;
        payment.price = price;
        payment.reversingPaymentId = reversingPaymentId;
        payment.paidAt = created;
        await payment.save();
        return payment;
    };

    const getSettlement = async (payout: StripeObject) => {
        return await Settlement.select().where('externalId', payout.id).first(true);
    };

    test('a full destination-charge payout reconciles to zero', async () => {
        const payment = await createPayment({ price: 100_00_00 });
        const payout = stripeMocker.createPayout({ amount: 225, arrivalDate });

        const chargeTxn = stripeMocker.createBalanceTransaction({
            type: 'charge',
            amount: 10000,
            fee: 25,
            fee_details: [{ type: 'stripe_fee', amount: 25, description: 'Stripe processing fees' }],
            created,
            payout: payout.id,
            source: stripeMocker.createChargeObject({ metadata: { payment: payment.id } }),
        });

        stripeMocker.createBalanceTransaction({
            type: 'transfer',
            amount: -10000,
            created,
            payout: payout.id,
            source: { object: 'transfer', id: stripeMocker.createId('tr'), destination: stripeAccount.accountId },
        });

        stripeMocker.createBalanceTransaction({
            type: 'application_fee',
            amount: 250,
            created,
            payout: payout.id,
            source: stripeMocker.createApplicationFee({
                amount: 250,
                account: stripeAccount.accountId,
                originatingTransaction: stripeMocker.createChargeObject({ metadata: { payment: payment.id, serviceFee: '30' } }),
            }),
        });

        stripeMocker.createBalanceTransaction({
            type: 'payout',
            amount: -225,
            created,
            payout: payout.id,
            source: null,
        });

        const result = await createSync().syncPayouts({ start });
        expect(result).toEqual({ synced: 1, skipped: 0, failed: 0 });

        const settlement = await getSettlement(payout);
        expect(settlement).toMatchObject({
            provider: PaymentProvider.Stripe,
            stripeAccountId: null,
            organizationId: membershipOrganization.id,
            amount: 2_25_00,
            unexplainedAmount: 0,
            transactionCount: 4,
        });
        expect(settlement.syncedAt).not.toBeNull();

        const lines = await PaymentSettlement.select().where('settlementId', settlement.id).fetch();
        expect(lines).toHaveLength(1);
        expect(lines[0]).toMatchObject({ paymentId: payment.id, amount: 100_00_00, externalId: chargeTxn.id });

        const charges = await SettlementCharge.select().where('settlementId', settlement.id).fetch();
        const byType = (type: SettlementChargeType) => charges.filter(c => c.type === type);
        expect(byType(SettlementChargeType.ProviderTransactionFee)[0]).toMatchObject({
            amount: -25_00,
            paymentId: payment.id,
            providerInvoiceId: 'stripe-2026-01',
        });
        expect(byType(SettlementChargeType.Transfer)[0]).toMatchObject({ amount: -100_00_00 });
        expect(byType(SettlementChargeType.ReceivedApplicationFeeService)[0]).toMatchObject({ amount: 30_00, stripeAccountId: stripeAccount.id });
        expect(byType(SettlementChargeType.ReceivedApplicationFeeTransfer)[0]).toMatchObject({ amount: 2_20_00 });

        // The legacy blob only ever shows the payout of the payment's own account: after just the
        // platform walk it stays untouched (the connected walk writes it)
        const updated = await Payment.getByID(payment.id);
        expect(updated!.settlement).toBeNull();
    });

    test('a refund is stored on the reversing payment', async () => {
        const original = await createPayment({ price: 100_00_00 });
        const refund = await createPayment({ price: -20_00_00, type: PaymentType.Refund, reversingPaymentId: original.id });

        const payout = stripeMocker.createPayout({ amount: 8000, arrivalDate });
        stripeMocker.createBalanceTransaction({
            type: 'charge',
            amount: 10000,
            created,
            payout: payout.id,
            source: stripeMocker.createChargeObject({ metadata: { payment: original.id } }),
        });
        stripeMocker.createBalanceTransaction({
            type: 'refund',
            amount: -2000,
            created,
            payout: payout.id,
            source: {
                object: 'refund',
                id: stripeMocker.createId('re'),
                charge: stripeMocker.createChargeObject({ metadata: { payment: original.id } }),
            },
        });
        stripeMocker.createBalanceTransaction({ type: 'payout', amount: -8000, created, payout: payout.id, source: null });

        const result = await createSync().syncPayouts({ start });
        expect(result).toEqual({ synced: 1, skipped: 0, failed: 0 });

        const settlement = await getSettlement(payout);
        expect(settlement.unexplainedAmount).toBe(0);

        const lines = await PaymentSettlement.select().where('settlementId', settlement.id).fetch();
        expect(lines.map(l => [l.paymentId, l.amount]).sort()).toEqual([
            [original.id, 100_00_00],
            [refund.id, -20_00_00],
        ].sort());
    });

    test('a refund without reversing payment fails the payout', async () => {
        const original = await createPayment({ price: 100_00_00 });

        const payout = stripeMocker.createPayout({ amount: -2000, arrivalDate });
        stripeMocker.createBalanceTransaction({
            type: 'refund',
            amount: -2000,
            created,
            payout: payout.id,
            source: {
                object: 'refund',
                id: stripeMocker.createId('re'),
                charge: stripeMocker.createChargeObject({ metadata: { payment: original.id } }),
            },
        });

        const result = await createSync().syncPayouts({ start });
        expect(result).toEqual({ synced: 0, skipped: 0, failed: 1 });

        const settlement = await getSettlement(payout);
        expect(settlement.syncedAt).toBeNull();
        expect(settlement.syncFailureCount).toBe(1);
        expect(await PaymentSettlement.select().where('settlementId', settlement.id).count()).toBe(0);
    });

    test('two identical refunds pair deterministically with the two chargebacks', async () => {
        const original = await createPayment({ price: 100_00_00 });
        const first = await createPayment({ price: -20_00_00, type: PaymentType.Refund, reversingPaymentId: original.id });
        const second = await createPayment({ price: -20_00_00, type: PaymentType.Refund, reversingPaymentId: original.id });

        const payout = stripeMocker.createPayout({ amount: -4000, arrivalDate });
        for (const _ of [first, second]) {
            stripeMocker.createBalanceTransaction({
                type: 'refund',
                amount: -2000,
                created,
                payout: payout.id,
                source: {
                    object: 'refund',
                    id: stripeMocker.createId('re'),
                    charge: stripeMocker.createChargeObject({ metadata: { payment: original.id } }),
                },
            });
        }

        const sync = createSync();
        expect(await sync.syncPayouts({ start })).toEqual({ synced: 1, skipped: 0, failed: 0 });

        const settlement = await getSettlement(payout);
        const lines = await PaymentSettlement.select().where('settlementId', settlement.id).fetch();
        expect(lines.map(l => l.paymentId).sort()).toEqual([first.id, second.id].sort());

        // Re-running keeps the same pairing
        const pairing = new Map(lines.map(l => [l.externalId, l.paymentId]));
        expect(await sync.syncPayouts({ start, force: true })).toEqual({ synced: 1, skipped: 0, failed: 0 });
        const after = await PaymentSettlement.select().where('settlementId', settlement.id).fetch();
        for (const line of after) {
            expect(line.paymentId).toBe(pairing.get(line.externalId));
        }
    });

    test('an unknown fee detail type fails the payout', async () => {
        const payment = await createPayment();
        const payout = stripeMocker.createPayout({ amount: 9975, arrivalDate });
        stripeMocker.createBalanceTransaction({
            type: 'charge',
            amount: 10000,
            fee: 25,
            fee_details: [{ type: 'weird_fee', amount: 25 }],
            created,
            payout: payout.id,
            source: stripeMocker.createChargeObject({ metadata: { payment: payment.id } }),
        });

        const result = await createSync().syncPayouts({ start });
        expect(result).toEqual({ synced: 0, skipped: 0, failed: 1 });
        expect((await getSettlement(payout)).syncedAt).toBeNull();
    });

    test('an unknown transaction type fails the payout instead of inventing a row', async () => {
        const payout = stripeMocker.createPayout({ amount: 1000, arrivalDate });
        stripeMocker.createBalanceTransaction({
            type: 'connect_collection_transfer',
            amount: 1000,
            created,
            payout: payout.id,
            source: null,
        });

        const result = await createSync().syncPayouts({ start });
        expect(result).toEqual({ synced: 0, skipped: 0, failed: 1 });

        const settlement = await getSettlement(payout);
        expect(settlement.syncedAt).toBeNull();
    });

    test('fee refunds, account fees, reserves and disputes become their own rows', async () => {
        const payment = await createPayment();

        const payout = stripeMocker.createPayout({ amount: -3600, arrivalDate });
        const feeRefund = stripeMocker.createBalanceTransaction({
            type: 'application_fee_refund',
            amount: -100,
            created,
            payout: payout.id,
            source: { object: 'fee_refund', id: stripeMocker.createId('fr'), fee: 'fee_original' },
        });
        stripeMocker.createBalanceTransaction({
            type: 'stripe_fee',
            amount: -500,
            description: 'Billing - Usage Fee',
            created,
            payout: payout.id,
            source: null,
        });
        stripeMocker.createBalanceTransaction({
            type: 'reserve_transaction',
            amount: -1000,
            created,
            payout: payout.id,
            source: null,
        });
        stripeMocker.createBalanceTransaction({
            type: 'adjustment',
            amount: -2000,
            created,
            payout: payout.id,
            source: { object: 'dispute', id: stripeMocker.createId('dp'), charge: stripeMocker.createChargeObject({ metadata: { payment: payment.id } }) },
        });

        const result = await createSync().syncPayouts({ start });
        expect(result).toEqual({ synced: 1, skipped: 0, failed: 0 });

        const settlement = await getSettlement(payout);
        expect(settlement.unexplainedAmount).toBe(0);

        const charges = await SettlementCharge.select().where('settlementId', settlement.id).fetch();
        const byType = new Map(charges.map(c => [c.type, c]));

        expect(byType.get(SettlementChargeType.ApplicationFeeRefund)).toMatchObject({
            externalId: (feeRefund.source as StripeObject).id,
            amount: -1_00_00,
            applicationFeeId: 'fee_original',
        });
        expect(byType.get(SettlementChargeType.ProviderAccountFee)).toMatchObject({
            amount: -5_00_00,
            description: 'Billing - Usage Fee',
            providerInvoiceId: 'stripe-2026-01',
        });
        expect(byType.get(SettlementChargeType.Reserve)).toMatchObject({ amount: -10_00_00 });
        expect(byType.get(SettlementChargeType.Adjustment)).toMatchObject({ amount: -20_00_00, paymentId: payment.id });
    });

    test('re-running skips synced payouts and stays idempotent under force', async () => {
        const payment = await createPayment();
        const payout = stripeMocker.createPayout({ amount: 10000, arrivalDate });
        stripeMocker.createBalanceTransaction({
            type: 'charge',
            amount: 10000,
            created,
            payout: payout.id,
            source: stripeMocker.createChargeObject({ metadata: { payment: payment.id } }),
        });

        const sync = createSync();
        expect(await sync.syncPayouts({ start })).toEqual({ synced: 1, skipped: 0, failed: 0 });

        const settlement = await getSettlement(payout);
        const rowIds = (await PaymentSettlement.select().where('settlementId', settlement.id).fetch()).map(r => r.id);

        expect(await sync.syncPayouts({ start })).toEqual({ synced: 0, skipped: 1, failed: 0 });
        expect(await createSync().syncPayouts({ start, force: true })).toEqual({ synced: 1, skipped: 0, failed: 0 });

        const after = (await PaymentSettlement.select().where('settlementId', settlement.id).fetch()).map(r => r.id);
        expect(after).toEqual(rowIds);
    });

    test('a transaction that moved to another payout is swept, but Received rows only unlink', async () => {
        const payment = await createPayment();
        const otherPayment = await createPayment({ price: 50_00_00 });
        const payout = stripeMocker.createPayout({ amount: 15250, arrivalDate });

        stripeMocker.createBalanceTransaction({
            type: 'charge',
            amount: 10000,
            created,
            payout: payout.id,
            source: stripeMocker.createChargeObject({ metadata: { payment: payment.id } }),
        });
        const movedCharge = stripeMocker.createBalanceTransaction({
            type: 'charge',
            amount: 5000,
            created,
            payout: payout.id,
            source: stripeMocker.createChargeObject({ metadata: { payment: otherPayment.id } }),
        });
        const movedFee = stripeMocker.createBalanceTransaction({
            type: 'application_fee',
            amount: 250,
            created,
            payout: payout.id,
            source: stripeMocker.createApplicationFee({
                amount: 250,
                account: stripeAccount.accountId,
                originatingTransaction: stripeMocker.createChargeObject({ metadata: { payment: payment.id, serviceFee: '30' } }),
            }),
        });

        const sync = createSync();
        expect(await sync.syncPayouts({ start })).toEqual({ synced: 1, skipped: 0, failed: 0 });

        const settlement = await getSettlement(payout);
        expect(await PaymentSettlement.select().where('settlementId', settlement.id).count()).toBe(2);

        // Stripe moved the second charge and the fee to a later payout
        movedCharge.payout = stripeMocker.createId('po');
        movedFee.payout = stripeMocker.createId('po');
        payout.amount = 10000;

        expect(await sync.syncPayouts({ start, force: true })).toEqual({ synced: 1, skipped: 0, failed: 0 });

        const lines = await PaymentSettlement.select().where('settlementId', settlement.id).fetch();
        expect(lines).toHaveLength(1);
        expect(lines[0].paymentId).toBe(payment.id);

        const received = await SettlementCharge.select().where('applicationFeeId', ((movedFee.source as StripeObject)).id).fetch();
        expect(received).toHaveLength(2);
        for (const row of received) {
            expect(row.settlementId).toBeNull();
        }

        expect((await getSettlement(payout)).unexplainedAmount).toBe(0);
    });

    describe('Connected accounts', () => {
        test('an organization payout writes the mirrored deduction rows, summing to zero against the Received rows', async () => {
            const payment = await createPayment();
            const fee = stripeMocker.createApplicationFee({
                amount: 250,
                account: stripeAccount.accountId,
                originatingTransaction: stripeMocker.createChargeObject({ metadata: { payment: payment.id, serviceFee: '30' } }),
            });

            // Our platform payout receives the fee
            const platformPayout = stripeMocker.createPayout({ amount: 250, arrivalDate });
            stripeMocker.createBalanceTransaction({
                type: 'application_fee',
                amount: 250,
                created,
                payout: platformPayout.id,
                source: fee,
            });
            stripeMocker.createBalanceTransaction({ type: 'payout', amount: -250, created, payout: platformPayout.id, source: null });

            // The organization payout holds the payment, the fee sits inside its fee_details
            const payout = stripeMocker.createPayout({ amount: 9725, arrivalDate, stripeAccount: stripeAccount.accountId });
            stripeMocker.createBalanceTransaction({
                type: 'payment',
                amount: 10000,
                fee: 275,
                fee_details: [
                    { type: 'stripe_fee', amount: 25, description: 'Stripe processing fees' },
                    { type: 'application_fee', amount: 250, description: 'Application fee' },
                ],
                created,
                payout: payout.id,
                stripeAccount: stripeAccount.accountId,
                source: stripeMocker.createChargeObject({ metadata: { payment: payment.id }, application_fee: fee }),
            });
            stripeMocker.createBalanceTransaction({ type: 'payout', amount: -9725, created, payout: payout.id, stripeAccount: stripeAccount.accountId, source: null });

            const cache = new Map<string, string>();
            expect(await new StripePayoutSync({ secretKey: STAMHOOFD.STRIPE_SECRET_KEY!, cache }).syncPayouts({ start })).toEqual({ synced: 1, skipped: 0, failed: 0 });
            expect(await StripePayoutSync.syncConnectedPayouts({ secretKey: STAMHOOFD.STRIPE_SECRET_KEY!, start, cache })).toMatchObject({ synced: 1, failed: 0 });

            const settlement = await getSettlement(payout);
            expect(settlement).toMatchObject({
                stripeAccountId: stripeAccount.id,
                organizationId: organization.id,
                amount: 97_25_00,
                unexplainedAmount: 0,
            });

            const rows = await SettlementCharge.select().where('applicationFeeId', fee.id).fetch();
            const byType = new Map(rows.map(r => [r.type, r]));

            expect(byType.get(SettlementChargeType.ApplicationFeeService)).toMatchObject({
                amount: -30_00,
                settlementId: settlement.id,
                paymentId: payment.id,
                stripeAccountId: stripeAccount.id,
            });
            expect(byType.get(SettlementChargeType.ApplicationFeeTransfer)).toMatchObject({ amount: -2_20_00, settlementId: settlement.id });

            // Both sides of the same fee cancel out per kind
            expect(byType.get(SettlementChargeType.ReceivedApplicationFeeService)!.amount + byType.get(SettlementChargeType.ApplicationFeeService)!.amount).toBe(0);
            expect(byType.get(SettlementChargeType.ReceivedApplicationFeeTransfer)!.amount + byType.get(SettlementChargeType.ApplicationFeeTransfer)!.amount).toBe(0);

            // The legacy blob is dual-written with the payment's own payout, never our platform one
            const updated = await Payment.getByID(payment.id);
            expect(updated!.settlement?.id).toBe(payout.id);
        });

        test('spoofed charge metadata pointing at another account\'s payment fails the payout', async () => {
            const otherOrganization = await new OrganizationFactory({}).create();
            const otherAccount = await stripeMocker.createStripeAccount(otherOrganization.id);
            const foreignPayment = new Payment();
            foreignPayment.organizationId = otherOrganization.id;
            foreignPayment.stripeAccountId = otherAccount.id;
            foreignPayment.method = PaymentMethod.Bancontact;
            foreignPayment.provider = PaymentProvider.Stripe;
            foreignPayment.status = PaymentStatus.Succeeded;
            foreignPayment.price = 100_00_00;
            foreignPayment.paidAt = created;
            await foreignPayment.save();

            const payout = stripeMocker.createPayout({ amount: 10000, arrivalDate, stripeAccount: stripeAccount.accountId });
            stripeMocker.createBalanceTransaction({
                type: 'payment',
                amount: 10000,
                created,
                payout: payout.id,
                stripeAccount: stripeAccount.accountId,
                source: stripeMocker.createChargeObject({ metadata: { payment: foreignPayment.id } }),
            });

            const result = await new StripePayoutSync({ secretKey: STAMHOOFD.STRIPE_SECRET_KEY!, stripeAccount }).syncPayouts({ start });
            expect(result).toEqual({ synced: 0, skipped: 0, failed: 1 });
            expect((await getSettlement(payout)).syncedAt).toBeNull();
            expect(await PaymentSettlement.select().where('paymentId', foreignPayment.id).count()).toBe(0);
        });

        test('an application fee detail on the platform account fails the payout', async () => {
            const payment = await createPayment();
            const payout = stripeMocker.createPayout({ amount: 9750, arrivalDate });
            stripeMocker.createBalanceTransaction({
                type: 'charge',
                amount: 10000,
                fee: 250,
                fee_details: [{ type: 'application_fee', amount: 250 }],
                created,
                payout: payout.id,
                source: stripeMocker.createChargeObject({ metadata: { payment: payment.id } }),
            });

            const result = await createSync().syncPayouts({ start });
            expect(result).toEqual({ synced: 0, skipped: 0, failed: 1 });
            expect((await getSettlement(payout)).syncedAt).toBeNull();
        });

        test('a negative application fee detail fails the payout', async () => {
            const payment = await createPayment();
            const fee = stripeMocker.createApplicationFee({
                amount: 250,
                account: stripeAccount.accountId,
                originatingTransaction: stripeMocker.createChargeObject({ metadata: { payment: payment.id, serviceFee: '30' } }),
            });

            const payout = stripeMocker.createPayout({ amount: 10250, arrivalDate, stripeAccount: stripeAccount.accountId });
            stripeMocker.createBalanceTransaction({
                type: 'payment',
                amount: 10000,
                fee: -250,
                fee_details: [{ type: 'application_fee', amount: -250 }],
                created,
                payout: payout.id,
                stripeAccount: stripeAccount.accountId,
                source: stripeMocker.createChargeObject({ metadata: { payment: payment.id }, application_fee: fee }),
            });

            const result = await StripePayoutSync.syncConnectedPayouts({ secretKey: STAMHOOFD.STRIPE_SECRET_KEY!, start });
            expect(result.failed).toBe(1);

            const settlement = await getSettlement(payout);
            expect(settlement.syncedAt).toBeNull();
        });
    });
});
