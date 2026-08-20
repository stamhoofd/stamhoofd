import type { PatchableArrayAutoEncoder } from '@simonbackx/simple-encoding';
import { PatchableArray } from '@simonbackx/simple-encoding';
import { Request } from '@simonbackx/simple-endpoints';
import type { Organization, StripeAccount, Token } from '@stamhoofd/models';
import { BalanceItem, BalanceItemFactory, BalanceItemPayment, Order, OrderFactory, OrganizationFactory, Payment, UserFactory, Webshop, WebshopFactory } from '@stamhoofd/models';
import type { OrderResponse } from '@stamhoofd/structures';
import { BalanceItemStatus, Cart, CartItem, Customer, OrderData, OrderStatus, PaymentConfiguration, PaymentMethod, PaymentStatus, PermissionLevel, Permissions, PrivateOrder, PrivatePaymentConfiguration, PrivateWebshop, Product, ProductPrice, TransferSettings, WebshopCrowdfunding, WebshopMetaData, WebshopPrivateMetaData } from '@stamhoofd/structures';
import { v4 as uuidv4 } from 'uuid';
import { SessionService } from './SessionService.js';

import type { StripeObject } from '../../tests/helpers/StripeMocker.js';
import { StripeMocker } from '../../tests/helpers/StripeMocker.js';
import { initMembershipOrganization } from '../../tests/init/initMembershipOrganization.js';
import { testServer } from '../../tests/helpers/TestServer.js';
import { PatchWebshopEndpoint } from '../endpoints/organization/dashboard/webshops/PatchWebshopEndpoint.js';
import { PatchWebshopOrdersEndpoint } from '../endpoints/organization/dashboard/webshops/PatchWebshopOrdersEndpoint.js';
import { PlaceOrderEndpoint } from '../endpoints/organization/webshops/PlaceOrderEndpoint.js';
import { BalanceItemService } from './BalanceItemService.js';
import { PaymentService } from './PaymentService.js';
import { WebshopCrowdfundingService } from './WebshopCrowdfundingService.js';

