import type { Organization } from '@stamhoofd/models';
import { BalanceItem, BalanceItemPayment, OrganizationFactory, Payment, StripeAccount } from '@stamhoofd/models';
import { ApplicationFee } from '@stamhoofd/models/models/ApplicationFee.js';
import { PaymentSettlement } from '@stamhoofd/models/models/PaymentSettlement.js';
import type { Settlement as SettlementModel } from '@stamhoofd/models/models/Settlement.js';
import { Settlement } from '@stamhoofd/models/models/Settlement.js';
import { SettlementCharge } from '@stamhoofd/models/models/SettlementCharge.js';
import { BalanceItemStatus, BalanceItemType, PaymentMethod, PaymentProvider, PaymentStatus, SettlementReference } from '@stamhoofd/structures';
import { ApplicationFeeType } from '@stamhoofd/structures/settlements/ApplicationFeeType.js';
import { SettlementChargeType } from '@stamhoofd/structures/settlements/SettlementChargeType.js';
import { v4 as uuidv4 } from 'uuid';
import { ReportedRows, SettlementService } from './SettlementService.js';

describe('SettlementService', () => {
    let organization: Organization;
    let stripeAccount: StripeAccount;

    beforeAll(async () => {
        organization = await new OrganizationFactory({}).create();
        stripeAccount = await createStripeAccount();
    });

    async function createPayment(price = 50_00_00, method = PaymentMethod.Bancontact, organizationId = organization.id) {
        const payment = new Payment();
        payment.organizationId = organizationId;
        payment.method = method;
        payment.provider = PaymentProvider.Stripe;
        payment.status = PaymentStatus.Succeeded;
        payment.price = price;
        payment.paidAt = new Date();
        await payment.save();
        return payment;
    }

    async function createStripeAccount(organizationId = organization.id) {
        const account = new StripeAccount();
        account.organizationId = organizationId;
        account.accountId = 'acct_' + uuidv4();
        await account.save();
        return account;
    }

    /**
     * A fee with its deduction charge, as the sync stores them.
     */
    async function createApplicationFee({ amount = 1_00_00, type = ApplicationFeeType.Service, settlement = null as SettlementModel | null, balanceItemId = null as string | null, occurredAt = new Date(2026, 0, 14), payingOrganizationId = organization.id, payingStripeAccountId = null as string | null } = {}) {
        const externalId = 'fee_' + uuidv4();
        const charge = await SettlementService.upsertCharge({
            type: type === ApplicationFeeType.Service ? SettlementChargeType.ApplicationFeeService : SettlementChargeType.ApplicationFeeTransfer,
            externalId: externalId + ':' + type,
            amount: -amount,
            applicationFeeId: externalId,
            organizationId: payingOrganizationId,
            occurredAt,
        });

        const fee = new ApplicationFee();
        fee.externalId = externalId;
        fee.type = type;
        fee.amount = amount;
        fee.organizationId = organization.id;
        fee.payingOrganizationId = payingOrganizationId;
        fee.payingStripeAccountId = payingStripeAccountId ?? stripeAccount.id;
        fee.settlementChargeId = charge.id;
        fee.settlementId = settlement?.id ?? null;
        fee.balanceItemId = balanceItemId;
        fee.occurredAt = occurredAt;
        await fee.save();
        return { fee, charge };
    }

    /**
     * A fee the invoicer will never bill: its payer is gone, so there is no payout of theirs to
     * deduct it from either.
     */
    async function createUncollectibleApplicationFee({ amount = 1_00_00, settlement = null as SettlementModel | null, occurredAt = new Date(2026, 0, 14) } = {}) {
        const fee = new ApplicationFee();
        fee.externalId = 'fee_' + uuidv4();
        fee.type = ApplicationFeeType.Service;
        fee.amount = amount;
        fee.organizationId = organization.id;
        fee.settlementId = settlement?.id ?? null;
        fee.occurredAt = occurredAt;
        await fee.save();
        return fee;
    }

    /**
     * A fee payment with one balance item, like the invoicer creates.
     */
    async function createFeePayment(price = 2_00_00) {
        const payment = await createPayment(price, PaymentMethod.AccountDeductions);

        const balanceItem = new BalanceItem();
        balanceItem.type = BalanceItemType.ServiceFee;
        balanceItem.organizationId = organization.id;
        balanceItem.payingOrganizationId = organization.id;
        balanceItem.unitPrice = price;
        balanceItem.quantity = 1;
        balanceItem.status = BalanceItemStatus.Hidden;
        await balanceItem.save();

        const balanceItemPayment = new BalanceItemPayment();
        balanceItemPayment.balanceItemId = balanceItem.id;
        balanceItemPayment.paymentId = payment.id;
        balanceItemPayment.organizationId = organization.id;
        balanceItemPayment.price = price;
        await balanceItemPayment.save();

        return { payment, balanceItem };
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
        test('idempotent per (settlement, externalId)', async () => {
            const payment = await createPayment();
            const settlement = await SettlementService.upsertSettlement(settlementData());

            const line = await SettlementService.upsertPaymentLine(settlement, {
                paymentId: payment.id,
                amount: 50_00_00,
                externalId: 'txn_1',
                occurredAt: new Date(2026, 0, 14),
            });
            const again = await SettlementService.upsertPaymentLine(settlement, {
                paymentId: payment.id,
                amount: 51_00_00,
                externalId: 'txn_1',
                occurredAt: new Date(2026, 0, 14),
            });

            expect(again.id).toBe(line.id);
            expect(again.amount).toBe(51_00_00);
            expect(await PaymentSettlement.select().where('paymentId', payment.id).count()).toBe(1);
        });

        test('a transaction that moved to another payout leaves nothing behind', async () => {
            const payment = await createPayment();
            const from = await SettlementService.upsertSettlement(settlementData({ amount: 50_00_00 }));
            const to = await SettlementService.upsertSettlement(settlementData({ amount: 50_00_00 }));

            await SettlementService.upsertPaymentLine(from, {
                paymentId: payment.id,
                amount: 50_00_00,
                externalId: 'txn_moved',
                occurredAt: new Date(2026, 0, 14),
            });
            await SettlementService.finishSync(from, { transactionCount: 1 });
            expect(from.unexplainedAmount).toBe(0);

            // Stripe reports the same transaction in a later payout: counting it in both would
            // settle the payment twice
            await SettlementService.upsertPaymentLine(to, {
                paymentId: payment.id,
                amount: 50_00_00,
                externalId: 'txn_moved',
                occurredAt: new Date(2026, 0, 20),
            });

            const lines = await PaymentSettlement.select().where('paymentId', payment.id).fetch();
            expect(lines).toHaveLength(1);
            expect(lines[0].settlementId).toBe(to.id);

            // The payout it left is recomputed right away, instead of waiting for its next walk
            expect((await Settlement.getByID(from.id))!.unexplainedAmount).toBe(50_00_00);
        });

        test('the line is stored on the organization of the payout', async () => {
            const otherOrganization = await new OrganizationFactory({}).create();
            const payment = await createPayment(50_00_00, PaymentMethod.Bancontact, otherOrganization.id);
            const settlement = await SettlementService.upsertSettlement(settlementData({ organizationId: otherOrganization.id }));

            const line = await SettlementService.upsertPaymentLine(settlement, {
                paymentId: payment.id,
                amount: 50_00_00,
                externalId: 'txn_organization',
                occurredAt: new Date(2026, 0, 14),
            });

            expect(line.organizationId).toBe(otherOrganization.id);
            expect((await PaymentSettlement.getByID(line.id))!.organizationId).toBe(otherOrganization.id);
        });
    });

    describe('upsertCharge', () => {
        test('idempotent by externalId, and undefined fields keep their stored value', async () => {
            const settlement = await SettlementService.upsertSettlement(settlementData());
            const externalId = 'fee_' + uuidv4() + ':ApplicationFeeService';

            const created = await SettlementService.upsertCharge({
                type: SettlementChargeType.ApplicationFeeService,
                externalId,
                amount: -1_00_00,
                settlementId: settlement.id,
                applicationFeeId: 'fee_123',
                organizationId: organization.id,
                occurredAt: new Date(2026, 0, 14),
            });

            // The fee walk doesn't know the settlement: it may not unlink the row
            const updated = await SettlementService.upsertCharge({
                type: SettlementChargeType.ApplicationFeeService,
                externalId,
                amount: -1_10_00,
                organizationId: organization.id,
                occurredAt: new Date(2026, 0, 14),
            });

            expect(updated.id).toBe(created.id);
            expect(updated.amount).toBe(-1_10_00);
            expect(updated.settlementId).toBe(settlement.id);
            expect(updated.applicationFeeId).toBe('fee_123');

            // An explicit null does clear the link
            const cleared = await SettlementService.upsertCharge({
                type: SettlementChargeType.ApplicationFeeService,
                externalId,
                amount: -1_10_00,
                settlementId: null,
                organizationId: organization.id,
                occurredAt: new Date(2026, 0, 14),
            });
            expect(cleared.settlementId).toBe(null);
        });
    });

    describe('sweepSettlement', () => {
        test('deletes payout-only rows, but unlinks what outlives the payout', async () => {
            const payment = await createPayment();
            const settlement = await SettlementService.upsertSettlement(settlementData());

            const keptLine = await SettlementService.upsertPaymentLine(settlement, {
                paymentId: payment.id, amount: 50_00_00, externalId: 'txn_kept', occurredAt: new Date(2026, 0, 14),
            });
            const movedLine = await SettlementService.upsertPaymentLine(settlement, {
                paymentId: payment.id, amount: 10_00_00, externalId: 'txn_moved', occurredAt: new Date(2026, 0, 14),
            });

            // A derived fee line is never reported by a walk: it belongs to the fee payment
            const derivedLine = await SettlementService.upsertPaymentLine(settlement, {
                paymentId: payment.id, amount: 2_00_00, externalId: null, occurredAt: new Date(2026, 0, 14),
            });

            const { fee, charge: referencedCharge } = await createApplicationFee({ settlement });
            const providerFee = await SettlementService.upsertCharge({
                type: SettlementChargeType.ProviderTransactionFee,
                externalId: 'txn_moved:fee:0',
                amount: -30_00,
                settlementId: settlement.id,
                organizationId: organization.id,
                occurredAt: new Date(2026, 0, 14),
            });
            const keptFee = await SettlementService.upsertCharge({
                type: SettlementChargeType.ProviderTransactionFee,
                externalId: 'txn_kept:fee:0',
                amount: -25_00,
                settlementId: settlement.id,
                organizationId: organization.id,
                occurredAt: new Date(2026, 0, 14),
            });

            // The deduction charge is linked to this settlement too, but no longer reported
            referencedCharge.settlementId = settlement.id;
            await referencedCharge.save();

            const reported = new ReportedRows();
            reported.paymentLine(keptLine);
            reported.charge(keptFee);
            const { unlinkedFees } = await SettlementService.sweepSettlement(settlement, reported);

            expect(await PaymentSettlement.getByID(keptLine.id)).toBeDefined();
            expect(await PaymentSettlement.getByID(movedLine.id)).toBeUndefined();
            expect(await PaymentSettlement.getByID(derivedLine.id)).toBeDefined();
            expect(await SettlementCharge.getByID(providerFee.id)).toBeUndefined();
            expect((await SettlementCharge.getByID(keptFee.id))?.settlementId).toBe(settlement.id);

            // A charge an application fee points at may never be deleted (foreign key), only unlinked
            const unlinkedCharge = await SettlementCharge.getByID(referencedCharge.id);
            expect(unlinkedCharge).toBeDefined();
            expect(unlinkedCharge!.settlementId).toBe(null);

            expect(unlinkedFees.map(f => f.id)).toEqual([fee.id]);
            expect((await ApplicationFee.getByID(fee.id))!.settlementId).toBe(null);
        });

        test('keeps the application fees the walk reported', async () => {
            const settlement = await SettlementService.upsertSettlement(settlementData());
            const { fee } = await createApplicationFee({ settlement });

            const reported = new ReportedRows();
            reported.applicationFee(fee);
            const { unlinkedFees } = await SettlementService.sweepSettlement(settlement, reported);

            expect(unlinkedFees).toHaveLength(0);
            expect((await ApplicationFee.getByID(fee.id))!.settlementId).toBe(settlement.id);
        });
    });

    describe('updatePaymentSettlementsForAccountDeductionPayment', () => {
        test('one line per payout, summing the fees it contained', async () => {
            const { payment, balanceItem } = await createFeePayment(3_25_00);
            const first = await SettlementService.upsertSettlement(settlementData({ settledAt: new Date(2026, 0, 10) }));
            const second = await SettlementService.upsertSettlement(settlementData({ settledAt: new Date(2026, 0, 20) }));

            await createApplicationFee({ settlement: first, balanceItemId: balanceItem.id, amount: 1_00_00, occurredAt: new Date(2026, 0, 5) });
            await createApplicationFee({ settlement: first, balanceItemId: balanceItem.id, amount: 50_00, occurredAt: new Date(2026, 0, 8) });
            await createApplicationFee({ settlement: second, balanceItemId: balanceItem.id, amount: 1_50_00, occurredAt: new Date(2026, 0, 15) });

            // A fee that isn't paid out yet doesn't produce a line
            const { fee: pending } = await createApplicationFee({ balanceItemId: balanceItem.id, amount: 25_00 });

            await SettlementService.updatePaymentSettlementsForAccountDeductionPayment(payment);

            const lines = await PaymentSettlement.select().where('paymentId', payment.id).fetch();
            expect(lines).toHaveLength(2);
            expect(lines.every(line => line.externalId === null)).toBe(true);

            const bySettlement = new Map(lines.map(line => [line.settlementId, line]));
            expect(bySettlement.get(first.id)!.amount).toBe(1_50_00);
            expect(bySettlement.get(first.id)!.occurredAt).toEqual(new Date(2026, 0, 8));
            expect(bySettlement.get(second.id)!.amount).toBe(1_50_00);

            // Not settled completely yet: the lines don't add up to the payment price
            expect(lines.reduce((total, line) => total + line.amount, 0)).not.toBe(payment.price);

            // Paying out the last fee completes the payment
            pending.settlementId = second.id;
            await pending.save();
            await SettlementService.updatePaymentSettlementsForAccountDeductionPayment(payment);

            const completed = await PaymentSettlement.select().where('paymentId', payment.id).fetch();
            expect(completed.reduce((total, line) => total + line.amount, 0)).toBe(payment.price);
        });

        test('every fee payment keeps its own line in the same payout', async () => {
            const settlement = await SettlementService.upsertSettlement(settlementData());
            const first = await createFeePayment(1_00_00);
            const second = await createFeePayment(2_00_00);
            await createApplicationFee({ settlement, balanceItemId: first.balanceItem.id, amount: 1_00_00 });
            await createApplicationFee({ settlement, balanceItemId: second.balanceItem.id, amount: 2_00_00 });

            await SettlementService.updatePaymentSettlementsForAccountDeductionPayment(first.payment);
            await SettlementService.updatePaymentSettlementsForAccountDeductionPayment(second.payment);
            // Re-running may not duplicate: the lines have no externalId to upsert on
            await SettlementService.updatePaymentSettlementsForAccountDeductionPayment(first.payment);

            const lines = await PaymentSettlement.select().where('settlementId', settlement.id).fetch();
            expect(lines).toHaveLength(2);
            expect(lines.find(line => line.paymentId === first.payment.id)!.amount).toBe(1_00_00);
            expect(lines.find(line => line.paymentId === second.payment.id)!.amount).toBe(2_00_00);
        });

        test('a line disappears again when its fees are unlinked from the payout', async () => {
            const { payment, balanceItem } = await createFeePayment(1_00_00);
            const settlement = await SettlementService.upsertSettlement(settlementData());
            const { fee } = await createApplicationFee({ settlement, balanceItemId: balanceItem.id, amount: 1_00_00 });

            await SettlementService.updatePaymentSettlementsForAccountDeductionPayment(payment);
            expect(await PaymentSettlement.select().where('paymentId', payment.id).count()).toBe(1);

            fee.settlementId = null;
            await fee.save();
            await SettlementService.updatePaymentSettlementsForAccountDeductionPayment(payment);

            expect(await PaymentSettlement.select().where('paymentId', payment.id).count()).toBe(0);
        });

        test('other payment methods are left alone', async () => {
            const payment = await createPayment();
            await SettlementService.updatePaymentSettlementsForAccountDeductionPayment(payment);
            expect(await PaymentSettlement.select().where('paymentId', payment.id).count()).toBe(0);
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
                organizationId: organization.id,
                occurredAt: new Date(2026, 0, 14),
            });

            await SettlementService.finishSync(settlement, { transactionCount: 2 });

            // 48.70 - (50.00 - 1.00) = -0.30 unexplained
            expect(settlement.unexplainedAmount).toBe(-30_00);
            expect(settlement.pendingFees).toBe(0);
            expect(settlement.transactionCount).toBe(2);
            expect(settlement.syncedAt).not.toBe(null);
            expect(settlement.syncFailureCount).toBe(0);
        });

        test('fees waiting to be invoiced explain the payout until their payment does', async () => {
            const settlement = await SettlementService.upsertSettlement(settlementData({ amount: 1_00_00 }));
            const { fee } = await createApplicationFee({ settlement, amount: 1_00_00 });

            await SettlementService.finishSync(settlement, { transactionCount: 1 });
            expect(settlement.pendingFees).toBe(1_00_00);
            expect(settlement.unexplainedAmount).toBe(0);

            // Once invoiced, the fee payment's derived line explains it instead: counting both
            // would explain the same money twice. Nothing re-syncs a healthy payout, so the cached
            // columns have to follow the line right away
            const { payment, balanceItem } = await createFeePayment(1_00_00);
            fee.balanceItemId = balanceItem.id;
            await fee.save();
            await SettlementService.updatePaymentSettlementsForAccountDeductionPayment(payment);

            const invoiced = await Settlement.getByID(settlement.id);
            expect(invoiced!.pendingFees).toBe(0);
            expect(invoiced!.unexplainedAmount).toBe(0);
        });

        test('a payout that loses its derived line has the fee pending again', async () => {
            const settlement = await SettlementService.upsertSettlement(settlementData({ amount: 1_00_00 }));
            const { payment, balanceItem } = await createFeePayment(1_00_00);
            const { fee } = await createApplicationFee({ settlement, balanceItemId: balanceItem.id, amount: 1_00_00 });

            await SettlementService.updatePaymentSettlementsForAccountDeductionPayment(payment);
            await SettlementService.finishSync(settlement, { transactionCount: 1 });
            expect(settlement.pendingFees).toBe(0);
            expect(settlement.unexplainedAmount).toBe(0);

            // The payout no longer contains the fee: its line goes, and so does what it explained
            fee.settlementId = null;
            await fee.save();
            await SettlementService.updatePaymentSettlementsForAccountDeductionPayment(payment);

            const unlinked = await Settlement.getByID(settlement.id);
            expect(unlinked!.pendingFees).toBe(0);
            expect(unlinked!.unexplainedAmount).toBe(1_00_00);
        });

        test('fees the invoicer will never bill explain the payout without ever being invoiced', async () => {
            const settlement = await SettlementService.upsertSettlement(settlementData({ amount: 3_00_00 }));
            await createApplicationFee({ settlement, amount: 1_00_00 });
            await createUncollectibleApplicationFee({ settlement, amount: 1_00_00 });

            // A payer we know, but not the account the fee was deducted from: the invoicer skips it
            const accountless = await createApplicationFee({ settlement, amount: 1_00_00 });
            accountless.fee.payingStripeAccountId = null;
            await accountless.fee.save();

            await SettlementService.finishSync(settlement, { transactionCount: 3 });

            // Only the fee that can still be billed is worth waiting for
            expect(settlement.pendingFees).toBe(1_00_00);
            expect(settlement.uncollectibleFees).toBe(2_00_00);
            expect(settlement.unexplainedAmount).toBe(0);
        });
    });

    describe('getApplicationFeeSettlementIdsForPayingOrganization', () => {
        test('deleting the paying organization keeps its fees as uncollectible income', async () => {
            const payer = await new OrganizationFactory({}).create();
            const payerAccount = await createStripeAccount(payer.id);
            const settlement = await SettlementService.upsertSettlement(settlementData({ amount: 1_00_00 }));
            const { fee, charge } = await createApplicationFee({ settlement, amount: 1_00_00, payingOrganizationId: payer.id, payingStripeAccountId: payerAccount.id });

            // An organization that took Stripe payments is the only kind that owes fees: its
            // payments reference the account the delete has to cascade through
            const payerPayment = await createPayment(10_00_00, PaymentMethod.Bancontact, payer.id);
            payerPayment.stripeAccountId = payerAccount.id;
            await payerPayment.save();

            await SettlementService.finishSync(settlement, { transactionCount: 1 });
            expect(settlement.pendingFees).toBe(1_00_00);

            const settlementIds = await SettlementService.getApplicationFeeSettlementIdsForPayingOrganization(payer.id);
            expect(settlementIds).toEqual([settlement.id]);

            await payer.delete();
            await SettlementService.refreshTotalsForIds(settlementIds);

            // The deduction charge went with the organization; the fee itself is our income and stays
            expect(await SettlementCharge.getByID(charge.id)).toBeUndefined();
            const stored = await ApplicationFee.getByID(fee.id);
            expect(stored).toBeDefined();
            expect(stored!.payingOrganizationId).toBeNull();
            expect(stored!.settlementChargeId).toBeNull();

            const after = await Settlement.getByID(settlement.id);
            expect(after!.pendingFees).toBe(0);
            expect(after!.uncollectibleFees).toBe(1_00_00);
            expect(after!.unexplainedAmount).toBe(0);
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

            // A historically stored blob that still carries a fee
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

        test('a payout of another organization is never the payment\'s payout', async () => {
            const stripeAccount = await createStripeAccount();
            const payment = await createPayment();
            payment.stripeAccountId = stripeAccount.id;
            await payment.save();

            const otherOrganization = await new OrganizationFactory({}).create();
            const foreignPayout = await SettlementService.upsertSettlement(settlementData({ organizationId: otherOrganization.id, settledAt: new Date(2026, 0, 10) }));
            const organizationPayout = await SettlementService.upsertSettlement(settlementData({ stripeAccountId: stripeAccount.id, settledAt: new Date(2026, 0, 15) }));

            await SettlementService.upsertPaymentLine(foreignPayout, {
                paymentId: payment.id, amount: 50_00_00, externalId: 'txn_foreign', occurredAt: new Date(2026, 0, 9),
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
