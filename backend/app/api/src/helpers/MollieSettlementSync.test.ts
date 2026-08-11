import type { MollieToken } from '@stamhoofd/models';
import { MolliePayment, OrganizationFactory, Payment } from '@stamhoofd/models';
import { PaymentSettlement } from '@stamhoofd/models/models/PaymentSettlement.js';
import { Settlement } from '@stamhoofd/models/models/Settlement.js';
import { SettlementCharge } from '@stamhoofd/models/models/SettlementCharge.js';
import { PaymentMethod, PaymentProvider, PaymentStatus, PaymentType } from '@stamhoofd/structures';
import { SettlementChargeType } from '@stamhoofd/structures/settlements/SettlementChargeType.js';
import type { MollieMockPayment, MollieMockRefund } from '../../tests/helpers/MollieMocker.js';
import { MollieMocker } from '../../tests/helpers/MollieMocker.js';
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

            // 50.00 - 20.00 in entries, minus 0.30 costs + 0.06 VAT
            const settlement = mollieMocker.createSettlement({
                payments: [mockPayment],
                refunds: [mockRefund],
                value: '29.64',
                invoiceId: 'inv_123',
                periods: {
                    2026: {
                        '01': {
                            costs: [{
                                description: 'Bancontact betalingen',
                                method: 'bancontact',
                                amountNet: { currency: 'EUR', value: '0.30' },
                                amountVat: { currency: 'EUR', value: '0.06' },
                            }],
                        },
                    },
                },
            });

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
            expect(charges.map(c => ({ type: c.type, amount: c.amount, providerInvoiceId: c.providerInvoiceId, occurredAt: c.occurredAt })).sort((a, b) => a.amount - b.amount)).toEqual([
                { type: SettlementChargeType.ProviderTransactionFee, amount: -30_00, providerInvoiceId: 'inv_123', occurredAt: new Date(2026, 0, 1) },
                { type: SettlementChargeType.Tax, amount: -6_00, providerInvoiceId: 'inv_123', occurredAt: new Date(2026, 0, 1) },
            ]);

            // The legacy blob agrees with the new settlement row
            const updatedPayment = await Payment.getByID(payment.id);
            expect(updatedPayment!.settlement!.id).toBe(row.externalId);
            expect(updatedPayment!.settlement!.amount).toBe(row.amount);
        });

        test('the invoiceId is filled in on a later re-walk', async () => {
            const { token, mockPayment } = await init();
            const settlement = mollieMocker.createSettlement({
                payments: [mockPayment],
                value: '49.70',
                periods: {
                    2026: {
                        '01': {
                            costs: [{
                                description: 'Bancontact betalingen',
                                method: 'bancontact',
                                amountNet: { currency: 'EUR', value: '0.30' },
                                amountVat: { currency: 'EUR', value: '0.00' },
                            }],
                        },
                    },
                },
            });

            await runCron(token);
            const row = await getSettlementRow(settlement.id);
            const costs = await SettlementCharge.select().where('settlementId', row.id).fetch();
            expect(costs).toHaveLength(1);
            expect(costs[0].providerInvoiceId).toBeNull();

            // Mollie created the invoice since the last walk
            settlement.invoiceId = 'inv_later';
            await runCron(token);

            const updated = await SettlementCharge.getByID(costs[0].id);
            expect(updated!.providerInvoiceId).toBe('inv_later');
        });

        test('re-running stores identical rows', async () => {
            const { token, mockPayment, mockRefund } = await init();
            const settlement = mollieMocker.createSettlement({ payments: [mockPayment], refunds: [mockRefund], value: '30.00' });

            await runCron(token);
            const row = await getSettlementRow(settlement.id);
            const before = (await PaymentSettlement.select().where('settlementId', row.id).fetch()).map(l => l.id).sort();

            await runCron(token);
            const after = (await PaymentSettlement.select().where('settlementId', row.id).fetch()).map(l => l.id).sort();
            expect(after).toEqual(before);
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

    test('The summary counts synced settlements', async () => {
        const { token, mockPayment } = await init();
        mollieMocker.createSettlement({ payments: [mockPayment], value: '50.00' });

        const summary: SettlementSyncSummary = { feeMonths: 0, failedFeeMonths: 0, synced: 0, skipped: 0, failed: 0 };
        await runCron(token, { summary });

        expect(summary.synced).toBe(1);
        expect(summary.failed).toBe(0);
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

        await runCron(token);

        // The known refund still gets its settlement, the unlinked one is silently ignored
        const updatedRefund = await Payment.getByID(refundPayment.id);
        expect(updatedRefund!.settlement).toMatchObject({ id: settlement.id });
    });
});
