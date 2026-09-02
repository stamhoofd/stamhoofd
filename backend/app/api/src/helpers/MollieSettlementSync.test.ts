import type { MollieToken } from '@stamhoofd/models';
import { MolliePayment, OrganizationFactory, Payment } from '@stamhoofd/models';
import { PaymentSettlement } from '@stamhoofd/models/models/PaymentSettlement.js';
import { Settlement } from '@stamhoofd/models/models/Settlement.js';
import { SettlementCharge } from '@stamhoofd/models/models/SettlementCharge.js';
import { AbortSignal } from '@stamhoofd/queues';
import { PaymentMethod, PaymentProvider, PaymentStatus, PaymentType } from '@stamhoofd/structures';
import { SettlementChargeType } from '@stamhoofd/structures/settlements/SettlementChargeType.js';
import { STExpect } from '@stamhoofd/test-utils';
import { vi } from 'vitest';
import type { MollieMockPayment, MollieMockRefund } from '../../tests/helpers/MollieMocker.js';
import { MollieMocker } from '../../tests/helpers/MollieMocker.js';
import { SettlementService } from '../services/SettlementService.js';
import { MollieSettlementSync } from './MollieSettlementSync.js';
import type { SettlementSyncSummary } from './ProviderSettlementSyncRunner.js';

