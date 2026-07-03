import type { PatchableArrayAutoEncoder } from '@simonbackx/simple-encoding';
import { PatchableArray } from '@simonbackx/simple-encoding';
import { Request } from '@simonbackx/simple-endpoints';
import type { Organization, Token } from '@stamhoofd/models';
import { BalanceItem, BalanceItemFactory, BalanceItemPayment, MolliePayment, Order, OrganizationFactory, Payment, WebshopFactory } from '@stamhoofd/models';
import { BalanceItemDetailed, BalanceItemPaymentDetailed, Company, OrderData, OrderStatus, PaymentCustomer, PaymentGeneral, PaymentMethod, PaymentProvider, PaymentStatus, PaymentType, Version } from '@stamhoofd/structures';
import { STExpect } from '@stamhoofd/test-utils';
import type { MollieMockPayment } from '../../../../../tests/helpers/MollieMocker.js';
import { MollieMocker } from '../../../../../tests/helpers/MollieMocker.js';
import { testServer } from '../../../../../tests/helpers/TestServer.js';
import { initAdmin } from '../../../../../tests/init/index.js';
import { PatchPaymentsEndpoint } from './PatchPaymentsEndpoint.js';

describe('Endpoint.PatchPaymentsEndpoint', () => {
    const endpoint = new PatchPaymentsEndpoint();
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
     * Put a new payment (e.g. a refund) via the patch endpoint and return the created payment
     */
    const post = async (body: PaymentGeneral, organization: Organization, token: Token) => {
        const arr: PatchableArrayAutoEncoder<PaymentGeneral> = new PatchableArray();
        arr.addPut(body);

        const request = Request.buildJson('PATCH', `/v${Version}/organization/payments`, organization.getApiHost(), arr);
        request.headers.authorization = 'Bearer ' + token.accessToken;
        const response = await testServer.test(endpoint, request);
        return { body: response.body[0] };
    };

    /**
     * Create an organization with a Mollie token, an admin, a paid balance item and a succeeded
     * Mollie payment for that balance item (including the linked mock payment at 'Mollie').
     */
    const init = async ({ price = 50_0000 }: { price?: number } = {}) => {
        const organization = await new OrganizationFactory({}).create();
        await mollieMocker.setupToken(organization);
        const { admin, adminToken } = await initAdmin({ organization });

        const balanceItem = await new BalanceItemFactory({
            organizationId: organization.id,
            amount: 1,
            unitPrice: price,
            pricePaid: price,
        }).create();

        const { payment, mockPayment } = await createMolliePayment({ organization, balanceItems: new Map([[balanceItem, price]]) });

        return { organization, admin, adminToken, balanceItem, payment, mockPayment };
    };

    const createMolliePayment = async ({ organization, balanceItems }: { organization: Organization; balanceItems: Map<BalanceItem, number> }) => {
        const price = [...balanceItems.values()].reduce((total, p) => total + p, 0);

        const payment = new Payment();
        payment.organizationId = organization.id;
        payment.method = PaymentMethod.Bancontact;
        payment.provider = PaymentProvider.Mollie;
        payment.status = PaymentStatus.Succeeded;
        payment.type = PaymentType.Payment;
        payment.price = price;
        payment.paidAt = new Date();
        await payment.save();

        for (const [balanceItem, itemPrice] of balanceItems) {
            const balanceItemPayment = new BalanceItemPayment();
            balanceItemPayment.balanceItemId = balanceItem.id;
            balanceItemPayment.paymentId = payment.id;
            balanceItemPayment.organizationId = organization.id;
            balanceItemPayment.price = itemPrice;
            await balanceItemPayment.save();
        }

        // Register the payment at 'Mollie'
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

        return { payment, mockPayment };
    };

    const buildRefund = ({ sourcePayment, items }: { sourcePayment: Payment; items: Map<BalanceItem, number> }) => {
        return PaymentGeneral.create({
            type: PaymentType.Refund,
            method: PaymentMethod.Bancontact,
            reversingPaymentId: sourcePayment.id,
            balanceItemPayments: [...items.entries()].map(([balanceItem, price]) => BalanceItemPaymentDetailed.create({
                balanceItem: BalanceItemDetailed.create({ ...balanceItem }),
                price,
            })),
        });
    };

    test('Can fully refund a Mollie payment: the refund stays pending until Mollie executes it', async () => {
        const { organization, adminToken, balanceItem, payment } = await init();

        const body = buildRefund({ sourcePayment: payment, items: new Map([[balanceItem, -50_0000]]) });
        const response = await post(body, organization, adminToken);

        // Mollie still has to execute the refund (it can fail until then), so it is pending
        expect(response.body).toMatchObject({
            type: PaymentType.Refund,
            price: -50_0000,
            status: PaymentStatus.Pending,
            method: PaymentMethod.Bancontact,
            provider: PaymentProvider.Mollie,
            reversingPaymentId: payment.id,
        });

        // A refund has been created at Mollie
        expect(mollieMocker.refunds).toHaveLength(1);
        expect(mollieMocker.refunds[0].amount.value).toBe('50.00');

        // The refund is linked to the Mollie refund id, so the cron won't register it twice
        const link = await MolliePayment.select().where('mollieId', mollieMocker.refunds[0].id).first(false);
        expect(link).not.toBeNull();
        expect(link!.paymentId).toBe(response.body.id);

        // The source payment tracks the pending refund amount, nothing is refunded yet
        let updatedSource = await Payment.getByID(payment.id);
        expect(updatedSource!.refundedAmount).toBe(0);
        expect(updatedSource!.pendingRefundAmount).toBe(-50_0000);

        // The balance item is still paid while the refund is pending
        let updatedItem = await BalanceItem.getByID(balanceItem.id);
        expect(updatedItem!.pricePaid).toBe(50_0000);
        expect(updatedItem!.pricePending).toBe(-50_0000);

        // Mollie executes the refund and calls the webhook of the original payment
        await mollieMocker.settleRefund();

        const updatedRefund = await Payment.getByID(response.body.id);
        expect(updatedRefund!.status).toBe(PaymentStatus.Succeeded);

        updatedSource = await Payment.getByID(payment.id);
        expect(updatedSource!.refundedAmount).toBe(-50_0000);
        expect(updatedSource!.pendingRefundAmount).toBe(0);

        // The balance item is no longer marked as paid
        updatedItem = await BalanceItem.getByID(balanceItem.id);
        expect(updatedItem!.pricePaid).toBe(0);
        expect(updatedItem!.pricePending).toBe(0);
    });

    test('A pending refund that fails at Mollie is marked as failed and restores the refundable amount', async () => {
        const { organization, adminToken, balanceItem, payment } = await init();

        const body = buildRefund({ sourcePayment: payment, items: new Map([[balanceItem, -50_0000]]) });
        const response = await post(body, organization, adminToken);
        expect(response.body.status).toBe(PaymentStatus.Pending);

        // While the refund is pending, a second refund is blocked
        const blocked = buildRefund({ sourcePayment: payment, items: new Map([[balanceItem, -10_0000]]) });
        await expect(post(blocked, organization, adminToken)).rejects.toThrow(
            STExpect.simpleError({ code: 'refund_amount_too_high' }),
        );

        // Mollie could not execute the refund (e.g. the bank refused it)
        await mollieMocker.failRefund();

        const updatedRefund = await Payment.getByID(response.body.id);
        expect(updatedRefund!.status).toBe(PaymentStatus.Failed);

        // Nothing was refunded: the balance item stays paid and the full amount is refundable again
        const updatedSource = await Payment.getByID(payment.id);
        expect(updatedSource!.refundedAmount).toBe(0);
        expect(updatedSource!.pendingRefundAmount).toBe(0);

        const updatedItem = await BalanceItem.getByID(balanceItem.id);
        expect(updatedItem!.pricePaid).toBe(50_0000);
        expect(updatedItem!.pricePending).toBe(0);

        // A new refund of the full amount is possible again
        const retry = buildRefund({ sourcePayment: payment, items: new Map([[balanceItem, -50_0000]]) });
        const retryResponse = await post(retry, organization, adminToken);
        expect(retryResponse.body.price).toBe(-50_0000);
    });

    test('Can partially refund a Mollie payment with different balance items', async () => {
        const { organization, adminToken, payment } = await init();

        // The refunded balance item differs from the balance item of the source payment
        const otherBalanceItem = await new BalanceItemFactory({
            organizationId: organization.id,
            amount: 1,
            unitPrice: 20_0000,
        }).create();

        const body = buildRefund({ sourcePayment: payment, items: new Map([[otherBalanceItem, -20_0000]]) });
        const response = await post(body, organization, adminToken);

        expect(response.body.price).toBe(-20_0000);
        expect(mollieMocker.refunds).toHaveLength(1);
        expect(mollieMocker.refunds[0].amount.value).toBe('20.00');

        // Mollie executes the refund
        await mollieMocker.settleRefund();

        const updatedSource = await Payment.getByID(payment.id);
        expect(updatedSource!.refundedAmount).toBe(-20_0000);

        // The refunded item only has this (negative) refund payment linked
        const updatedItem = await BalanceItem.getByID(otherBalanceItem.id);
        expect(updatedItem!.pricePaid).toBe(-20_0000);
    });

    test('Cannot refund more than the price of the source payment', async () => {
        const { organization, adminToken, balanceItem, payment } = await init();

        // Allow a negative balance item price of -60 by increasing the due price
        balanceItem.unitPrice = 60_0000;
        await balanceItem.save();

        const body = buildRefund({ sourcePayment: payment, items: new Map([[balanceItem, -60_0000]]) });

        await expect(post(body, organization, adminToken)).rejects.toThrow(
            STExpect.simpleError({ code: 'refund_amount_too_high' }),
        );
        expect(mollieMocker.refunds).toHaveLength(0);
    });

    test('Earlier refunds reduce the remaining refundable amount', async () => {
        const { organization, adminToken, balanceItem, payment } = await init();

        const first = buildRefund({ sourcePayment: payment, items: new Map([[balanceItem, -40_0000]]) });
        await post(first, organization, adminToken);

        const second = buildRefund({ sourcePayment: payment, items: new Map([[balanceItem, -20_0000]]) });
        await expect(post(second, organization, adminToken)).rejects.toThrow(
            STExpect.simpleError({ code: 'refund_amount_too_high' }),
        );

        // Only the first refund reached Mollie
        expect(mollieMocker.refunds).toHaveLength(1);

        // A refund of the remaining 10 euro is still possible
        const third = buildRefund({ sourcePayment: payment, items: new Map([[balanceItem, -10_0000]]) });
        const response = await post(third, organization, adminToken);
        expect(response.body.price).toBe(-10_0000);

        // Both refunds are still pending at Mollie
        const updatedSource = await Payment.getByID(payment.id);
        expect(updatedSource!.refundedAmount).toBe(0);
        expect(updatedSource!.pendingRefundAmount).toBe(-50_0000);
    });

    test('A refund refused by Mollie is not registered', async () => {
        const { organization, adminToken, balanceItem, payment, mockPayment } = await init();

        // Mollie only knows about 30 euro (e.g. a refund was already created in the Mollie dashboard),
        // so our local check passes but Mollie refuses
        mockPayment.amount.value = '30.00';

        const body = buildRefund({ sourcePayment: payment, items: new Map([[balanceItem, -50_0000]]) });

        await expect(post(body, organization, adminToken)).rejects.toThrow(
            STExpect.simpleError({ code: 'refund_failed' }),
        );

        // The created refund payment has been cleaned up again
        const refunds = await Payment.select().where('reversingPaymentId', payment.id).fetch();
        expect(refunds).toHaveLength(0);

        const updatedSource = await Payment.getByID(payment.id);
        expect(updatedSource!.refundedAmount).toBe(0);
        expect(updatedSource!.pendingRefundAmount).toBe(0);

        const updatedItem = await BalanceItem.getByID(balanceItem.id);
        expect(updatedItem!.pricePaid).toBe(50_0000);
    });

    test('Cannot refund a payment that was not paid online via Mollie', async () => {
        const { organization, adminToken, balanceItem } = await init();

        const transferPayment = new Payment();
        transferPayment.organizationId = organization.id;
        transferPayment.method = PaymentMethod.Transfer;
        transferPayment.status = PaymentStatus.Succeeded;
        transferPayment.type = PaymentType.Payment;
        transferPayment.price = 50_0000;
        transferPayment.paidAt = new Date();
        await transferPayment.save();

        const body = buildRefund({ sourcePayment: transferPayment, items: new Map([[balanceItem, -50_0000]]) });

        await expect(post(body, organization, adminToken)).rejects.toThrow(
            STExpect.simpleError({ code: 'refund_not_supported' }),
        );
    });

    test('Can refund a payment with a discount: items can be positive if the total is negative', async () => {
        // A payment of 20 euro: 100 euro minus a discount of 80 euro (2 balance items)
        const organization = await new OrganizationFactory({}).create();
        await mollieMocker.setupToken(organization);
        const { adminToken } = await initAdmin({ organization });

        const item = await new BalanceItemFactory({
            organizationId: organization.id,
            amount: 1,
            unitPrice: 100_0000,
            pricePaid: 100_0000,
        }).create();

        const discount = await new BalanceItemFactory({
            organizationId: organization.id,
            amount: 1,
            unitPrice: -80_0000,
            pricePaid: -80_0000,
        }).create();

        const { payment } = await createMolliePayment({
            organization,
            balanceItems: new Map([[item, 100_0000], [discount, -80_0000]]),
        });

        // Reverse both items: the discount item gets a positive price in the refund
        const body = buildRefund({ sourcePayment: payment, items: new Map([[item, -100_0000], [discount, 80_0000]]) });
        const response = await post(body, organization, adminToken);

        expect(response.body.price).toBe(-20_0000);
        expect(mollieMocker.refunds).toHaveLength(1);
        expect(mollieMocker.refunds[0].amount.value).toBe('20.00');

        // Mollie executes the refund
        await mollieMocker.settleRefund();

        const updatedSource = await Payment.getByID(payment.id);
        expect(updatedSource!.refundedAmount).toBe(-20_0000);

        const updatedItem = await BalanceItem.getByID(item.id);
        expect(updatedItem!.pricePaid).toBe(0);

        const updatedDiscount = await BalanceItem.getByID(discount.id);
        expect(updatedDiscount!.pricePaid).toBe(0);
    });

    test('The total of a refund cannot be positive or zero', async () => {
        const { organization, adminToken, balanceItem, payment } = await init();

        const body = buildRefund({ sourcePayment: payment, items: new Map([[balanceItem, 10_0000]]) });

        await expect(post(body, organization, adminToken)).rejects.toThrow(
            STExpect.simpleError({ code: 'invalid_field', field: 'price' }),
        );
    });

    test('The refund reuses the customer of the source payment, so the VAT number cannot change', async () => {
        const { organization, adminToken, balanceItem, payment } = await init();

        payment.customer = PaymentCustomer.create({
            firstName: 'Original',
            lastName: 'Customer',
            email: 'original@example.com',
            company: Company.create({
                name: 'Original Company',
                VATNumber: 'BE0428759497',
            }),
        });
        await payment.save();

        const body = buildRefund({ sourcePayment: payment, items: new Map([[balanceItem, -50_0000]]) });

        // A (changed) customer in the body is ignored: the customer of the source payment wins
        body.customer = PaymentCustomer.create({
            firstName: 'Changed',
            lastName: 'Customer',
            email: 'changed@example.com',
            company: Company.create({
                name: 'Changed Company',
                VATNumber: 'BE0417497106',
            }),
        });

        const response = await post(body, organization, adminToken);
        expect(response.body.customer?.company?.VATNumber).toBe('BE0428759497');
        expect(response.body.customer?.company?.name).toBe('Original Company');

        const refund = await Payment.getByID(response.body.id);
        expect(refund!.customer?.company?.VATNumber).toBe('BE0428759497');
    });

    test('The customer of the request is used when the source payment has no customer', async () => {
        const { organization, adminToken, balanceItem, payment } = await init();

        const body = buildRefund({ sourcePayment: payment, items: new Map([[balanceItem, -50_0000]]) });
        body.customer = PaymentCustomer.create({
            firstName: 'Fallback',
            lastName: 'Customer',
            email: 'fallback@example.com',
            company: Company.create({
                name: 'Fallback Company',
                VATNumber: 'BE0417497106',
            }),
        });

        const response = await post(body, organization, adminToken);
        expect(response.body.customer?.company?.VATNumber).toBe('BE0417497106');
    });

    test('A put without a source payment is a manual payment and cannot use an online method', async () => {
        const { organization, adminToken, balanceItem, payment } = await init();

        const body = buildRefund({ sourcePayment: payment, items: new Map([[balanceItem, -50_0000]]) });
        body.reversingPaymentId = null;

        await expect(post(body, organization, adminToken)).rejects.toThrow(
            STExpect.simpleError({ code: 'invalid_field', field: 'method' }),
        );
        expect(mollieMocker.refunds).toHaveLength(0);
    });

    test('Only refunds can reverse another payment', async () => {
        const { organization, adminToken, balanceItem, payment } = await init();

        const body = buildRefund({ sourcePayment: payment, items: new Map([[balanceItem, -50_0000]]) });
        body.type = PaymentType.Payment;

        await expect(post(body, organization, adminToken)).rejects.toThrow(
            STExpect.simpleError({ code: 'invalid_field', field: 'type' }),
        );
        expect(mollieMocker.refunds).toHaveLength(0);
    });

    test('A refund for the balance item of an order bumps the updatedAt of the order', async () => {
        // Clients keep a local copy of all orders (offline support) and only pull in orders with
        // a newer updatedAt: every payment change of an order has to bump it
        const { organization, adminToken, balanceItem, payment } = await init();

        const webshop = await new WebshopFactory({ organizationId: organization.id }).create();
        const order = new Order();
        order.organizationId = organization.id;
        order.webshopId = webshop.id;
        order.data = OrderData.create({});
        order.number = 1;
        order.validAt = new Date();
        await order.save();

        balanceItem.orderId = order.id;
        await balanceItem.save();

        const updatedAtBefore = (await Order.getByID(order.id))!.updatedAt;

        // updatedAt has second precision: make sure the bump is measurable
        await new Promise(resolve => setTimeout(resolve, 1100));

        const body = buildRefund({ sourcePayment: payment, items: new Map([[balanceItem, -50_0000]]) });
        await post(body, organization, adminToken);

        // The (pending) refund immediately bumps the order
        let updatedOrder = await Order.getByID(order.id);
        expect(updatedOrder!.updatedAt.getTime()).toBeGreaterThan(updatedAtBefore.getTime());

        // The refund fails at Mollie: the order is bumped again (and stays valid)
        const updatedAtPending = updatedOrder!.updatedAt;
        await new Promise(resolve => setTimeout(resolve, 1100));
        await mollieMocker.failRefund();

        updatedOrder = await Order.getByID(order.id);
        expect(updatedOrder!.updatedAt.getTime()).toBeGreaterThan(updatedAtPending.getTime());
        expect(updatedOrder!.status).not.toBe(OrderStatus.Deleted);
    });
});
