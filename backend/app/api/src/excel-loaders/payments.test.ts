import { BalanceItem, BalanceItemPaymentDetailed, BalanceItemRelation, BalanceItemRelationType, BalanceItemType, Cart, CartItem, CartItemPrice, OrderData, OrderStatus, PaymentGeneral, PaymentMethod, PaymentStatus, Product, ProductPrice, TranslatedString } from '@stamhoofd/structures';
import { createPaymentExportOrder, expandPaymentBalanceItemPayments, getBalanceItemPaymentColumns, getOrderColumns, getOrderNumberCell, getPaymentOrders, PaymentGeneralWithStripeAccount } from './payments.js';
import type { PaymentExportOrder } from './payments.js';

function createOrderData(options: {
    percentageDiscount?: number;
    fixedDiscount?: number;
} = {}) {
    const productPrice = ProductPrice.create({
        id: 'large',
        name: 'Groot',
        price: 3500,
    });
    const otherProductPrice = ProductPrice.create({
        id: 'small',
        name: 'Klein',
        price: 2500,
    });
    const product = Product.create({
        id: 'coffee',
        name: 'Koffie',
        prices: [productPrice, otherProductPrice],
    });
    const cartItem = CartItem.create({
        id: 'cart-item-1',
        product,
        productPrice,
        amount: 2,
        unitPrice: 3500,
        calculatedPrices: [
            CartItemPrice.create({ price: 3500 }),
            CartItemPrice.create({ price: 3500 }),
        ],
    });

    return OrderData.create({
        cart: Cart.create({
            items: [cartItem],
        }),
        administrationFee: 500,
        percentageDiscount: options.percentageDiscount ?? 0,
        fixedDiscount: options.fixedDiscount ?? 0,
    });
}

function createPayment(price: number): PaymentGeneral {
    return PaymentGeneral.create({
        id: 'payment-1',
        method: PaymentMethod.Transfer,
        status: PaymentStatus.Succeeded,
        price,
        balanceItemPayments: [
            BalanceItemPaymentDetailed.create({
                id: 'balance-item-payment-1',
                price,
                balanceItem: BalanceItem.create({
                    id: 'balance-item-1',
                    type: BalanceItemType.Order,
                    orderId: 'order-1',
                    name: 'Bestelling #1',
                    amount: 1,
                    unitPrice: price,
                    relations: new Map([
                        [BalanceItemRelationType.Webshop, BalanceItemRelation.create({
                            id: 'webshop-1',
                            name: new TranslatedString('Clubshop'),
                        })],
                    ]),
                }),
            }),
        ],
    });
}

function createPaymentForOrders(orderIds: (string | null)[]): PaymentGeneral {
    return PaymentGeneral.create({
        id: 'payment-1',
        method: PaymentMethod.Transfer,
        status: PaymentStatus.Succeeded,
        price: 1000 * orderIds.length,
        balanceItemPayments: orderIds.map((orderId, index) => BalanceItemPaymentDetailed.create({
            id: 'balance-item-payment-' + index,
            price: 1000,
            balanceItem: BalanceItem.create({
                id: 'balance-item-' + index,
                type: orderId ? BalanceItemType.Order : BalanceItemType.Other,
                orderId,
                description: 'Bestelling',
                amount: 1,
                unitPrice: 1000,
            }),
        })),
    });
}

function createOrderMap(orders: { id: string; number: number | null; isDeleted?: boolean }[], data: OrderData = createOrderData()) {
    return new Map<string, PaymentExportOrder>(
        orders.map(order => [order.id, { ...order, isDeleted: order.isDeleted ?? false, data }]),
    );
}

function expectRowsToMatchReplacedPayment(rows: BalanceItemPaymentDetailed[], payment: PaymentGeneral) {
    expect(rows.reduce((sum, row) => sum + row.price, 0)).toBe(payment.balanceItemPayments[0].price);
}

