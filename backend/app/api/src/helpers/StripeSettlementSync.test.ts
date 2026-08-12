import { EmailMocker } from '@stamhoofd/email';
import type { Organization, StripeAccount } from '@stamhoofd/models';
import { OrganizationFactory, Payment, Platform } from '@stamhoofd/models';
import { ApplicationFee } from '@stamhoofd/models/models/ApplicationFee.js';
import { PaymentSettlement } from '@stamhoofd/models/models/PaymentSettlement.js';
import { Settlement } from '@stamhoofd/models/models/Settlement.js';
import { SettlementCharge } from '@stamhoofd/models/models/SettlementCharge.js';
import { PaymentMethod, PaymentProvider, PaymentStatus, PaymentType } from '@stamhoofd/structures';
import { ApplicationFeeType } from '@stamhoofd/structures/settlements/ApplicationFeeType.js';
import { SettlementChargeType } from '@stamhoofd/structures/settlements/SettlementChargeType.js';
import { SettlementStatus } from '@stamhoofd/structures/settlements/SettlementStatus.js';
import { v4 as uuidv4 } from 'uuid';

import { StripeMocker } from '../../tests/helpers/StripeMocker.js';
import type { StripeObject } from '../../tests/helpers/StripeMocker.js';
import { StripeSettlementSync } from './StripeSettlementSync.js';
import { StripeSettlementSyncRunner } from './StripeSettlementSyncRunner.js';
import { WebmasterReport } from './WebmasterReport.js';

