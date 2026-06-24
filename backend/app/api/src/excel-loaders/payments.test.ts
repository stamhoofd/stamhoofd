import { BalanceItem, BalanceItemPaymentDetailed, BalanceItemRelation, BalanceItemRelationType, BalanceItemType, Cart, CartItem, CartItemPrice, OrderData, PaymentGeneral, PaymentMethod, PaymentStatus, Product, ProductPrice, TranslatedString } from '@stamhoofd/structures';
import { expandPaymentBalanceItemPayments } from './payments.js';

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

function expectRowsToMatchReplacedPayment(rows: BalanceItemPaymentDetailed[], payment: PaymentGeneral) {
    expect(rows.reduce((sum, row) => sum + row.price, 0)).toBe(payment.balanceItemPayments[0].price);
}

describe('payments excel loader', () => {
    describe('expandPaymentBalanceItemPayments', () => {
        it('splits a full order payment into order item rows and fees', () => {
            const orderData = createOrderData();
            const payment = createPayment(orderData.totalPrice);

            const rows = expandPaymentBalanceItemPayments(payment, new Map([
                ['order-1', { id: 'order-1', number: 123, data: orderData }],
            ]));

            expect(rows).toHaveLength(2);
            expect(rows[0].productName).toBe('Koffie');
            expect(rows[0].balanceItem.description).toBe('Groot');
            expect(rows[0].amount).toBe(2);
            expect(rows[0].unitPrice).toBe(3500);
            expect(rows[0].price).toBe(7000);
            expect(rows[1].productName).toBeNull();
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

            const rows = expandPaymentBalanceItemPayments(payment, new Map([
                ['order-1', { id: 'order-1', number: 123, data: orderData }],
            ]));

            expect(rows).toHaveLength(4);
            expect(rows.map(row => row.productName)).toEqual([
                'Koffie',
                null,
                null,
                null,
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

            const rows = expandPaymentBalanceItemPayments(payment, new Map([
                ['order-1', { id: 'order-1', number: 123, data: orderData }],
            ]));

            expect(rows).toHaveLength(3);
            expect(rows.map(row => row.productName)).toEqual([
                'Koffie',
                null,
                null,
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
            const orderMap = new Map([
                ['order-1', { id: 'order-1', number: 123, data: orderData }],
            ]);

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
            const orderMap = new Map([
                ['order-1', { id: 'order-1', number: 123, data: orderData }],
            ]);
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
});