describe('payments excel loader', () => {
    describe('expandPaymentBalanceItemPayments', () => {
        it('splits a full order payment into order item rows and fees', () => {
            const orderData = createOrderData();
            const payment = createPayment(orderData.totalPrice);

            const rows = expandPaymentBalanceItemPayments(payment, createOrderMap([{ id: 'order-1', number: 123 }], orderData));

            expect(rows).toHaveLength(2);
            expect(rows[0].customTitle).toBe('Koffie');
            expect(rows[0].balanceItem.name).toBe('Groot');
            expect(rows[0].amount).toBe(2);
            expect(rows[0].unitPrice).toBe(3500);
            expect(rows[0].price).toBe(7000);
            expect(rows[1].customTitle).toBe('Administratiekosten');
            expect(rows[1].balanceItem.name).toBe('Administratiekosten');
            expect(rows[1].amount).toBe(1);
            expect(rows[1].price).toBe(500);
            expectRowsToMatchReplacedPayment(rows, payment);
        });

        it('adds order discount rows when splitting a full order payment', () => {
            const orderData = createOrderData({
                percentageDiscount: 1000,
                fixedDiscount: 300,
            });
            const payment = createPayment(orderData.totalPrice);

            const rows = expandPaymentBalanceItemPayments(payment, createOrderMap([{ id: 'order-1', number: 123 }], orderData));

            expect(rows).toHaveLength(4);
            expect(rows.map(row => row.customTitle)).toEqual([
                'Koffie',
                'Korting (10%)',
                'Korting',
                'Administratiekosten',
            ]);
            expect(rows.map(row => row.balanceItem.name)).toEqual([
                'Groot',
                'Korting (10%)',
                'Vaste korting',
                'Administratiekosten',
            ]);
            expect(rows.map(row => row.price)).toEqual([
                7000,
                -700,
                -300,
                500,
            ]);
            expectRowsToMatchReplacedPayment(rows, payment);
        });

        it('caps order discount rows to the cart subtotal', () => {
            const orderData = createOrderData({
                percentageDiscount: 10000,
                fixedDiscount: 3000,
            });
            const payment = createPayment(orderData.totalPrice);

            const rows = expandPaymentBalanceItemPayments(payment, createOrderMap([{ id: 'order-1', number: 123 }], orderData));

            expect(rows).toHaveLength(3);
            expect(rows.map(row => row.customTitle)).toEqual([
                'Koffie',
                'Korting (100%)',
                'Administratiekosten',
            ]);
            expect(rows.map(row => row.balanceItem.name)).toEqual([
                'Groot',
                'Korting (100%)',
                'Administratiekosten',
            ]);
            expect(rows.map(row => row.price)).toEqual([
                7000,
                -7000,
                500,
            ]);
            expectRowsToMatchReplacedPayment(rows, payment);
        });

        it('keeps partial order payments and refunds as single rows', () => {
            const orderData = createOrderData();
            const orderMap = createOrderMap([{ id: 'order-1', number: 123 }], orderData);

            const changedRows = expandPaymentBalanceItemPayments(createPayment(1000), orderMap);
            expect(changedRows).toHaveLength(1);
            expect(changedRows[0].balanceItem.name).toBe('Gedeeltelijke betaling/terugbetaling voor bestelling #123');
            expect(changedRows[0].amount).toBe(1);
            expect(changedRows[0].price).toBe(1000);

            const refundRows = expandPaymentBalanceItemPayments(createPayment(-1000), orderMap);
            expect(refundRows).toHaveLength(1);
            expect(refundRows[0].balanceItem.name).toBe('Gedeeltelijke betaling/terugbetaling voor bestelling #123');
            expect(refundRows[0].amount).toBe(1);
            expect(refundRows[0].price).toBe(-1000);
        });

        it('only splits the same full order once per export page', () => {
            const orderData = createOrderData();
            const orderMap = createOrderMap([{ id: 'order-1', number: 123 }], orderData);
            const addedOrderIds = new Set<string>();

            const firstRows = expandPaymentBalanceItemPayments(createPayment(orderData.totalPrice), orderMap, addedOrderIds);
            const secondRows = expandPaymentBalanceItemPayments(createPayment(orderData.totalPrice), orderMap, addedOrderIds);

            expect(firstRows).toHaveLength(2);
            expect(secondRows).toHaveLength(1);
            expect(secondRows[0].balanceItem.name).toBe('Gedeeltelijke betaling/terugbetaling voor bestelling #123');
            expect(secondRows[0].price).toBe(orderData.totalPrice);
            expectRowsToMatchReplacedPayment(firstRows, createPayment(orderData.totalPrice));
            expectRowsToMatchReplacedPayment(secondRows, createPayment(orderData.totalPrice));
        });
    });

    describe('getPaymentOrders', () => {
        it('looks up the order that was paid', () => {
            const orderMap = createOrderMap([{ id: 'order-1', number: 123 }]);

            expect(getPaymentOrders(createPaymentForOrders(['order-1']), orderMap).map(o => o.number)).toEqual([123]);
        });

        it('lists every order a payment paid for, without repeating one', () => {
            const orderMap = createOrderMap([
                { id: 'order-1', number: 123 },
                { id: 'order-2', number: 124 },
            ]);

            const payment = createPaymentForOrders(['order-1', 'order-2', 'order-1']);

            expect(getPaymentOrders(payment, orderMap).map(o => o.id)).toEqual(['order-1', 'order-2']);
        });

        it('skips balance items without a loaded order', () => {
            const orderMap = createOrderMap([{ id: 'order-2', number: 124 }]);

            expect(getPaymentOrders(createPaymentForOrders([null]), orderMap)).toEqual([]);
            expect(getPaymentOrders(createPaymentForOrders(['unknown-order']), orderMap)).toEqual([]);
            expect(getPaymentOrders(createPaymentForOrders([null, 'unknown-order', 'order-2']), orderMap).map(o => o.id)).toEqual(['order-2']);
        });
    });

    describe('createPaymentExportOrder', () => {
        const data = createOrderData();

        it('keeps the number of an order that still exists', () => {
            expect(createPaymentExportOrder({ id: 'order-1', status: OrderStatus.Created, number: 123, data })).toEqual({ id: 'order-1', number: 123, isDeleted: false, data });
            expect(createPaymentExportOrder({ id: 'order-1', status: OrderStatus.Canceled, number: 123, data }).number).toBe(123);
            expect(createPaymentExportOrder({ id: 'order-1', status: OrderStatus.Created, number: null, data }).number).toBe(null);
        });

        it('drops the replacement number a deleted order was given', () => {
            expect(createPaymentExportOrder({ id: 'order-1', status: OrderStatus.Deleted, number: 1638492047163, data })).toEqual({ id: 'order-1', number: null, isDeleted: true, data });
        });
    });

    describe('deleted orders', () => {
        it('describes a partial payment for a deleted order without a number', () => {
            const orderMap = createOrderMap([{ id: 'order-1', number: null, isDeleted: true }]);

            const rows = expandPaymentBalanceItemPayments(createPayment(1000), orderMap);

            expect(rows).toHaveLength(1);
            expect(rows[0].balanceItem.name).toBe('Gedeeltelijke betaling/terugbetaling voor bestelling');
            expect(rows[0].price).toBe(1000);
            expect(rows[0].order?.isDeleted).toBe(true);
        });
    });

    describe('order number of a payment line', () => {
        it('carries the order onto every row an order was split into', () => {
            const orderData = createOrderData();
            const orderMap = createOrderMap([{ id: 'order-1', number: 123 }], orderData);

            const rows = expandPaymentBalanceItemPayments(createPayment(orderData.totalPrice), orderMap);

            expect(rows).toHaveLength(2);
            expect(rows.map(row => row.order?.number)).toEqual([123, 123]);
        });

        it('leaves the order empty for a balance item that is not a webshop order', () => {
            const rows = expandPaymentBalanceItemPayments(createPaymentForOrders([null]), createOrderMap([]));

            expect(rows).toHaveLength(1);
            expect(rows[0].order).toBe(null);
        });

        it('renders the order number column from the row', () => {
            const orderMap = createOrderMap([{ id: 'order-1', number: 123 }]);
            const rows = expandPaymentBalanceItemPayments(createPayment(1000), orderMap);
            const column = getBalanceItemPaymentColumns().find(c => 'id' in c && c.id === 'orderNumber');

            if (!column || !('getValue' in column)) {
                throw new Error('Missing order number column');
            }

            expect(column.getValue({ payment: PaymentGeneralWithStripeAccount.create(createPayment(1000)), balanceItemPayment: rows[0] }).value).toBe(123);
        });
    });

    describe('order number column', () => {
        function getPaymentOrderNumberCell(orders: { id: string; number: number | null; isDeleted?: boolean }[]) {
            const payment = PaymentGeneralWithStripeAccount.create(createPayment(1000));
            payment.orders = [...createOrderMap(orders).values()];

            return getOrderColumns()[0].getValue(payment);
        }

        it('writes one order number as a number, so it stays sortable', () => {
            expect(getPaymentOrderNumberCell([{ id: 'order-1', number: 123 }]).value).toBe(123);
        });

        it('joins the numbers of a payment that paid for more than one order', () => {
            expect(getOrderNumberCell([...createOrderMap([{ id: 'order-1', number: 123 }, { id: 'order-2', number: 124 }]).values()]).value).toBe('123, 124');
        });

        it('names a deleted order instead of leaving the cell empty', () => {
            expect(getOrderNumberCell([...createOrderMap([{ id: 'order-1', number: null, isDeleted: true }]).values()]).value).toBe('Verwijderd');
            expect(getOrderNumberCell([...createOrderMap([{ id: 'order-1', number: 123 }, { id: 'order-2', number: null, isDeleted: true }]).values()]).value).toBe('123, Verwijderd');
        });

        it('skips an order that has no number yet', () => {
            expect(getOrderNumberCell([...createOrderMap([{ id: 'order-1', number: null }]).values()]).value).toBe('');
        });

        it('leaves the cell empty for a payment without a webshop order', () => {
            expect(getOrderNumberCell([]).value).toBe('');
        });
    });
});
