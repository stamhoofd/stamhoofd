import type { Organization } from '@stamhoofd/models';
import { OrganizationFactory, Payment, StripeAccount } from '@stamhoofd/models';
import { PaymentSettlement } from '@stamhoofd/models/models/PaymentSettlement.js';
import { Settlement } from '@stamhoofd/models/models/Settlement.js';
import { SettlementCharge } from '@stamhoofd/models/models/SettlementCharge.js';
import { PaymentMethod, PaymentProvider, PaymentStatus, SettlementReference } from '@stamhoofd/structures';
import { SettlementChargeType } from '@stamhoofd/structures/settlements/SettlementChargeType.js';
import { v4 as uuidv4 } from 'uuid';
import { ReportedRows, SettlementService } from './SettlementService.js';

describe('SettlementService', () => {
    let organization: Organization;

    beforeAll(async () => {
        organization = await new OrganizationFactory({}).create();
    });

    async function createPayment(price = 50_00_00) {
        const payment = new Payment();
        payment.organizationId = organization.id;
        payment.method = PaymentMethod.Bancontact;
        payment.provider = PaymentProvider.Stripe;
        payment.status = PaymentStatus.Succeeded;
        payment.price = price;
        payment.paidAt = new Date();
        await payment.save();
        return payment;
    }

    function settlementData(overrides: Partial<Parameters<typeof SettlementService.upsertSettlement>[0]> = {}) {
        return {
            provider: PaymentProvider.Stripe,
            externalId: 'po_' + uuidv4(),
            organizationId: organization.id,
            amount: 370_00_00,
            reference: 'STRIPE PAYOUT',
            settledAt: new Date(2026, 0, 15),
            ...overrides,
        };
    }

    describe('upsertSettlement', () => {
        test('re-running updates the same row instead of duplicating', async () => {
            const data = settlementData();
            const created = await SettlementService.upsertSettlement(data);

            const updated = await SettlementService.upsertSettlement({ ...data, amount: 400_00_00 });

            expect(updated.id).toBe(created.id);
            expect(updated.amount).toBe(400_00_00);
            expect(await Settlement.select().where('externalId', data.externalId).count()).toBe(1);
        });

        test('the same externalId of a different provider is a different settlement', async () => {
            const externalId = 'shared_' + uuidv4();
            const stripe = await SettlementService.upsertSettlement(settlementData({ externalId }));
            const mollie = await SettlementService.upsertSettlement(settlementData({ externalId, provider: PaymentProvider.Mollie }));

            expect(mollie.id).not.toBe(stripe.id);
        });

        test('undefined optional fields keep their stored value', async () => {
            const data = settlementData({ stripeAccountId: null });
            const created = await SettlementService.upsertSettlement(data);
            expect(created.organizationId).toBe(organization.id);

            const updated = await SettlementService.upsertSettlement({
                provider: data.provider,
                externalId: data.externalId,
                organizationId: organization.id,
                amount: data.amount,
                settledAt: data.settledAt,
            });
            expect(updated.stripeAccountId).toBe(null);
            expect(updated.reference).toBe('STRIPE PAYOUT');
        });
    });

    describe('upsertPaymentLine', () => {
        test('idempotent per (settlement, externalId), but the same transaction can sit in another settlement', async () => {
            const payment = await createPayment();
            const s1 = await SettlementService.upsertSettlement(settlementData());
            const s2 = await SettlementService.upsertSettlement(settlementData());

            const line = await SettlementService.upsertPaymentLine(s1, {
                paymentId: payment.id,
                amount: 50_00_00,
                externalId: 'txn_1',
                occurredAt: new Date(2026, 0, 14),
            });
            const again = await SettlementService.upsertPaymentLine(s1, {
                paymentId: payment.id,
                amount: 51_00_00,
                externalId: 'txn_1',
                occurredAt: new Date(2026, 0, 14),
            });
            const other = await SettlementService.upsertPaymentLine(s2, {
                paymentId: payment.id,
                amount: -20_00_00,
                externalId: 'txn_1',
                occurredAt: new Date(2026, 0, 20),
            });

            expect(again.id).toBe(line.id);
            expect(again.amount).toBe(51_00_00);
            expect(other.id).not.toBe(line.id);
            expect(await PaymentSettlement.select().where('paymentId', payment.id).count()).toBe(2);
        });
    });

    describe('upsertCharge', () => {
        test('idempotent by externalId, and undefined fields keep their stored value', async () => {
            const settlement = await SettlementService.upsertSettlement(settlementData());
            const externalId = 'fee_' + uuidv4() + ':ReceivedApplicationFeeService';

            const created = await SettlementService.upsertCharge({
                type: SettlementChargeType.ReceivedApplicationFeeService,
                externalId,
                amount: 1_00_00,
                settlementId: settlement.id,
                applicationFeeId: 'fee_123',
                occurredAt: new Date(2026, 0, 14),
            });

            // The fee sync doesn't know the settlement: it may not unlink the row
            const updated = await SettlementService.upsertCharge({
                type: SettlementChargeType.ReceivedApplicationFeeService,
                externalId,
                amount: 1_10_00,
                occurredAt: new Date(2026, 0, 14),
            });

            expect(updated.id).toBe(created.id);
            expect(updated.amount).toBe(1_10_00);
            expect(updated.settlementId).toBe(settlement.id);
            expect(updated.applicationFeeId).toBe('fee_123');

            // An explicit null does clear the link
            const cleared = await SettlementService.upsertCharge({
                type: SettlementChargeType.ReceivedApplicationFeeService,
                externalId,
                amount: 1_10_00,
                settlementId: null,
                occurredAt: new Date(2026, 0, 14),
            });
            expect(cleared.settlementId).toBe(null);
        });
    });

    describe('sweepSettlement', () => {
        test('deletes payout-only rows, but only unlinks the Received fee rows', async () => {
            const payment = await createPayment();
            const settlement = await SettlementService.upsertSettlement(settlementData());

            const keptLine = await SettlementService.upsertPaymentLine(settlement, {
                paymentId: payment.id, amount: 50_00_00, externalId: 'txn_kept', occurredAt: new Date(2026, 0, 14),
            });
            const movedLine = await SettlementService.upsertPaymentLine(settlement, {
                paymentId: payment.id, amount: 10_00_00, externalId: 'txn_moved', occurredAt: new Date(2026, 0, 14),
            });
            const received = await SettlementService.upsertCharge({
                type: SettlementChargeType.ReceivedApplicationFeeService,
                externalId: 'fee_' + uuidv4() + ':ReceivedApplicationFeeService',
                amount: 1_00_00,
                settlementId: settlement.id,
                occurredAt: new Date(2026, 0, 14),
            });
            const providerFee = await SettlementService.upsertCharge({
                type: SettlementChargeType.ProviderTransactionFee,
                externalId: 'txn_moved:fee:0',
                amount: -30_00,
                settlementId: settlement.id,
                occurredAt: new Date(2026, 0, 14),
            });
            const keptFee = await SettlementService.upsertCharge({
                type: SettlementChargeType.ProviderTransactionFee,
                externalId: 'txn_kept:fee:0',
                amount: -25_00,
                settlementId: settlement.id,
                occurredAt: new Date(2026, 0, 14),
            });

            const reported = new ReportedRows();
            reported.paymentLine(keptLine);
            reported.charge(keptFee);
            await SettlementService.sweepSettlement(settlement, reported);

            expect(await PaymentSettlement.getByID(keptLine.id)).toBeDefined();
            expect(await PaymentSettlement.getByID(movedLine.id)).toBeUndefined();
            expect(await SettlementCharge.getByID(providerFee.id)).toBeUndefined();
            expect((await SettlementCharge.getByID(keptFee.id))?.settlementId).toBe(settlement.id);

            const unlinked = await SettlementCharge.getByID(received.id);
            expect(unlinked).toBeDefined();
            expect(unlinked!.settlementId).toBe(null);
        });
    });

    describe('finishSync and markSyncFailed', () => {
        test('finishSync caches the reconciliation delta and resets the failure count', async () => {
            const payment = await createPayment();
            const settlement = await SettlementService.upsertSettlement(settlementData({ amount: 48_70_00 }));
            await SettlementService.markSyncFailed(settlement);
            expect(settlement.syncFailureCount).toBe(1);
            expect(settlement.syncedAt).toBe(null);

            await SettlementService.upsertPaymentLine(settlement, {
                paymentId: payment.id, amount: 50_00_00, externalId: 'txn_1', occurredAt: new Date(2026, 0, 14),
            });
            await SettlementService.upsertCharge({
                type: SettlementChargeType.ApplicationFeeService,
                externalId: 'fee_' + uuidv4() + ':ApplicationFeeService',
                amount: -1_00_00,
                settlementId: settlement.id,
                occurredAt: new Date(2026, 0, 14),
            });

            await SettlementService.finishSync(settlement, { transactionCount: 2 });

            // 48.70 - (50.00 - 1.00) = -0.30 unexplained
            expect(settlement.unexplainedAmount).toBe(-30_00);
            expect(settlement.transactionCount).toBe(2);
            expect(settlement.syncedAt).not.toBe(null);
            expect(settlement.syncFailureCount).toBe(0);
        });
    });

    describe('updateLegacySettlementReference', () => {
        test('the largest line wins and re-syncs never flip-flop the column', async () => {
            const payment = await createPayment();
            const original = await SettlementService.upsertSettlement(settlementData({ settledAt: new Date(2026, 0, 15) }));
            const refundPayout = await SettlementService.upsertSettlement(settlementData({ settledAt: new Date(2026, 0, 22) }));

            await SettlementService.upsertPaymentLine(original, {
                paymentId: payment.id, amount: 50_00_00, externalId: 'txn_pay', occurredAt: new Date(2026, 0, 14),
            });
            await SettlementService.upsertPaymentLine(refundPayout, {
                paymentId: payment.id, amount: -20_00_00, externalId: 'txn_refund', occurredAt: new Date(2026, 0, 21),
            });

            await SettlementService.updateLegacySettlementReference(payment);
            expect(payment.settlement?.id).toBe(original.externalId);
            expect(payment.settlement?.amount).toBe(original.amount);

            await SettlementService.updateLegacySettlementReference(payment);
            expect(payment.settlement?.id).toBe(original.externalId);
        });

        test('keeps the deprecated fee field when the primary settlement is unchanged', async () => {
            const payment = await createPayment();
            const settlement = await SettlementService.upsertSettlement(settlementData());
            await SettlementService.upsertPaymentLine(settlement, {
                paymentId: payment.id, amount: 50_00_00, externalId: 'txn_pay', occurredAt: new Date(2026, 0, 14),
            });

            // Written earlier by StripePayoutChecker
            payment.settlement = SettlementReference.create({
                id: settlement.externalId,
                reference: 'OLD',
                settledAt: new Date(2026, 0, 15),
                amount: 370_00_00,
                fee: 1_23_00,
            });
            await payment.save();

            await SettlementService.updateLegacySettlementReference(payment);
            expect(payment.settlement?.fee).toBe(1_23_00);

            // A different primary settlement can't invent a fee
            const bigger = await SettlementService.upsertSettlement(settlementData());
            await SettlementService.upsertPaymentLine(bigger, {
                paymentId: payment.id, amount: 60_00_00, externalId: 'txn_bigger', occurredAt: new Date(2026, 0, 20),
            });
            await SettlementService.updateLegacySettlementReference(payment);
            expect(payment.settlement?.id).toBe(bigger.externalId);
            expect(payment.settlement?.fee).toBe(0);
        });

        test('the payout of the payment\'s own account beats an equal platform payout line', async () => {
            const stripeAccount = new StripeAccount();
            stripeAccount.organizationId = organization.id;
            stripeAccount.accountId = 'acct_' + uuidv4();
            await stripeAccount.save();

            const payment = await createPayment();
            payment.stripeAccountId = stripeAccount.id;
            await payment.save();

            // A destination charge: gross in our platform payout (settles first) and gross in the
            // organization payout
            const platformPayout = await SettlementService.upsertSettlement(settlementData({ stripeAccountId: null, settledAt: new Date(2026, 0, 10) }));
            const organizationPayout = await SettlementService.upsertSettlement(settlementData({ stripeAccountId: stripeAccount.id, settledAt: new Date(2026, 0, 15) }));

            await SettlementService.upsertPaymentLine(platformPayout, {
                paymentId: payment.id, amount: 50_00_00, externalId: 'txn_platform', occurredAt: new Date(2026, 0, 9),
            });
            await SettlementService.upsertPaymentLine(organizationPayout, {
                paymentId: payment.id, amount: 50_00_00, externalId: 'txn_organization', occurredAt: new Date(2026, 0, 9),
            });

            await SettlementService.updateLegacySettlementReference(payment);
            expect(payment.settlement?.id).toBe(organizationPayout.externalId);
        });

        test('a payment without settlement rows is left untouched', async () => {
            const payment = await createPayment();
            payment.settlement = SettlementReference.create({
                id: 'legacy', reference: 'LEGACY', settledAt: new Date(2026, 0, 15), amount: 370_00_00,
            });
            await payment.save();

            await SettlementService.updateLegacySettlementReference(payment);
            expect(payment.settlement?.id).toBe('legacy');
        });
    });
});