describe('StripeSettlementSync', () => {
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
        StripeSettlementSync.resetWarnings();
    });

    const createSync = () => new StripeSettlementSync({ secretKey: STAMHOOFD.STRIPE_SECRET_KEY! });
    const createConnectedSync = () => new StripeSettlementSync({ secretKey: STAMHOOFD.STRIPE_SECRET_KEY!, stripeAccount });

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

        // The payment belongs to the connected organization: it only passes through our balance on
        // its way there, so nothing of it is stored here. What remains is what Stripe charged us
        const lines = await PaymentSettlement.select().where('settlementId', settlement.id).fetch();
        expect(lines).toHaveLength(0);

        const charges = await SettlementCharge.select().where('settlementId', settlement.id).fetch();
        expect(charges).toHaveLength(1);
        expect(charges[0]).toMatchObject({
            type: SettlementChargeType.ProviderTransactionFee,
            amount: -25_00,
            paymentId: null,
            providerInvoiceId: 'stripe-2026-01',
        });

        // The received fees are application fee rows, waiting to be invoiced
        const fees = await ApplicationFee.select().where('settlementId', settlement.id).fetch();
        const feeByType = new Map(fees.map(f => [f.type, f]));
        expect(feeByType.get(ApplicationFeeType.Service)).toMatchObject({
            amount: 30_00,
            organizationId: membershipOrganization.id,
            payingOrganizationId: organization.id,
            payingStripeAccountId: stripeAccount.id,
            payingPaymentId: payment.id,
            balanceItemId: null,
        });
        expect(feeByType.get(ApplicationFeeType.Transfer)!.amount).toBe(2_20_00);
        expect(settlement.pendingFees).toBe(2_50_00);

        // The legacy blob only ever shows the payout of the payment's own account: after just the
        // platform walk it stays untouched (the connected walk writes it)
        const updated = await Payment.getByID(payment.id);
        expect(updated!.settlement).toBeNull();
    });

    test('a refund is stored on the reversing payment', async () => {
        const original = await createPayment({ price: 100_00_00 });
        const refund = await createPayment({ price: -20_00_00, type: PaymentType.Refund, reversingPaymentId: original.id });

        // The organization's own payout settles its payments
        const payout = stripeMocker.createPayout({ amount: 8000, arrivalDate, stripeAccount: stripeAccount.accountId });
        stripeMocker.createBalanceTransaction({
            type: 'payment',
            amount: 10000,
            created,
            payout: payout.id,
            stripeAccount: stripeAccount.accountId,
            source: stripeMocker.createChargeObject({ metadata: { payment: original.id } }),
        });
        stripeMocker.createBalanceTransaction({
            type: 'payment_refund',
            amount: -2000,
            created,
            payout: payout.id,
            stripeAccount: stripeAccount.accountId,
            source: {
                object: 'refund',
                id: stripeMocker.createId('re'),
                charge: stripeMocker.createChargeObject({ metadata: { payment: original.id } }),
            },
        });
        stripeMocker.createBalanceTransaction({ type: 'payout', amount: -8000, created, payout: payout.id, stripeAccount: stripeAccount.accountId, source: null });

        const result = await createConnectedSync().syncPayouts({ start });
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

        const payout = stripeMocker.createPayout({ amount: -2000, arrivalDate, stripeAccount: stripeAccount.accountId });
        stripeMocker.createBalanceTransaction({
            type: 'payment_refund',
            amount: -2000,
            created,
            payout: payout.id,
            stripeAccount: stripeAccount.accountId,
            source: {
                object: 'refund',
                id: stripeMocker.createId('re'),
                charge: stripeMocker.createChargeObject({ metadata: { payment: original.id } }),
            },
        });

        const result = await createConnectedSync().syncPayouts({ start });
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

        const payout = stripeMocker.createPayout({ amount: -4000, arrivalDate, stripeAccount: stripeAccount.accountId });
        for (const _ of [first, second]) {
            stripeMocker.createBalanceTransaction({
                type: 'payment_refund',
                amount: -2000,
                created,
                payout: payout.id,
                stripeAccount: stripeAccount.accountId,
                source: {
                    object: 'refund',
                    id: stripeMocker.createId('re'),
                    charge: stripeMocker.createChargeObject({ metadata: { payment: original.id } }),
                },
            });
        }

        const sync = createConnectedSync();
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
            type: 'issuing_authorization_hold',
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

    test('balance movements around the payouts themselves are stored, not refused', async () => {
        const payout = stripeMocker.createPayout({ amount: 5000, arrivalDate });
        for (const type of ['payout_failure', 'topup', 'connect_collection_transfer']) {
            stripeMocker.createBalanceTransaction({
                type,
                amount: type === 'connect_collection_transfer' ? 1000 : 2000,
                created,
                payout: payout.id,
                source: null,
            });
        }

        expect(await createSync().syncPayouts({ start })).toEqual({ synced: 1, skipped: 0, failed: 0 });

        const settlement = await getSettlement(payout);
        const charges = await SettlementCharge.select().where('settlementId', settlement.id).fetch();
        expect(charges).toHaveLength(3);
        expect(charges.every(c => c.type === SettlementChargeType.BalanceMovement)).toBe(true);
        expect(settlement.unexplainedAmount).toBe(0);
    });

    test('a payout Stripe has not reconciled yet is left for the next run', async () => {
        const payout = stripeMocker.createPayout({ amount: 1000, arrivalDate, reconciliation_status: 'in_progress' });
        stripeMocker.createBalanceTransaction({ type: 'stripe_fee', amount: 1000, created, payout: payout.id, source: null });

        // Stripe would return no transactions for it: syncing anyway would store an empty payout
        expect(await createSync().syncPayouts({ start })).toEqual({ synced: 0, skipped: 1, failed: 0 });
        expect((await getSettlement(payout)).syncedAt).toBeNull();
    });

    test('a payout Stripe never reports the transactions of fails loudly', async () => {
        const payout = stripeMocker.createPayout({ amount: 1000, arrivalDate, reconciliation_status: 'not_applicable' });

        expect(await createSync().syncPayouts({ start })).toEqual({ synced: 0, skipped: 0, failed: 1 });
        expect((await getSettlement(payout)).syncedAt).toBeNull();
    });

    test('a payout without transactions is not stored as a complete sync', async () => {
        const payout = stripeMocker.createPayout({ amount: 1000, arrivalDate });

        expect(await createSync().syncPayouts({ start })).toEqual({ synced: 0, skipped: 0, failed: 1 });
        expect((await getSettlement(payout)).syncedAt).toBeNull();
    });

    test('failing payouts are reported in one email', async () => {
        const first = stripeMocker.createPayout({ amount: 1000, arrivalDate });
        const second = stripeMocker.createPayout({ amount: 2000, arrivalDate });

        await WebmasterReport.group('Synchroniseren uitbetalingen', async () => {
            expect(await createSync().syncPayouts({ start })).toEqual({ synced: 0, skipped: 0, failed: 2 });
        });

        // Emails of the other tests in this file can still be in the queue: only this group counts
        const emails = (await EmailMocker.transactional.getSucceededEmails()).filter(e => e.subject.startsWith('Synchroniseren uitbetalingen'));
        expect(emails).toHaveLength(1);
        expect(emails[0].html).toContain(first.id);
        expect(emails[0].html).toContain(second.id);
    });

    test('a payout that failed after being paid keeps its status current', async () => {
        const payment = await createPayment();
        const payout = stripeMocker.createPayout({ amount: 10000, arrivalDate, stripeAccount: stripeAccount.accountId });
        stripeMocker.createBalanceTransaction({
            type: 'payment',
            amount: 10000,
            created,
            payout: payout.id,
            stripeAccount: stripeAccount.accountId,
            source: stripeMocker.createChargeObject({ metadata: { payment: payment.id } }),
        });

        const sync = createConnectedSync();
        expect(await sync.syncPayouts({ start })).toEqual({ synced: 1, skipped: 0, failed: 0 });
        expect((await getSettlement(payout)).status).toBe(SettlementStatus.Paid);

        // Stripe can still flip a paid payout to failed within five business days
        payout.status = 'failed';
        expect(await sync.syncPayouts({ start })).toEqual({ synced: 0, skipped: 1, failed: 0 });
        expect((await getSettlement(payout)).status).toBe(SettlementStatus.Failed);
    });

    test('a payout with more transactions than one page is walked completely', async () => {
        const payout = stripeMocker.createPayout({ amount: -101 * 100, arrivalDate });
        for (let i = 0; i < 101; i++) {
            stripeMocker.createBalanceTransaction({
                type: 'stripe_fee',
                amount: -100,
                description: 'Billing - Usage Fee',
                created,
                payout: payout.id,
                source: null,
            });
        }

        expect(await createSync().syncPayouts({ start })).toEqual({ synced: 1, skipped: 0, failed: 0 });

        const settlement = await getSettlement(payout);
        expect(settlement.transactionCount).toBe(101);
        expect(settlement.unexplainedAmount).toBe(0);
    });

    test('a payout in another currency is refused instead of stored as euros', async () => {
        const payout = stripeMocker.createPayout({ amount: 1000, arrivalDate, currency: 'usd' });

        expect(await createSync().syncPayouts({ start })).toEqual({ synced: 0, skipped: 0, failed: 1 });
        expect(await Settlement.select().where('externalId', payout.id).first(false)).toBeNull();
    });

    test('a refunded application fee fails the payout instead of billing it in full', async () => {
        const payout = stripeMocker.createPayout({ amount: -100, arrivalDate });
        stripeMocker.createBalanceTransaction({
            type: 'application_fee_refund',
            amount: -100,
            created,
            payout: payout.id,
            source: { object: 'fee_refund', id: stripeMocker.createId('fr'), fee: 'fee_original' },
        });

        // We never refund application fees ourselves: what to give back to the organization is a
        // decision someone has to make, so the payout waits instead of silently over-billing
        expect(await createSync().syncPayouts({ start })).toEqual({ synced: 0, skipped: 0, failed: 1 });
        expect((await getSettlement(payout)).syncedAt).toBeNull();
    });

    test('account fees, reserves and disputes become their own rows', async () => {
        const payment = await createPayment();

        const payout = stripeMocker.createPayout({ amount: -3500, arrivalDate });
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

        expect(byType.get(SettlementChargeType.ProviderAccountFee)).toMatchObject({
            amount: -5_00_00,
            description: 'Billing - Usage Fee',
            providerInvoiceId: 'stripe-2026-01',
        });
        expect(byType.get(SettlementChargeType.Reserve)).toMatchObject({ amount: -10_00_00 });

        // The dispute is deducted from our balance, but the disputed payment belongs to the
        // connected organization: the cost is ours, the payment link would cross organizations
        expect(byType.get(SettlementChargeType.Adjustment)).toMatchObject({
            amount: -20_00_00,
            paymentId: null,
            organizationId: membershipOrganization.id,
        });
    });

    test('a dispute on the organization\'s own payout stays linked to its payment', async () => {
        const payment = await createPayment();

        const payout = stripeMocker.createPayout({ amount: -2000, arrivalDate, stripeAccount: stripeAccount.accountId });
        stripeMocker.createBalanceTransaction({
            type: 'adjustment',
            amount: -2000,
            created,
            payout: payout.id,
            stripeAccount: stripeAccount.accountId,
            source: { object: 'dispute', id: stripeMocker.createId('dp'), charge: stripeMocker.createChargeObject({ metadata: { payment: payment.id } }) },
        });

        expect(await createConnectedSync().syncPayouts({ start })).toEqual({ synced: 1, skipped: 0, failed: 0 });

        const settlement = await getSettlement(payout);
        const charges = await SettlementCharge.select().where('settlementId', settlement.id).fetch();
        expect(charges).toHaveLength(1);
        expect(charges[0]).toMatchObject({
            type: SettlementChargeType.Adjustment,
            amount: -20_00_00,
            paymentId: payment.id,
            organizationId: organization.id,
        });
    });

    test('re-running skips synced payouts and stays idempotent under force', async () => {
        const payment = await createPayment();
        const payout = stripeMocker.createPayout({ amount: 10000, arrivalDate, stripeAccount: stripeAccount.accountId });
        stripeMocker.createBalanceTransaction({
            type: 'payment',
            amount: 10000,
            created,
            payout: payout.id,
            stripeAccount: stripeAccount.accountId,
            source: stripeMocker.createChargeObject({ metadata: { payment: payment.id } }),
        });

        const sync = createConnectedSync();
        expect(await sync.syncPayouts({ start })).toEqual({ synced: 1, skipped: 0, failed: 0 });

        const settlement = await getSettlement(payout);
        const rowIds = (await PaymentSettlement.select().where('settlementId', settlement.id).fetch()).map(r => r.id);

        expect(await sync.syncPayouts({ start })).toEqual({ synced: 0, skipped: 1, failed: 0 });
        expect(await createConnectedSync().syncPayouts({ start, force: true })).toEqual({ synced: 1, skipped: 0, failed: 0 });

        const after = (await PaymentSettlement.select().where('settlementId', settlement.id).fetch()).map(r => r.id);
        expect(after).toEqual(rowIds);
    });

    test('a payment that moved to another payout is swept', async () => {
        const payment = await createPayment();
        const otherPayment = await createPayment({ price: 50_00_00 });
        const payout = stripeMocker.createPayout({ amount: 15000, arrivalDate, stripeAccount: stripeAccount.accountId });

        stripeMocker.createBalanceTransaction({
            type: 'payment',
            amount: 10000,
            created,
            payout: payout.id,
            stripeAccount: stripeAccount.accountId,
            source: stripeMocker.createChargeObject({ metadata: { payment: payment.id } }),
        });
        const moved = stripeMocker.createBalanceTransaction({
            type: 'payment',
            amount: 5000,
            created,
            payout: payout.id,
            stripeAccount: stripeAccount.accountId,
            source: stripeMocker.createChargeObject({ metadata: { payment: otherPayment.id } }),
        });

        const sync = createConnectedSync();
        expect(await sync.syncPayouts({ start })).toEqual({ synced: 1, skipped: 0, failed: 0 });

        const settlement = await getSettlement(payout);
        expect(await PaymentSettlement.select().where('settlementId', settlement.id).count()).toBe(2);

        // Stripe moved the second payment to a later payout
        moved.payout = stripeMocker.createId('po');
        payout.amount = 10000;

        expect(await sync.syncPayouts({ start, force: true })).toEqual({ synced: 1, skipped: 0, failed: 0 });

        const lines = await PaymentSettlement.select().where('settlementId', settlement.id).fetch();
        expect(lines).toHaveLength(1);
        expect(lines[0].paymentId).toBe(payment.id);
        expect((await getSettlement(payout)).unexplainedAmount).toBe(0);
    });

    test('an application fee that moved to another payout is only unlinked', async () => {
        const payment = await createPayment();
        const payout = stripeMocker.createPayout({ amount: 250, arrivalDate });
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
        const applicationFeeId = ((movedFee.source as StripeObject)).id;
        expect(await ApplicationFee.select().where('settlementId', settlement.id).count()).toBe(2);

        movedFee.payout = stripeMocker.createId('po');
        payout.amount = 0;

        expect(await sync.syncPayouts({ start, force: true })).toEqual({ synced: 1, skipped: 0, failed: 0 });

        // The fee rows outlive the payout: they are only unlinked, and so are the deduction
        // charges they point at (a foreign key forbids deleting those)
        const fees = await ApplicationFee.select().where('externalId', applicationFeeId).fetch();
        expect(fees).toHaveLength(2);
        for (const fee of fees) {
            expect(fee.settlementId).toBeNull();
        }
        const deductions = await SettlementCharge.select().where('applicationFeeId', applicationFeeId).fetch();
        expect(deductions).toHaveLength(2);
        for (const row of deductions) {
            expect(row.settlementId).toBeNull();
        }

        const after = await getSettlement(payout);
        expect(after.unexplainedAmount).toBe(0);
        expect(after.pendingFees).toBe(0);
    });

    describe('Payers we can no longer reach', () => {
        /**
         * A platform payout that only receives one application fee, plus the payout transaction.
         * The metadata defaults to a payment that no longer exists.
         */
        const createFeePayout = (account: string, metadata: Record<string, string> = {}) => {
            const payout = stripeMocker.createPayout({ amount: 250, arrivalDate });
            const fee = stripeMocker.createApplicationFee({
                amount: 250,
                account,
                originatingTransaction: stripeMocker.createChargeObject({ metadata: { payment: uuidv4(), serviceFee: '30', ...metadata } }),
            });
            stripeMocker.createBalanceTransaction({ type: 'application_fee', amount: 250, created, payout: payout.id, source: fee });
            stripeMocker.createBalanceTransaction({ type: 'payout', amount: -250, created, payout: payout.id, source: null });
            return { payout, fee };
        };

        test('a fee of an organization that no longer exists is stored as income without a payer', async () => {
            const { payout, fee } = createFeePayout(stripeMocker.createId('acct'), { organization: uuidv4() });

            expect(await createSync().syncPayouts({ start })).toEqual({ synced: 1, skipped: 0, failed: 0 });

            const settlement = await getSettlement(payout);
            const fees = await ApplicationFee.select().where('externalId', fee.id).fetch();
            expect(fees).toHaveLength(2);
            for (const row of fees) {
                expect(row.organizationId).toBe(membershipOrganization.id);
                expect(row.settlementId).toBe(settlement.id);
                expect(row.payingOrganizationId).toBeNull();
                expect(row.payingStripeAccountId).toBeNull();
                expect(row.payingPaymentId).toBeNull();
                expect(row.settlementChargeId).toBeNull();
            }

            // There is no payout of theirs left to deduct it from, but ours still adds up
            expect(await SettlementCharge.select().where('applicationFeeId', fee.id).count()).toBe(0);
            expect(settlement.unexplainedAmount).toBe(0);
            expect(settlement.pendingFees).toBe(0);
            expect(settlement.uncollectibleFees).toBe(2_50_00);
        });

        test('a fee of a Stripe account we no longer have keeps the payer of its payment', async () => {
            const payment = await createPayment();
            const { payout, fee } = createFeePayout(stripeMocker.createId('acct'), { payment: payment.id });

            expect(await createSync().syncPayouts({ start })).toEqual({ synced: 1, skipped: 0, failed: 0 });

            // The cost is still attributed to the organization, so its own export shows it
            const charges = await SettlementCharge.select().where('applicationFeeId', fee.id).fetch();
            expect(charges).toHaveLength(2);
            for (const charge of charges) {
                expect(charge.organizationId).toBe(organization.id);
                expect(charge.stripeAccountId).toBeNull();
                expect(charge.paymentId).toBe(payment.id);
            }

            const fees = await ApplicationFee.select().where('externalId', fee.id).fetch();
            for (const row of fees) {
                expect(row.payingOrganizationId).toBe(organization.id);
                expect(row.payingStripeAccountId).toBeNull();
                expect(row.payingPaymentId).toBe(payment.id);
                expect(row.settlementChargeId).not.toBeNull();
            }

            // Without the account it was deducted from, the invoicer can't bill it per account
            const settlement = await getSettlement(payout);
            expect(settlement.pendingFees).toBe(0);
            expect(settlement.uncollectibleFees).toBe(2_50_00);
            expect(settlement.unexplainedAmount).toBe(0);
        });

        test('a fee whose payment is gone falls back to the organization in our charge metadata', async () => {
            const { payout, fee } = createFeePayout(stripeMocker.createId('acct'), { organization: organization.id });

            expect(await createSync().syncPayouts({ start })).toEqual({ synced: 1, skipped: 0, failed: 0 });

            const charges = await SettlementCharge.select().where('applicationFeeId', fee.id).fetch();
            expect(charges).toHaveLength(2);
            for (const charge of charges) {
                expect(charge.organizationId).toBe(organization.id);
                expect(charge.paymentId).toBeNull();
            }

            const fees = await ApplicationFee.select().where('externalId', fee.id).fetch();
            for (const row of fees) {
                expect(row.payingOrganizationId).toBe(organization.id);
                expect(row.payingPaymentId).toBeNull();
            }

            expect((await getSettlement(payout)).uncollectibleFees).toBe(2_50_00);
        });

        test('every unattributable account is reported once, not once per fee', async () => {
            const unknownAccount = stripeMocker.createId('acct');
            createFeePayout(unknownAccount, { organization: uuidv4() });
            createFeePayout(unknownAccount, { organization: uuidv4() });

            await WebmasterReport.group('Onaanrekenbare applicatiekosten', async () => {
                expect(await createSync().syncPayouts({ start })).toEqual({ synced: 2, skipped: 0, failed: 0 });
            });

            const emails = (await EmailMocker.transactional.getSucceededEmails()).filter(e => e.subject.startsWith('Onaanrekenbare applicatiekosten'));
            expect(emails).toHaveLength(1);
            expect(emails[0].html).toContain(unknownAccount);
            expect(emails[0].subject).toContain('1 probleem');
        });

        test('a deleted Stripe account keeps its organization, its account and its payment', async () => {
            const deletedOrganization = await new OrganizationFactory({}).create();
            const deletedAccount = await stripeMocker.createStripeAccount(deletedOrganization.id);
            deletedAccount.status = 'deleted';
            await deletedAccount.save();

            // Deleting a Stripe account is a soft delete: the organization and its payments stay
            const payment = new Payment();
            payment.organizationId = deletedOrganization.id;
            payment.stripeAccountId = deletedAccount.id;
            payment.method = PaymentMethod.Bancontact;
            payment.provider = PaymentProvider.Stripe;
            payment.status = PaymentStatus.Succeeded;
            payment.type = PaymentType.Payment;
            payment.price = 100_00_00;
            payment.paidAt = created;
            await payment.save();

            const { payout, fee } = createFeePayout(deletedAccount.accountId, { payment: payment.id });

            expect(await createSync().syncPayouts({ start })).toEqual({ synced: 1, skipped: 0, failed: 0 });

            const charges = await SettlementCharge.select().where('applicationFeeId', fee.id).fetch();
            expect(charges).toHaveLength(2);
            for (const charge of charges) {
                expect(charge.organizationId).toBe(deletedOrganization.id);
                expect(charge.stripeAccountId).toBe(deletedAccount.id);
                expect(charge.paymentId).toBe(payment.id);
            }

            const fees = await ApplicationFee.select().where('externalId', fee.id).fetch();
            for (const row of fees) {
                expect(row.payingOrganizationId).toBe(deletedOrganization.id);
                expect(row.payingStripeAccountId).toBe(deletedAccount.id);
                expect(row.payingPaymentId).toBe(payment.id);
            }

            // Nothing was lost, so it is billed like any other month
            const settlement = await getSettlement(payout);
            expect(settlement.pendingFees).toBe(2_50_00);
            expect(settlement.uncollectibleFees).toBe(0);
        });

        test('an account still in our database keeps failing the payout on an unresolvable payment', async () => {
            const deletedAccount = await stripeMocker.createStripeAccount(organization.id);
            deletedAccount.status = 'deleted';
            await deletedAccount.save();

            // A deleted account is no reason to stop checking: an organization may not attach
            // another organization's payment to its fees by deleting its Stripe account first
            for (const account of [stripeAccount, deletedAccount]) {
                const { payout } = createFeePayout(account.accountId);

                expect(await createSync().syncPayouts({ start })).toEqual({ synced: 0, skipped: 0, failed: 1 });
                expect((await getSettlement(payout)).syncedAt).toBeNull();
                stripeMocker.clear();
            }
        });
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

            expect(await new StripeSettlementSync({ secretKey: STAMHOOFD.STRIPE_SECRET_KEY! }).syncPayouts({ start })).toEqual({ synced: 1, skipped: 0, failed: 0 });
            expect(await new StripeSettlementSyncRunner({ secretKey: STAMHOOFD.STRIPE_SECRET_KEY! }).syncConnectedPayouts({ start })).toMatchObject({ synced: 1, failed: 0 });

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

            // Both sides of the same fee cancel out per kind: what the organization pays is what we
            // receive
            const fees = await ApplicationFee.select().where('externalId', fee.id).fetch();
            const feeByType = new Map(fees.map(f => [f.type, f]));
            expect(feeByType.get(ApplicationFeeType.Service)!.amount + byType.get(SettlementChargeType.ApplicationFeeService)!.amount).toBe(0);
            expect(feeByType.get(ApplicationFeeType.Transfer)!.amount + byType.get(SettlementChargeType.ApplicationFeeTransfer)!.amount).toBe(0);

            // Each fee points at the deduction charge of its own kind
            expect(feeByType.get(ApplicationFeeType.Service)!.settlementChargeId).toBe(byType.get(SettlementChargeType.ApplicationFeeService)!.id);
            expect(feeByType.get(ApplicationFeeType.Transfer)!.settlementChargeId).toBe(byType.get(SettlementChargeType.ApplicationFeeTransfer)!.id);

            // The legacy blob is dual-written with the payment's own payout, never our platform one
            const updated = await Payment.getByID(payment.id);
            expect(updated!.settlement?.id).toBe(payout.id);
        });

        test('the payout of the payment\'s own account corrects the transfer fee, the platform payout does not', async () => {
            const payment = await createPayment();
            payment.transferFee = 12_34; // the upfront estimate stored at payment time
            await payment.save();

            const fee = stripeMocker.createApplicationFee({
                amount: 250,
                account: stripeAccount.accountId,
                originatingTransaction: stripeMocker.createChargeObject({ metadata: { payment: payment.id, serviceFee: '30' } }),
            });

            // The platform payout sees the destination charge gross, but must not touch the fee
            const platformPayout = stripeMocker.createPayout({ amount: 10000, arrivalDate });
            stripeMocker.createBalanceTransaction({
                type: 'charge',
                amount: 10000,
                created,
                payout: platformPayout.id,
                source: stripeMocker.createChargeObject({ metadata: { payment: payment.id } }),
            });
            stripeMocker.createBalanceTransaction({ type: 'payout', amount: -10000, created, payout: platformPayout.id, source: null });

            expect(await new StripeSettlementSync({ secretKey: STAMHOOFD.STRIPE_SECRET_KEY! }).syncPayouts({ start })).toEqual({ synced: 1, skipped: 0, failed: 0 });
            expect((await Payment.getByID(payment.id))!.transferFee).toBe(12_34);

            // The organization payout holds the payment with the application fee withheld
            const payout = stripeMocker.createPayout({ amount: 9750, arrivalDate, stripeAccount: stripeAccount.accountId });
            stripeMocker.createBalanceTransaction({
                type: 'payment',
                amount: 10000,
                fee: 250,
                fee_details: [{ type: 'application_fee', amount: 250, description: 'Application fee' }],
                created,
                payout: payout.id,
                stripeAccount: stripeAccount.accountId,
                source: stripeMocker.createChargeObject({ metadata: { payment: payment.id }, application_fee: fee }),
            });
            stripeMocker.createBalanceTransaction({ type: 'payout', amount: -9750, created, payout: payout.id, stripeAccount: stripeAccount.accountId, source: null });

            expect(await new StripeSettlementSyncRunner({ secretKey: STAMHOOFD.STRIPE_SECRET_KEY! }).syncConnectedPayouts({ start })).toMatchObject({ synced: 1, failed: 0 });
            expect((await Payment.getByID(payment.id))!.transferFee).toBe(2_50_00);
        });

        test('an amount-mismatched charge does not correct the transfer fee', async () => {
            const payment = await createPayment({ price: 100_00_00 });
            payment.transferFee = 12_34;
            await payment.save();

            // The charge covers only half the payment's price, so its fees can't be attributed
            const payout = stripeMocker.createPayout({ amount: 4975, arrivalDate, stripeAccount: stripeAccount.accountId });
            stripeMocker.createBalanceTransaction({
                type: 'payment',
                amount: 5000,
                fee: 25,
                fee_details: [{ type: 'stripe_fee', amount: 25, description: 'Stripe processing fees' }],
                created,
                payout: payout.id,
                stripeAccount: stripeAccount.accountId,
                source: stripeMocker.createChargeObject({ metadata: { payment: payment.id } }),
            });
            stripeMocker.createBalanceTransaction({ type: 'payout', amount: -4975, created, payout: payout.id, stripeAccount: stripeAccount.accountId, source: null });

            expect(await new StripeSettlementSyncRunner({ secretKey: STAMHOOFD.STRIPE_SECRET_KEY! }).syncConnectedPayouts({ start })).toMatchObject({ synced: 1, failed: 0 });
            expect((await Payment.getByID(payment.id))!.transferFee).toBe(12_34);
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

            const result = await new StripeSettlementSync({ secretKey: STAMHOOFD.STRIPE_SECRET_KEY!, stripeAccount }).syncPayouts({ start });
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

            const result = await new StripeSettlementSyncRunner({ secretKey: STAMHOOFD.STRIPE_SECRET_KEY! }).syncConnectedPayouts({ start });
            expect(result.failed).toBe(1);

            const settlement = await getSettlement(payout);
            expect(settlement.syncedAt).toBeNull();
        });
    });
});
