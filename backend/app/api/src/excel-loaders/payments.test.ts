import { BalanceItem, BalanceItemPaymentDetailed, BalanceItemRelation, BalanceItemRelationType, BalanceItemType, Cart, CartItem, CartItemPrice, OrderData, OrderStatus, PaymentGeneral, PaymentMethod, PaymentStatus, Product, ProductPrice, TranslatedString } from '@stamhoofd/structures';
import { expandPaymentBalanceItemPayments, getBalanceItemPaymentColumns, getExportOrderNumber, getOrderColumns, getPaymentOrderNumbers, PaymentGeneralWithStripeAccount } from './payments.js';

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
                    description: 'Bestelling #1',
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
    return new Map<string, { id: string; number: number | null; isDeleted: boolean; data: OrderData }>(
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
            expect(rows[0].balanceItem.description).toBe('Groot');
            expect(rows[0].amount).toBe(2);
            expect(rows[0].unitPrice).toBe(3500);
            expect(rows[0].price).toBe(7000);
            expect(rows[1].customTitle).toBe('Administratiekosten');
            expect(rows[1].balanceItem.description).toBe('Administratiekosten');
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
            expect(rows.map(row => row.balanceItem.description)).toEqual([
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
            expect(rows.map(row => row.balanceItem.description)).toEqual([
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
            expect(changedRows[0].balanceItem.description).toBe('Gedeeltelijke betaling/terugbetaling voor bestelling #123');
            expect(changedRows[0].amount).toBe(1);
            expect(changedRows[0].price).toBe(1000);

            const refundRows = expandPaymentBalanceItemPayments(createPayment(-1000), orderMap);
            expect(refundRows).toHaveLength(1);
            expect(refundRows[0].balanceItem.description).toBe('Gedeeltelijke betaling/terugbetaling voor bestelling #123');
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
            expect(secondRows[0].balanceItem.description).toBe('Gedeeltelijke betaling/terugbetaling voor bestelling #123');
            expect(secondRows[0].price).toBe(orderData.totalPrice);
            expectRowsToMatchReplacedPayment(firstRows, createPayment(orderData.totalPrice));
            expectRowsToMatchReplacedPayment(secondRows, createPayment(orderData.totalPrice));
        });
    });

    describe('getPaymentOrderNumbers', () => {
        it('looks up the number of the order that was paid', () => {
            const orderMap = createOrderMap([{ id: 'order-1', number: 123 }]);

            expect(getPaymentOrderNumbers(createPaymentForOrders(['order-1']), orderMap)).toEqual({ numbers: [123], hasDeleted: false });
        });

        it('lists every order a payment paid for, without repeating one', () => {
            const orderMap = createOrderMap([
                { id: 'order-1', number: 123 },
                { id: 'order-2', number: 124 },
            ]);

            const payment = createPaymentForOrders(['order-1', 'order-2', 'order-1']);

            expect(getPaymentOrderNumbers(payment, orderMap)).toEqual({ numbers: [123, 124], hasDeleted: false });
        });

        it('skips balance items without a known order number', () => {
            const orderMap = createOrderMap([
                { id: 'order-1', number: null },
                { id: 'order-2', number: 124 },
            ]);

            expect(getPaymentOrderNumbers(createPaymentForOrders([null]), orderMap)).toEqual({ numbers: [], hasDeleted: false });
            expect(getPaymentOrderNumbers(createPaymentForOrders(['order-1']), orderMap)).toEqual({ numbers: [], hasDeleted: false });
            expect(getPaymentOrderNumbers(createPaymentForOrders(['unknown-order']), orderMap)).toEqual({ numbers: [], hasDeleted: false });
            expect(getPaymentOrderNumbers(createPaymentForOrders([null, 'order-1', 'order-2']), orderMap)).toEqual({ numbers: [124], hasDeleted: false });
        });
    });

    describe('getExportOrderNumber', () => {
        it('keeps the number of an order that still exists', () => {
            expect(getExportOrderNumber({ status: OrderStatus.Created, number: 123 })).toBe(123);
            expect(getExportOrderNumber({ status: OrderStatus.Completed, number: 123 })).toBe(123);
            expect(getExportOrderNumber({ status: OrderStatus.Canceled, number: 123 })).toBe(123);
            expect(getExportOrderNumber({ status: OrderStatus.Created, number: null })).toBe(null);
        });

        it('drops the replacement number a deleted order was given', () => {
            expect(getExportOrderNumber({ status: OrderStatus.Deleted, number: 1638492047163 })).toBe(null);
        });
    });

    describe('deleted orders', () => {
        it('reports a deleted order as deleted instead of numbering it', () => {
            const orderMap = createOrderMap([{ id: 'order-1', number: null, isDeleted: true }]);
            const payment = createPaymentForOrders(['order-1']);

            expect(getPaymentOrderNumbers(payment, orderMap)).toEqual({ numbers: [], hasDeleted: true });
        });

        it('keeps the numbers of the orders that were not deleted', () => {
            const orderMap = createOrderMap([
                { id: 'order-1', number: null, isDeleted: true },
                { id: 'order-2', number: 124 },
            ]);
            const payment = createPaymentForOrders(['order-1', 'order-2']);

            expect(getPaymentOrderNumbers(payment, orderMap)).toEqual({ numbers: [124], hasDeleted: true });
        });

        it('describes a partial payment for a deleted order without a number', () => {
            const orderMap = createOrderMap([{ id: 'order-1', number: null, isDeleted: true }]);

            const rows = expandPaymentBalanceItemPayments(createPayment(1000), orderMap);

            expect(rows).toHaveLength(1);
            expect(rows[0].balanceItem.description).toBe('Gedeeltelijke betaling/terugbetaling voor bestelling');
            expect(rows[0].price).toBe(1000);
        });

        it('marks the rows of a deleted order as deleted', () => {
            const orderMap = createOrderMap([{ id: 'order-1', number: null, isDeleted: true }]);

            const rows = expandPaymentBalanceItemPayments(createPayment(1000), orderMap);

            expect(rows.map(row => row.orderNumber)).toEqual([null]);
            expect(rows.map(row => row.isDeletedOrder)).toEqual([true]);
        });
    });

    describe('order number of a payment line', () => {
        it('carries the order number onto every row an order was split into', () => {
            const orderData = createOrderData();
            const orderMap = createOrderMap([{ id: 'order-1', number: 123 }], orderData);

            const rows = expandPaymentBalanceItemPayments(createPayment(orderData.totalPrice), orderMap);

            expect(rows).toHaveLength(2);
            expect(rows.map(row => row.orderNumber)).toEqual([123, 123]);
            expect(rows.map(row => row.isDeletedOrder)).toEqual([false, false]);
        });

        it('leaves the number empty for a balance item that is not a webshop order', () => {
            const rows = expandPaymentBalanceItemPayments(createPaymentForOrders([null]), createOrderMap([]));

            expect(rows).toHaveLength(1);
            expect(rows[0].orderNumber).toBe(null);
            expect(rows[0].isDeletedOrder).toBe(false);
        });
    });

    describe('order number column of a payment line', () => {
        function getOrderNumberCell(orderNumber: number | null, isDeletedOrder: boolean) {
            const orderMap = createOrderMap([{ id: 'order-1', number: orderNumber, isDeleted: isDeletedOrder }]);
            const rows = expandPaymentBalanceItemPayments(createPayment(1000), orderMap);
            const column = getBalanceItemPaymentColumns().find(c => 'id' in c && c.id === 'orderNumber');

            if (!column || !('getValue' in column)) {
                throw new Error('Missing order number column');
            }

            return column.getValue({ payment: PaymentGeneralWithStripeAccount.create(createPayment(1000)), balanceItemPayment: rows[0] });
        }

        it('writes the order number as a number, so it stays sortable', () => {
            expect(getOrderNumberCell(123, false).value).toBe(123);
        });

        it('names a deleted order instead of leaving the cell empty', () => {
            expect(getOrderNumberCell(null, true).value).toBe('Verwijderd');
        });

        it('leaves the cell empty for a line without a webshop order', () => {
            expect(getOrderNumberCell(null, false).value).toBe('');
        });
    });

    describe('order number column', () => {
        function getOrderNumberCell(orderNumbers: number[], hasDeletedOrders: boolean) {
            const payment = PaymentGeneralWithStripeAccount.create(createPayment(1000));
            payment.orderNumbers = orderNumbers;
            payment.hasDeletedOrders = hasDeletedOrders;

            return getOrderColumns()[0].getValue(payment);
        }

        it('writes one order number as a number, so it stays sortable', () => {
            expect(getOrderNumberCell([123], false).value).toBe(123);
        });

        it('joins the numbers of a payment that paid for more than one order', () => {
            expect(getOrderNumberCell([123, 124], false).value).toBe('123, 124');
        });

        it('names a deleted order instead of leaving the cell empty', () => {
            expect(getOrderNumberCell([], true).value).toBe('Verwijderd');
            expect(getOrderNumberCell([123], true).value).toBe('123, Verwijderd');
        });

        it('leaves the cell empty for a payment without a webshop order', () => {
            expect(getOrderNumberCell([], false).value).toBe('');
        });
    });
});