describe('Helper.MollieSettlementSync', () => {
    let mollieMocker: MollieMocker;

    beforeAll(() => {
        mollieMocker = new MollieMocker();
        mollieMocker.start();
    });

    afterAll(() => {
        mollieMocker.stop();
    });

    beforeEach(() => {
        mollieMocker.reset();
    });

    /**
     * Create an organization with a Mollie token, a succeeded Mollie payment and a Mollie refund
     * payment reversing it. Both are linked to their Mollie ids (tr_... / re_...) like the real crons do.
     */
    const init = async () => {
        const organization = await new OrganizationFactory({}).create();
        const token = await mollieMocker.setupToken(organization);

        // Source payment
        const payment = new Payment();
        payment.organizationId = organization.id;
        payment.method = PaymentMethod.Bancontact;
        payment.provider = PaymentProvider.Mollie;
        payment.status = PaymentStatus.Succeeded;
        payment.type = PaymentType.Payment;
        payment.price = 50_0000;
        payment.paidAt = new Date();
        await payment.save();

        const mockPayment: MollieMockPayment = {
            id: mollieMocker.createId('tr'),
            status: 'paid',
            amount: { currency: 'EUR', value: '50.00' },
            internalPaymentId: payment.id,
            redirectUrl: null,
            sequenceType: 'oneoff',
            customerId: null,
            mandateId: null,
            isCancelable: false,
            details: null,
        };
        mollieMocker.payments.push(mockPayment);

        const paymentLink = new MolliePayment();
        paymentLink.paymentId = payment.id;
        paymentLink.mollieId = mockPayment.id;
        await paymentLink.save();

        // Refund payment reversing the source payment
        const refundPayment = new Payment();
        refundPayment.organizationId = organization.id;
        refundPayment.method = PaymentMethod.Bancontact;
        refundPayment.provider = PaymentProvider.Mollie;
        refundPayment.status = PaymentStatus.Succeeded;
        refundPayment.type = PaymentType.Refund;
        refundPayment.price = -20_0000;
        refundPayment.reversingPaymentId = payment.id;
        refundPayment.paidAt = new Date();
        await refundPayment.save();

        const mockRefund = mollieMocker.createRefund(mockPayment, { value: '20.00', status: 'refunded' });

        const refundLink = new MolliePayment();
        refundLink.paymentId = refundPayment.id;
        refundLink.mollieId = mockRefund.id;
        await refundLink.save();

        return { organization, token, payment, refundPayment, mockPayment, mockRefund };
    };

    const runCron = async (token: MollieToken, options: { start?: Date; end?: Date; summary?: SettlementSyncSummary } = {}) => {
        await new MollieSettlementSync({ token }).syncSettlements({
            start: options.start ?? new Date(2020, 0, 1),
            end: options.end,
            summary: options.summary,
        });
    };

    /**
     * Add a Mollie chargeback payment reversing the given source payment, linked to its Mollie
     * chargeback id (chb_...) like the mollie-chargebacks cron does.
     */
    const addChargeback = async (organizationId: string, sourcePayment: Payment, mockPayment: MollieMockPayment) => {
        const chargebackPayment = new Payment();
        chargebackPayment.organizationId = organizationId;
        chargebackPayment.method = PaymentMethod.Bancontact;
        chargebackPayment.provider = PaymentProvider.Mollie;
        chargebackPayment.status = PaymentStatus.Succeeded;
        chargebackPayment.type = PaymentType.Chargeback;
        chargebackPayment.price = -sourcePayment.price;
        chargebackPayment.reversingPaymentId = sourcePayment.id;
        chargebackPayment.paidAt = new Date();
        await chargebackPayment.save();

        const mockChargeback = mollieMocker.createChargeback(mockPayment);

        const chargebackLink = new MolliePayment();
        chargebackLink.paymentId = chargebackPayment.id;
        chargebackLink.mollieId = mockChargeback.id;
        await chargebackLink.save();

        return { chargebackPayment, mockChargeback };
    };

    test('The settlement of a refund settled at Mollie is stored on the refund payment', async () => {
        const { token, payment, refundPayment, mockPayment, mockRefund } = await init();

        const settlement = mollieMocker.createSettlement({
            payments: [mockPayment],
            refunds: [mockRefund],
            value: '100.00',
        });

        await runCron(token);

        // The source payment gets the settlement metadata (existing behaviour)
        const updatedPayment = await Payment.getByID(payment.id);
        expect(updatedPayment!.settlement).toMatchObject({
            id: settlement.id,
            reference: settlement.reference,
        });

        // The refund payment gets the same settlement metadata (new behaviour)
        const updatedRefund = await Payment.getByID(refundPayment.id);
        expect(updatedRefund!.settlement).toMatchObject({
            id: settlement.id,
            reference: settlement.reference,
            amount: 100_0000,
        });
    });

    test('A refund that is not part of any settlement keeps no settlement', async () => {
        const { token, refundPayment, mockPayment } = await init();

        // A settlement that only contains the source payment, not the refund
        mollieMocker.createSettlement({ payments: [mockPayment], value: '50.00' });

        await runCron(token);

        const updatedRefund = await Payment.getByID(refundPayment.id);
        expect(updatedRefund!.settlement).toBeNull();
    });

    test('The settlement of a chargeback settled at Mollie is stored on the chargeback payment', async () => {
        const { organization, token, payment, mockPayment } = await init();
        const { chargebackPayment, mockChargeback } = await addChargeback(organization.id, payment, mockPayment);

        const settlement = mollieMocker.createSettlement({
            payments: [mockPayment],
            chargebacks: [mockChargeback],
            value: '100.00',
        });

        await runCron(token);

        const updatedChargeback = await Payment.getByID(chargebackPayment.id);
        expect(updatedChargeback!.settlement).toMatchObject({
            id: settlement.id,
            reference: settlement.reference,
            amount: 100_0000,
        });
    });

    describe('Settlement rows', () => {
        const getSettlementRow = async (externalId: string) => {
            return await Settlement.select().where('externalId', externalId).first(true);
        };

        test('legacy JSON and new rows agree, and the settlement reconciles to zero', async () => {
            const { organization, token, payment, refundPayment, mockPayment, mockRefund } = await init();

            // 50.00 - 20.00 in entries, minus a 0.30 payment fee and a 0.06 refund fee
            const settlement = mollieMocker.createSettlement({
                payments: [mockPayment],
                refunds: [mockRefund],
                value: '29.64',
            });
            mollieMocker.createBalanceTransaction({ type: 'payment', entryId: mockPayment.id, fee: '0.30', createdAt: new Date(2026, 0, 5) });

            // A transaction without the deductionDetails breakdown: its whole deduction is the fee
            mollieMocker.createBalanceTransaction({ type: 'refund', entryId: mockRefund.id, deductions: '0.06', createdAt: new Date(2026, 0, 6) });

            await runCron(token);

            const row = await getSettlementRow(settlement.id);
            expect(row).toMatchObject({
                provider: PaymentProvider.Mollie,
                organizationId: organization.id,
                reference: settlement.reference,
                amount: 29_6400,
                unexplainedAmount: 0,
            });
            expect(row.syncedAt).not.toBeNull();

            const lines = await PaymentSettlement.select().where('settlementId', row.id).fetch();
            expect(lines.map(l => [l.externalId, l.paymentId, l.amount]).sort()).toEqual([
                [mockPayment.id, payment.id, 50_0000],
                [mockRefund.id, refundPayment.id, -20_0000],
            ].sort());

            const charges = await SettlementCharge.select().where('settlementId', row.id).fetch();
            expect(charges.map(c => ({ type: c.type, amount: c.amount, paymentId: c.paymentId, occurredAt: c.occurredAt })).sort((a, b) => a.amount - b.amount)).toEqual([
                { type: SettlementChargeType.ProviderTransactionFee, amount: -30_00, paymentId: payment.id, occurredAt: new Date(2026, 0, 5) },
                { type: SettlementChargeType.ProviderTransactionFee, amount: -6_00, paymentId: refundPayment.id, occurredAt: new Date(2026, 0, 6) },
            ]);

            // Each payment holds the fee that was deducted for it
            expect((await Payment.getByID(payment.id))!.transferFee).toBe(30_00);
            expect((await Payment.getByID(refundPayment.id))!.transferFee).toBe(6_00);

            // The legacy blob agrees with the new settlement row
            const updatedPayment = await Payment.getByID(payment.id);
            expect(updatedPayment!.settlement!.id).toBe(row.externalId);
            expect(updatedPayment!.settlement!.amount).toBe(row.amount);
        });

        test('the fee of a chargeback is stored on its settlement and payment', async () => {
            const { organization, token, payment, mockPayment } = await init();
            const { chargebackPayment, mockChargeback } = await addChargeback(organization.id, payment, mockPayment);

            // 50.00 - 50.00 in entries, minus a 0.25 chargeback fee
            const settlement = mollieMocker.createSettlement({
                payments: [mockPayment],
                chargebacks: [mockChargeback],
                value: '-0.25',
            });
            mollieMocker.createBalanceTransaction({ type: 'chargeback', entryId: mockChargeback.id, fee: '0.25' });

            await runCron(token);

            const row = await getSettlementRow(settlement.id);
            expect(row.unexplainedAmount).toBe(0);

            const charges = await SettlementCharge.select().where('paymentId', chargebackPayment.id).fetch();
            expect(charges.map(c => ({ type: c.type, amount: c.amount, settlementId: c.settlementId }))).toEqual([
                { type: SettlementChargeType.ProviderTransactionFee, amount: -25_00, settlementId: row.id },
            ]);
            expect((await Payment.getByID(chargebackPayment.id))!.transferFee).toBe(25_00);
        });

        test('only the fee part of a deduction becomes a charge', async () => {
            const { token, payment, mockPayment } = await init();

            // Mollie withheld 5.30: a 0.30 fee plus a 5.00 reserve, which stays unexplained
            const settlement = mollieMocker.createSettlement({ payments: [mockPayment], value: '44.70' });
            mollieMocker.createBalanceTransaction({ type: 'payment', entryId: mockPayment.id, fee: '0.30', deductions: '5.30' });

            await runCron(token);

            const charges = await SettlementCharge.select().where('paymentId', payment.id).fetch();
            expect(charges.map(c => c.amount)).toEqual([-30_00]);
            expect((await Payment.getByID(payment.id))!.transferFee).toBe(30_00);
            expect((await getSettlementRow(settlement.id)).unexplainedAmount).toBe(-5_0000);
        });

        test('the fee of a settlement that is not stored yet is stored on a later walk', async () => {
            const { token, payment, mockPayment } = await init();
            mollieMocker.createBalanceTransaction({ type: 'payment', entryId: mockPayment.id, fee: '0.30' });

            // The transaction exists before its settlement is paid out: there is nothing to
            // attach the fee to yet
            await runCron(token);
            expect(await SettlementCharge.select().where('paymentId', payment.id).count()).toBe(0);

            const settlement = mollieMocker.createSettlement({ payments: [mockPayment], value: '49.70' });
            await runCron(token);

            const row = await getSettlementRow(settlement.id);
            expect(row.unexplainedAmount).toBe(0);
            expect(await SettlementCharge.select().where('paymentId', payment.id).count()).toBe(1);
        });

        test('re-running stores identical rows', async () => {
            const { token, mockPayment, mockRefund } = await init();
            const settlement = mollieMocker.createSettlement({ payments: [mockPayment], refunds: [mockRefund], value: '29.70' });
            mollieMocker.createBalanceTransaction({ type: 'payment', entryId: mockPayment.id, fee: '0.30' });

            await runCron(token);
            const row = await getSettlementRow(settlement.id);
            const before = (await PaymentSettlement.select().where('settlementId', row.id).fetch()).map(l => l.id).sort();
            const chargesBefore = (await SettlementCharge.select().where('settlementId', row.id).fetch()).map(c => c.id).sort();

            await runCron(token);
            const after = (await PaymentSettlement.select().where('settlementId', row.id).fetch()).map(l => l.id).sort();
            const chargesAfter = (await SettlementCharge.select().where('settlementId', row.id).fetch()).map(c => c.id).sort();
            expect(after).toEqual(before);
            expect(chargesAfter).toEqual(chargesBefore);
            expect(chargesBefore).toHaveLength(1);
            expect(await Settlement.select().where('externalId', settlement.id).count()).toBe(1);
        });
    });

    test('A settlement settled before the window start is not walked', async () => {
        const { token, mockPayment } = await init();

        // The list is newest-first: the walk must sync the recent settlement, then stop at the old one
        const oldSettlement = mollieMocker.createSettlement({ payments: [mockPayment], value: '10.00', settledAt: new Date(2019, 5, 1) });
        const recentSettlement = mollieMocker.createSettlement({ payments: [mockPayment], value: '50.00' });

        await runCron(token);

        expect(await Settlement.select().where('externalId', recentSettlement.id).count()).toBe(1);
        expect(await Settlement.select().where('externalId', oldSettlement.id).count()).toBe(0);
    });

    test('A settlement settled after the window end is skipped, older ones are still walked', async () => {
        const { token, mockPayment } = await init();

        const afterEnd = mollieMocker.createSettlement({ payments: [mockPayment], value: '50.00', settledAt: new Date(2026, 5, 1) });
        const inWindow = mollieMocker.createSettlement({ payments: [mockPayment], value: '20.00', settledAt: new Date(2026, 1, 1) });

        await runCron(token, { start: new Date(2026, 0, 1), end: new Date(2026, 2, 1) });

        expect(await Settlement.select().where('externalId', inWindow.id).count()).toBe(1);
        expect(await Settlement.select().where('externalId', afterEnd.id).count()).toBe(0);
    });

    test('The walk follows pagination until it reaches the window start', async () => {
        const { token, mockPayment } = await init();
        mollieMocker.settlementsPageSize = 2;

        // Two pages: [first, second] and [third, beforeWindow] — the third settlement only syncs
        // if the walk follows the next link, and the pre-window one proves it still stops
        const first = mollieMocker.createSettlement({ payments: [mockPayment], value: '50.00', settledAt: new Date(2026, 2, 3) });
        const second = mollieMocker.createSettlement({ payments: [mockPayment], value: '20.00', settledAt: new Date(2026, 2, 2) });
        const third = mollieMocker.createSettlement({ payments: [mockPayment], value: '10.00', settledAt: new Date(2026, 2, 1) });
        const beforeWindow = mollieMocker.createSettlement({ payments: [mockPayment], value: '5.00', settledAt: new Date(2019, 0, 1) });

        await runCron(token);

        for (const settlement of [first, second, third]) {
            expect(await Settlement.select().where('externalId', settlement.id).count()).toBe(1);
        }
        expect(await Settlement.select().where('externalId', beforeWindow.id).count()).toBe(0);
    });

    test('The fee walk follows pagination and stops before the previous payout', async () => {
        const { organization, token, payment, mockPayment, mockRefund } = await init();
        const { mockChargeback } = await addChargeback(organization.id, payment, mockPayment);
        mollieMocker.balanceTransactionsPageSize = 2;

        // Paid out before the window: the walked settlement's period starts here
        mollieMocker.createSettlement({ value: '0.00', settledAt: new Date(2019, 5, 1) });

        const settlement = mollieMocker.createSettlement({
            payments: [mockPayment],
            refunds: [mockRefund],
            chargebacks: [mockChargeback],
            value: '100.00',
        });

        // Three fee transactions across two pages, newest first
        mollieMocker.createBalanceTransaction({ type: 'payment', entryId: mockPayment.id, fee: '0.30', createdAt: new Date(2026, 2, 3) });
        mollieMocker.createBalanceTransaction({ type: 'refund', entryId: mockRefund.id, fee: '0.06', createdAt: new Date(2026, 2, 2) });
        mollieMocker.createBalanceTransaction({ type: 'chargeback', entryId: mockChargeback.id, fee: '0.25', createdAt: new Date(2026, 2, 1) });

        // Before the previous payout (minus the lookback): the walk may not reach this one
        const beforeWindow = mollieMocker.createBalanceTransaction({ type: 'payment', entryId: mockPayment.id, fee: '9.99', createdAt: new Date(2019, 0, 1) });

        await runCron(token);

        const row = await Settlement.select().where('externalId', settlement.id).first(true);
        const charges = await SettlementCharge.select().where('settlementId', row.id).fetch();
        expect(charges.map(c => c.amount).sort((a, b) => a - b)).toEqual([-30_00, -25_00, -6_00]);
        expect(charges.map(c => c.externalId)).not.toContain(beforeWindow.id);
        expect(mollieMocker.balanceTransactionRequests).toBe(2);
    });

    test('The fee walk covers the walked payouts only', async () => {
        const { token, payment, mockPayment } = await init();
        const previousPayout = new Date(2020, 5, 1);
        mollieMocker.createSettlement({ value: '0.00', settledAt: previousPayout });
        const payout = new Date(2020, 6, 1);
        mollieMocker.createSettlement({ payments: [mockPayment], value: '49.70', settledAt: payout });

        // After the payout: belongs to the open settlement
        const afterPayout = mollieMocker.createBalanceTransaction({ type: 'payment', entryId: mockPayment.id, fee: '0.01', createdAt: new Date(2020, 6, 2) });
        const inPeriod = mollieMocker.createBalanceTransaction({ type: 'payment', entryId: mockPayment.id, fee: '0.30', createdAt: new Date(2020, 5, 15) });
        // A few days before the previous payout: the payout delay is covered by the lookback
        const beforePreviousPayout = mollieMocker.createBalanceTransaction({ type: 'payment', entryId: mockPayment.id, fee: '0.02', createdAt: new Date(2020, 4, 25) });
        const longBefore = mollieMocker.createBalanceTransaction({ type: 'payment', entryId: mockPayment.id, fee: '0.03', createdAt: new Date(2020, 0, 1) });

        await runCron(token, { start: new Date(2020, 5, 15), end: new Date(2020, 7, 1) });

        const charges = await SettlementCharge.select().where('paymentId', payment.id).fetch();
        expect(charges.map(c => c.externalId).sort()).toEqual([inPeriod.id, beforePreviousPayout.id].sort());
        expect(charges.map(c => c.externalId)).not.toContain(afterPayout.id);
        expect(charges.map(c => c.externalId)).not.toContain(longBefore.id);
    });

    test('No balance transactions are fetched when no settlement was walked', async () => {
        const { token, mockPayment } = await init();
        mollieMocker.createSettlement({ payments: [mockPayment], value: '49.70', settledAt: new Date(2019, 0, 1) });
        mollieMocker.createBalanceTransaction({ type: 'payment', entryId: mockPayment.id, fee: '0.30' });

        await runCron(token);

        expect(mollieMocker.balanceTransactionRequests).toBe(0);
    });

    test('The summary counts synced settlements', async () => {
        const { token, mockPayment } = await init();
        mollieMocker.createSettlement({ payments: [mockPayment], value: '50.00' });

        const summary: SettlementSyncSummary = { feeMonths: 0, failedFeeMonths: 0, synced: 0, skipped: 0, failed: 0 };
        await runCron(token, { summary });

        expect(summary.synced).toBe(1);
        expect(summary.failed).toBe(0);
    });

    test('An interrupted walk gives up its synced state without counting a failure', async () => {
        const { token, mockPayment, mockRefund } = await init();

        const settlement = mollieMocker.createSettlement({ payments: [mockPayment], refunds: [mockRefund], value: '30.00', settledAt: new Date(2026, 2, 3) });

        await runCron(token);
        expect((await Settlement.select().where('externalId', settlement.id).first(true)).syncedAt).not.toBeNull();

        // Older, so the newest-first walk only reaches it after the one it is interrupted in
        const untouched = mollieMocker.createSettlement({ payments: [mockPayment], value: '50.00', settledAt: new Date(2026, 2, 2) });

        // Abort while the walk stores its first entry, so the settlement is only walked halfway
        const abort = new AbortSignal();
        const upsertPaymentLine = SettlementService.upsertPaymentLine.bind(SettlementService);
        const spy = vi.spyOn(SettlementService, 'upsertPaymentLine').mockImplementation(async (row, data) => {
            abort.abort();
            return await upsertPaymentLine(row, data);
        });

        const summary: SettlementSyncSummary = { feeMonths: 0, failedFeeMonths: 0, synced: 0, skipped: 0, failed: 0 };
        try {
            await expect(new MollieSettlementSync({ token }).syncSettlements({
                start: new Date(2020, 0, 1),
                summary,
                abort,
            })).rejects.toThrow(STExpect.simpleError({ code: 'queue-aborted' }));
        } finally {
            spy.mockRestore();
        }

        const row = await Settlement.select().where('externalId', settlement.id).first(true);
        expect(row.syncedAt).toBeNull();
        expect(row.syncFailureCount).toBe(0);
        expect(summary).toMatchObject({ synced: 0, failed: 0 });

        // The walk stopped at the settlement it was in: the next one was never started
        expect(await Settlement.select().where('externalId', untouched.id).count()).toBe(0);
    });

    test('An unlinked refund entry in a settlement is skipped without affecting the known refund', async () => {
        const { token, refundPayment, mockPayment, mockRefund } = await init();

        // A refund that belongs to a different system: it exists at Mollie but has no MolliePayment link
        const unlinkedRefund: MollieMockRefund = mollieMocker.createRefund(mockPayment, { value: '5.00', status: 'refunded' });

        const settlement = mollieMocker.createSettlement({
            payments: [mockPayment],
            refunds: [unlinkedRefund, mockRefund],
            value: '100.00',
        });
        const unlinkedFee = mollieMocker.createBalanceTransaction({ type: 'refund', entryId: unlinkedRefund.id, fee: '0.06' });

        await runCron(token);

        // The known refund still gets its settlement, the unlinked one and its fee are silently ignored
        const updatedRefund = await Payment.getByID(refundPayment.id);
        expect(updatedRefund!.settlement).toMatchObject({ id: settlement.id });
        expect(await SettlementCharge.select().where('externalId', unlinkedFee.id).count()).toBe(0);
    });
});
