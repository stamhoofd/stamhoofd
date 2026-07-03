import type { Organization } from '@stamhoofd/models';
import { BalanceItem, BalanceItemFactory, BalanceItemPayment, MolliePayment, OrganizationFactory, Payment } from '@stamhoofd/models';
import { PaymentMethod, PaymentProvider, PaymentStatus, PaymentType } from '@stamhoofd/structures';
import type { MollieMockPayment } from '../../tests/helpers/MollieMocker.js';
import { MollieMocker } from '../../tests/helpers/MollieMocker.js';
import { MollieService } from '../services/MollieService.js';
import { checkMollieRefundsFor, MOLLIE_REFUNDS_MINIMUM_DATE } from './mollie-refunds.js';

describe('Cron.mollie-refunds', () => {
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
     * Create an organization with a Mollie token and a succeeded Mollie payment
     * for the given balance item prices.
     */
    const init = async ({ prices = [50_0000] }: { prices?: number[] } = {}) => {
        const organization = await new OrganizationFactory({}).create();
        await mollieMocker.setupToken(organization);

        const balanceItems: BalanceItem[] = [];
        let price = 0;
        for (const itemPrice of prices) {
            balanceItems.push(await new BalanceItemFactory({
                organizationId: organization.id,
                amount: 1,
                unitPrice: itemPrice,
                pricePaid: itemPrice,
            }).create());
            price += itemPrice;
        }

        const payment = new Payment();
        payment.organizationId = organization.id;
        payment.method = PaymentMethod.Bancontact;
        payment.provider = PaymentProvider.Mollie;
        payment.status = PaymentStatus.Succeeded;
        payment.type = PaymentType.Payment;
        payment.price = price;
        payment.paidAt = new Date();
        await payment.save();

        for (const [index, balanceItem] of balanceItems.entries()) {
            const balanceItemPayment = new BalanceItemPayment();
            balanceItemPayment.balanceItemId = balanceItem.id;
            balanceItemPayment.paymentId = payment.id;
            balanceItemPayment.organizationId = organization.id;
            balanceItemPayment.price = prices[index];
            await balanceItemPayment.save();
        }

        const mockPayment: MollieMockPayment = {
            id: mollieMocker.createId('tr'),
            status: 'paid',
            amount: { currency: 'EUR', value: (Math.round(price / 100) / 100).toFixed(2) },
            internalPaymentId: payment.id,
            redirectUrl: null,
            sequenceType: 'oneoff',
            customerId: null,
            mandateId: null,
            isCancelable: false,
            details: null,
        };
        mollieMocker.payments.push(mockPayment);

        const molliePayment = new MolliePayment();
        molliePayment.paymentId = payment.id;
        molliePayment.mollieId = mockPayment.id;
        await molliePayment.save();

        return { organization, balanceItems, payment, mockPayment };
    };

    const runCron = async (organization: Organization) => {
        const service = await MollieService.create({ sellingOrganization: organization });
        expect(service).not.toBeNull();
        await checkMollieRefundsFor(service!, false);
    };

    const getRefundPayments = async (payment: Payment) => {
        return await Payment.select().where('reversingPaymentId', payment.id).fetch();
    };

    test('A refund created in the Mollie dashboard is registered pending and reconciled once executed', async () => {
        const { organization, balanceItems, payment, mockPayment } = await init();

        const mockRefund = mollieMocker.createRefund(mockPayment);
        await runCron(organization);

        // Mollie still has to execute the refund, so it is registered as pending
        const refunds = await getRefundPayments(payment);
        expect(refunds).toHaveLength(1);
        expect(refunds[0]).toMatchObject({
            type: PaymentType.Refund,
            price: -50_0000,
            status: PaymentStatus.Pending,
            method: PaymentMethod.Bancontact,
            provider: PaymentProvider.Mollie,
        });

        // Linked so it won't get registered twice
        const link = await MolliePayment.select().where('mollieId', mockRefund.id).first(false);
        expect(link).not.toBeNull();
        expect(link!.paymentId).toBe(refunds[0].id);

        // Running the cron again does not create a duplicate
        await runCron(organization);
        expect(await getRefundPayments(payment)).toHaveLength(1);

        // Nothing is refunded yet
        let updatedSource = await Payment.getByID(payment.id);
        expect(updatedSource!.refundedAmount).toBe(0);
        expect(updatedSource!.pendingRefundAmount).toBe(-50_0000);

        // Mollie executes the refund: the next cron run marks it as succeeded
        mockRefund.status = 'refunded';
        await runCron(organization);

        const updatedRefund = await Payment.getByID(refunds[0].id);
        expect(updatedRefund!.status).toBe(PaymentStatus.Succeeded);

        // The source payment tracks the refunded amount and the balance item is no longer paid
        updatedSource = await Payment.getByID(payment.id);
        expect(updatedSource!.refundedAmount).toBe(-50_0000);
        expect(updatedSource!.pendingRefundAmount).toBe(0);

        const updatedItem = await BalanceItem.getByID(balanceItems[0].id);
        expect(updatedItem!.pricePaid).toBe(0);
    });

    test('A pending refund that fails at Mollie is marked as failed by the cron', async () => {
        const { organization, balanceItems, payment, mockPayment } = await init();

        const mockRefund = mollieMocker.createRefund(mockPayment);
        await runCron(organization);

        const refunds = await getRefundPayments(payment);
        expect(refunds).toHaveLength(1);
        expect(refunds[0].status).toBe(PaymentStatus.Pending);

        // The refund failed at Mollie (e.g. the bank refused the transfer)
        mockRefund.status = 'failed';
        await runCron(organization);

        const updatedRefund = await Payment.getByID(refunds[0].id);
        expect(updatedRefund!.status).toBe(PaymentStatus.Failed);

        // Nothing was refunded: the balance item stays paid and the amount is refundable again
        const updatedSource = await Payment.getByID(payment.id);
        expect(updatedSource!.refundedAmount).toBe(0);
        expect(updatedSource!.pendingRefundAmount).toBe(0);

        const updatedItem = await BalanceItem.getByID(balanceItems[0].id);
        expect(updatedItem!.pricePaid).toBe(50_0000);
    });

    test('A refund with a missing link is relinked via its metadata instead of registered twice', async () => {
        const { organization, payment, mockPayment } = await init();

        // A local refund payment that was created via the refund endpoint, but saving the
        // Mollie link failed afterwards
        const localRefund = new Payment();
        localRefund.organizationId = organization.id;
        localRefund.method = PaymentMethod.Bancontact;
        localRefund.provider = PaymentProvider.Mollie;
        localRefund.status = PaymentStatus.Pending;
        localRefund.type = PaymentType.Refund;
        localRefund.price = -10_0000;
        localRefund.reversingPaymentId = payment.id;
        await localRefund.save();

        const mockRefund = mollieMocker.createRefund(mockPayment, {
            value: '10.00',
            status: 'refunded',
            metadata: { refundPaymentId: localRefund.id },
        });

        await runCron(organization);

        // No duplicate refund payment was registered
        const refunds = await getRefundPayments(payment);
        expect(refunds).toHaveLength(1);
        expect(refunds[0].id).toBe(localRefund.id);

        // The link was restored and the status reconciled
        const link = await MolliePayment.select().where('mollieId', mockRefund.id).first(false);
        expect(link).not.toBeNull();
        expect(link!.paymentId).toBe(localRefund.id);

        const updatedRefund = await Payment.getByID(localRefund.id);
        expect(updatedRefund!.status).toBe(PaymentStatus.Succeeded);
    });

    test('A partial refund is allocated across the balance items of the payment', async () => {
        const { organization, balanceItems, payment, mockPayment } = await init({ prices: [30_0000, 20_0000] });

        mollieMocker.createRefund(mockPayment, { value: '40.00', status: 'refunded' });
        await runCron(organization);

        const refunds = await getRefundPayments(payment);
        expect(refunds).toHaveLength(1);
        expect(refunds[0].price).toBe(-40_0000);
        expect(refunds[0].status).toBe(PaymentStatus.Succeeded);

        const refundItems = await BalanceItemPayment.select().where('paymentId', refunds[0].id).fetch();
        expect(refundItems).toHaveLength(2);

        // The allocation order over the balance items is not deterministic: only check that
        // every item stays within what was paid for it and that the total matches
        const first = refundItems.find(i => i.balanceItemId === balanceItems[0].id);
        const second = refundItems.find(i => i.balanceItemId === balanceItems[1].id);
        expect(first!.price + second!.price).toBe(-40_0000);
        expect(first!.price).toBeGreaterThanOrEqual(-30_0000);
        expect(first!.price).toBeLessThan(0);
        expect(second!.price).toBeGreaterThanOrEqual(-20_0000);
        expect(second!.price).toBeLessThan(0);
    });

    test('Multiple refunds cannot exceed the payment amount', async () => {
        const { organization, payment, mockPayment } = await init();

        mollieMocker.createRefund(mockPayment, { value: '40.00', status: 'refunded' });
        await runCron(organization);
        expect(await getRefundPayments(payment)).toHaveLength(1);

        // A second refund that exceeds the remainder is skipped (the error is logged)
        mollieMocker.createRefund(mockPayment, { value: '20.00', status: 'refunded' });
        await runCron(organization);
        expect(await getRefundPayments(payment)).toHaveLength(1);

        // A second refund within the remainder is registered
        mollieMocker.createRefund(mockPayment, { value: '10.00', status: 'refunded' });
        await runCron(organization);

        const refunds = await getRefundPayments(payment);
        expect(refunds).toHaveLength(2);

        const updatedSource = await Payment.getByID(payment.id);
        expect(updatedSource!.refundedAmount).toBe(-50_0000);
    });

    test('Refunds created before the minimum date are ignored', async () => {
        const { organization, payment, mockPayment } = await init();

        mollieMocker.createRefund(mockPayment, {
            createdAt: new Date(MOLLIE_REFUNDS_MINIMUM_DATE.getTime() - 1000 * 60 * 60 * 24),
        });
        await runCron(organization);

        expect(await getRefundPayments(payment)).toHaveLength(0);
    });

    test('Canceled and failed refunds are ignored', async () => {
        const { organization, payment, mockPayment } = await init();

        mollieMocker.createRefund(mockPayment, { value: '10.00', status: 'canceled' });
        mollieMocker.createRefund(mockPayment, { value: '10.00', status: 'failed' });
        await runCron(organization);

        expect(await getRefundPayments(payment)).toHaveLength(0);
    });

    test('An already linked refund does not block older unhandled refunds', async () => {
        const { organization, payment, mockPayment } = await init();

        // An older refund created in the Mollie dashboard (unhandled)
        mollieMocker.createRefund(mockPayment, {
            value: '10.00',
            createdAt: new Date(Date.now() - 1000 * 60 * 60),
        });

        // A newer refund that was already registered (e.g. created via the refund endpoint):
        // its Mollie refund id is linked to a refund payment
        const handled = mollieMocker.createRefund(mockPayment, { value: '5.00' });

        const handledRefundPayment = new Payment();
        handledRefundPayment.organizationId = organization.id;
        handledRefundPayment.method = PaymentMethod.Bancontact;
        handledRefundPayment.provider = PaymentProvider.Mollie;
        handledRefundPayment.status = PaymentStatus.Succeeded;
        handledRefundPayment.type = PaymentType.Refund;
        handledRefundPayment.price = -5_0000;
        handledRefundPayment.paidAt = new Date();
        await handledRefundPayment.save();

        const existingLink = new MolliePayment();
        existingLink.paymentId = handledRefundPayment.id;
        existingLink.mollieId = handled.id;
        await existingLink.save();

        await runCron(organization);

        // Only the unhandled (older) refund was registered
        const refunds = await getRefundPayments(payment);
        expect(refunds).toHaveLength(1);
        expect(refunds[0].price).toBe(-10_0000);
    });
});