describe('WebshopCrowdfundingService', () => {
    async function createWebshop(crowdfunding: WebshopCrowdfunding | null) {
        const organization = await new OrganizationFactory({}).create();
        return await new WebshopFactory({
            organizationId: organization.id,
            meta: WebshopMetaData.patch({ crowdfunding }),
        }).create();
    }

    async function createOrderBalanceItem(order: Order, { pricePaid = 0, pricePending = 0, status = BalanceItemStatus.Due }: { pricePaid?: number; pricePending?: number; status?: BalanceItemStatus }) {
        return await new BalanceItemFactory({
            organizationId: order.organizationId,
            orderId: order.id,
            amount: 1,
            unitPrice: pricePaid + pricePending,
            pricePaid,
            pricePending,
            status,
        }).create();
    }

    async function getMeta(webshop: Webshop) {
        const updated = await Webshop.getByID(webshop.id);
        return updated!.meta;
    }

    async function createPayment(balanceItem: BalanceItem, price: number, status: PaymentStatus) {
        const payment = new Payment();
        payment.organizationId = balanceItem.organizationId;
        payment.method = PaymentMethod.Transfer;
        payment.status = status;
        payment.price = price;
        await payment.save();

        const balanceItemPayment = new BalanceItemPayment();
        balanceItemPayment.organizationId = balanceItem.organizationId;
        balanceItemPayment.paymentId = payment.id;
        balanceItemPayment.balanceItemId = balanceItem.id;
        balanceItemPayment.price = price;
        await balanceItemPayment.save();

        return payment;
    }

    test('updates the paid and pending amounts of the webshop', async () => {
        const webshop = await createWebshop(WebshopCrowdfunding.create({ goalAmount: 500_0000 }));
        const order1 = await new OrderFactory({ webshop }).create();
        const order2 = await new OrderFactory({ webshop }).create();

        await createOrderBalanceItem(order1, { pricePaid: 50_0000 });
        await createOrderBalanceItem(order2, { pricePaid: 10_0000, pricePending: 20_0000 });

        // Hidden balance items are ignored (online payments keep their balance item hidden until
        // the payment succeeds)
        await createOrderBalanceItem(order1, { pricePaid: 5_0000, pricePending: 3_0000, status: BalanceItemStatus.Hidden });

        // Balance items of other webshops are ignored
        const otherWebshop = await new WebshopFactory({ organizationId: webshop.organizationId }).create();
        const otherOrder = await new OrderFactory({ webshop: otherWebshop }).create();
        await createOrderBalanceItem(otherOrder, { pricePaid: 7_0000 });

        await WebshopCrowdfundingService.updateForWebshop(webshop.id);

        const meta = await getMeta(webshop);
        expect(meta.crowdfunding).toEqual(WebshopCrowdfunding.create({
            goalAmount: 500_0000,
            progressAmount: 60_0000,
            pendingAmount: 20_0000,
        }));
    });

    test('resets the amounts when there are no balance items', async () => {
        const webshop = await createWebshop(WebshopCrowdfunding.create({
            progressAmount: 60_0000,
            pendingAmount: 20_0000,
        }));

        await WebshopCrowdfundingService.updateForWebshop(webshop.id);

        const meta = await getMeta(webshop);
        expect(meta.crowdfunding).toEqual(WebshopCrowdfunding.create({
            goalAmount: null,
            progressAmount: 0,
            pendingAmount: 0,
        }));
    });

    test('does not calculate anything when crowdfunding is disabled', async () => {
        const webshop = await createWebshop(null);
        const order = await new OrderFactory({ webshop }).create();
        await createOrderBalanceItem(order, { pricePaid: 50_0000 });

        await WebshopCrowdfundingService.updateForWebshop(webshop.id);

        const meta = await getMeta(webshop);
        expect(meta.crowdfunding).toBeNull();
    });

    test('multiple scheduled updates result in a single update per webshop', async () => {
        const webshop = await createWebshop(WebshopCrowdfunding.create({}));
        const order1 = await new OrderFactory({ webshop }).create();
        const order2 = await new OrderFactory({ webshop }).create();
        await createOrderBalanceItem(order1, { pricePaid: 50_0000 });

        // Drain the updates scheduled by the balance item creations (via model events)
        await WebshopCrowdfundingService.flush();

        const spy = vi.spyOn(WebshopCrowdfundingService, 'updateForWebshop');
        try {
            WebshopCrowdfundingService.scheduleUpdateForOrder(order1.id);
            WebshopCrowdfundingService.scheduleUpdateForOrder(order1.id);
            WebshopCrowdfundingService.scheduleUpdateForOrder(order2.id);
            await WebshopCrowdfundingService.flush();

            expect(spy).toHaveBeenCalledOnce();
        } finally {
            spy.mockRestore();
        }

        const meta = await getMeta(webshop);
        expect(meta.crowdfunding!.progressAmount).toBe(50_0000);
    });

    test('placing an order with a balance item schedules a crowdfunding update', async () => {
        const webshop = await createWebshop(WebshopCrowdfunding.create({}));
        const order = await new OrderFactory({ webshop }).create();

        // Creating the balance item fires a model event that schedules the update
        await createOrderBalanceItem(order, { pricePaid: 30_0000, pricePending: 10_0000 });
        await WebshopCrowdfundingService.flush();

        const meta = await getMeta(webshop);
        expect(meta.crowdfunding).toEqual(WebshopCrowdfunding.create({
            progressAmount: 30_0000,
            pendingAmount: 10_0000,
        }));
    });

    test('paying an order updates the crowdfunding amounts', async () => {
        const webshop = await createWebshop(WebshopCrowdfunding.create({}));
        const order = await new OrderFactory({ webshop }).create();
        const balanceItem = await createOrderBalanceItem(order, {});
        balanceItem.unitPrice = 40_0000;
        await balanceItem.save();

        await createPayment(balanceItem, 30_0000, PaymentStatus.Succeeded);
        await createPayment(balanceItem, 10_0000, PaymentStatus.Pending);

        await BalanceItemService.updatePaidAndPending([balanceItem]);
        await WebshopCrowdfundingService.flush();

        const meta = await getMeta(webshop);
        expect(meta.crowdfunding).toEqual(WebshopCrowdfunding.create({
            progressAmount: 30_0000,
            pendingAmount: 10_0000,
        }));
    });

    test('canceling or deleting an order schedules a crowdfunding update', async () => {
        const webshop = await createWebshop(WebshopCrowdfunding.create({}));
        const order = await new OrderFactory({ webshop }).create();
        await createOrderBalanceItem(order, { pricePaid: 50_0000 });
        await WebshopCrowdfundingService.flush();

        const spy = vi.spyOn(WebshopCrowdfundingService, 'scheduleUpdateForOrder');
        try {
            // Canceling/deleting an order cancels its balance items, which schedules an update
            await BalanceItem.deleteForDeletedOrders([order.id]);
            expect(spy).toHaveBeenCalledWith(order.id);
        } finally {
            spy.mockRestore();
        }
    });

    describe('Order lifecycle', () => {
        const placeOrderEndpoint = new PlaceOrderEndpoint();
        const patchWebshopOrdersEndpoint = new PatchWebshopOrdersEndpoint();
        const patchWebshopEndpoint = new PatchWebshopEndpoint();

        let stripeMocker: StripeMocker;
        let stripeAccount: StripeAccount;
        let organization: Organization;
        let token: Token;

        const productPrice = ProductPrice.create({
            name: 'productPrice',
            price: 10_0000,
        });

        const product = Product.create({
            name: 'product',
            prices: [productPrice],
        });

        const customer = Customer.create({
            firstName: 'John',
            lastName: 'Doe',
            email: 'john@example.com',
            phone: '+32412345678',
        });

        beforeAll(async () => {
            // Required for the service fee VAT settings of online payments
            await initMembershipOrganization();

            stripeMocker = new StripeMocker();
            stripeMocker.start();
            organization = await new OrganizationFactory({}).create();
            stripeAccount = await stripeMocker.createStripeAccount(organization.id);

            const user = await new UserFactory({
                organization,
                permissions: Permissions.create({
                    level: PermissionLevel.Full,
                }),
            }).create();
            token = await SessionService.createSession(user);
        });

        afterAll(() => {
            stripeMocker.stop();
        });

        beforeEach(() => {
            stripeMocker.reset();
        });

        async function createLifecycleWebshop(crowdfunding: WebshopCrowdfunding | null = WebshopCrowdfunding.create({ goalAmount: 100_0000 })) {
            const paymentConfiguration = PaymentConfiguration.patch({
                transferSettings: TransferSettings.create({
                    iban: 'BE56587127952688', // = random IBAN
                }),
            });
            paymentConfiguration.paymentMethods.addPut(PaymentMethod.Transfer);
            paymentConfiguration.paymentMethods.addPut(PaymentMethod.Bancontact);

            return await new WebshopFactory({
                organizationId: organization.id,
                meta: WebshopMetaData.patch({
                    crowdfunding,
                    paymentConfiguration,
                }),
                privateMeta: WebshopPrivateMetaData.patch({
                    paymentConfiguration: PrivatePaymentConfiguration.patch({
                        stripeAccountId: stripeAccount.id,
                    }),
                }),
                products: [product],
            }).create();
        }

        function buildOrderData(paymentMethod: PaymentMethod) {
            return OrderData.create({
                paymentMethod,
                cart: Cart.create({
                    items: [
                        CartItem.create({
                            product,
                            productPrice,
                            amount: 1,
                        }),
                    ],
                }),
                customer,
            });
        }

        async function placeOrder(webshop: Webshop, paymentMethod: PaymentMethod) {
            const r = Request.buildJson('POST', `/webshop/${webshop.id}/order`, organization.getApiHost(), buildOrderData(paymentMethod));
            const response = await testServer.test(placeOrderEndpoint, r);
            const body = response.body as OrderResponse;
            const order = (await Order.getByID(body.order.id))!;
            const payment = (await Payment.getByID(order.paymentId!))!;
            return { order, payment };
        }

        async function getCrowdfunding(webshop: Webshop) {
            await WebshopCrowdfundingService.flush();
            return (await getMeta(webshop)).crowdfunding!;
        }

        test('an online payment only counts once it succeeds', async () => {
            const webshop = await createLifecycleWebshop();
            const { payment } = await placeOrder(webshop, PaymentMethod.Bancontact);

            // Online payments don't count as pending: their balance item stays hidden
            expect(await getCrowdfunding(webshop)).toMatchObject({ progressAmount: 0, pendingAmount: 0 });

            // Payment becomes pending at the payment provider
            const intent = stripeMocker.getLastIntent() as StripeObject;
            intent.status = 'processing';
            await PaymentService.pollStatus(payment.id, organization);
            expect((await Payment.getByID(payment.id))!.status).toBe(PaymentStatus.Pending);

            expect(await getCrowdfunding(webshop)).toMatchObject({ progressAmount: 0, pendingAmount: 0 });

            // Payment succeeds
            intent.status = 'succeeded';
            intent.latest_charge = 'ch_mocked';
            await PaymentService.pollStatus(payment.id, organization);
            expect((await Payment.getByID(payment.id))!.status).toBe(PaymentStatus.Succeeded);

            expect(await getCrowdfunding(webshop)).toMatchObject({ progressAmount: 10_0000, pendingAmount: 0 });
        });

        test('a failed online payment does not count', async () => {
            const webshop = await createLifecycleWebshop();
            const { payment } = await placeOrder(webshop, PaymentMethod.Bancontact);

            const intent = stripeMocker.getLastIntent() as StripeObject;
            intent.status = 'processing';
            await PaymentService.pollStatus(payment.id, organization);

            intent.status = 'canceled';
            await PaymentService.pollStatus(payment.id, organization);
            expect((await Payment.getByID(payment.id))!.status).toBe(PaymentStatus.Failed);

            expect(await getCrowdfunding(webshop)).toMatchObject({ progressAmount: 0, pendingAmount: 0 });
        });

        test('a transfer order counts as pending and counts as progress once an admin marks the payment as paid', async () => {
            const webshop = await createLifecycleWebshop();
            const { payment } = await placeOrder(webshop, PaymentMethod.Transfer);

            // The transfer that has not been received yet counts as pending
            expect(await getCrowdfunding(webshop)).toMatchObject({ progressAmount: 0, pendingAmount: 10_0000 });

            // This is what PatchPaymentsEndpoint calls when an admin marks the transfer as paid
            await PaymentService.handlePaymentStatusUpdate(payment, organization, PaymentStatus.Succeeded);

            expect(await getCrowdfunding(webshop)).toMatchObject({ progressAmount: 10_0000, pendingAmount: 0 });
        });

        test('a transfer order stops counting when the payment is marked as failed afterwards', async () => {
            const webshop = await createLifecycleWebshop();
            const { payment } = await placeOrder(webshop, PaymentMethod.Transfer);

            await PaymentService.handlePaymentStatusUpdate(payment, organization, PaymentStatus.Succeeded);
            expect(await getCrowdfunding(webshop)).toMatchObject({ progressAmount: 10_0000, pendingAmount: 0 });

            await PaymentService.handlePaymentStatusUpdate(payment, organization, PaymentStatus.Failed);
            expect(await getCrowdfunding(webshop)).toMatchObject({ progressAmount: 0, pendingAmount: 0 });
        });

        test('an order created manually by an admin counts once paid', async () => {
            const webshop = await createLifecycleWebshop();

            const patchArray: PatchableArrayAutoEncoder<PrivateOrder> = new PatchableArray();
            patchArray.addPut(PrivateOrder.create({
                id: uuidv4(),
                data: buildOrderData(PaymentMethod.Transfer),
                webshopId: webshop.id,
            }));

            const r = Request.buildJson('PATCH', `/webshop/${webshop.id}/orders`, organization.getApiHost(), patchArray);
            r.headers.authorization = 'Bearer ' + token.accessToken;
            const response = await testServer.test(patchWebshopOrdersEndpoint, r);
            expect(response.body).toHaveLength(1);

            expect(await getCrowdfunding(webshop)).toMatchObject({ progressAmount: 0, pendingAmount: 10_0000 });

            const order = (await Order.getByID(response.body[0].id))!;
            const payment = (await Payment.getByID(order.paymentId!))!;
            await PaymentService.handlePaymentStatusUpdate(payment, organization, PaymentStatus.Succeeded);

            expect(await getCrowdfunding(webshop)).toMatchObject({ progressAmount: 10_0000, pendingAmount: 0 });
        });

        test('an order canceled by an admin no longer counts', async () => {
            const webshop = await createLifecycleWebshop();
            const { order, payment } = await placeOrder(webshop, PaymentMethod.Transfer);

            await PaymentService.handlePaymentStatusUpdate(payment, organization, PaymentStatus.Succeeded);
            expect(await getCrowdfunding(webshop)).toMatchObject({ progressAmount: 10_0000, pendingAmount: 0 });

            const patchArray: PatchableArrayAutoEncoder<PrivateOrder> = new PatchableArray();
            patchArray.addPatch(PrivateOrder.patch({
                id: order.id,
                status: OrderStatus.Canceled,
            }));

            const r = Request.buildJson('PATCH', `/webshop/${webshop.id}/orders`, organization.getApiHost(), patchArray);
            r.headers.authorization = 'Bearer ' + token.accessToken;
            await testServer.test(patchWebshopOrdersEndpoint, r);

            // Canceling cancels the balance items, so the paid amount no longer counts
            expect(await getCrowdfunding(webshop)).toMatchObject({ progressAmount: 0, pendingAmount: 0 });
        });

        test('enabling crowdfunding recalculates the amounts of existing orders', async () => {
            const webshop = await createLifecycleWebshop(null);
            const { payment } = await placeOrder(webshop, PaymentMethod.Transfer);
            await PaymentService.handlePaymentStatusUpdate(payment, organization, PaymentStatus.Succeeded);
            await WebshopCrowdfundingService.flush();

            expect((await getMeta(webshop)).crowdfunding).toBeNull();

            const patch = PrivateWebshop.patch({
                meta: WebshopMetaData.patch({
                    crowdfunding: WebshopCrowdfunding.create({ goalAmount: 100_0000 }),
                }),
            });

            const r = Request.buildJson('PATCH', `/webshop/${webshop.id}`, organization.getApiHost(), patch);
            r.headers.authorization = 'Bearer ' + token.accessToken;
            const response = await testServer.test(patchWebshopEndpoint, r);

            // The response already contains the recalculated amounts
            expect(response.body.meta.crowdfunding).toMatchObject({ progressAmount: 10_0000, pendingAmount: 0 });
            expect((await getMeta(webshop)).crowdfunding).toMatchObject({ progressAmount: 10_0000, pendingAmount: 0 });
        });
    });
});
