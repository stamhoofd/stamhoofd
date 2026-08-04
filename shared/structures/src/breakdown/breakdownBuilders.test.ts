import { TestUtils } from '@stamhoofd/test-utils';
import type { StamhoofdFilter } from '../filters/StamhoofdFilter.js';
import { BalanceItem, BalanceItemPaymentWithPrivatePayment, BalanceItemRelation, BalanceItemRelationType, BalanceItemStatus, BalanceItemType, getBalanceItemTypeName } from '../BalanceItem.js';
import { BalanceItemPaymentDetailed } from '../BalanceItemDetailed.js';
import { PrivatePayment, Settlement } from '../members/Payment.js';
import { PaymentGeneral } from '../members/PaymentGeneral.js';
import { PaymentMethod, PaymentMethodHelper } from '../PaymentMethod.js';
import { getPaymentProviderName, PaymentProvider } from '../PaymentProvider.js';
import { PaymentStatus } from '../PaymentStatus.js';
import { Formatter } from '@stamhoofd/utility';
import type { BalanceItemBreakdown, BreakdownGroup } from '../PaymentBreakdown.js';
import { BreakdownAmountType, BreakdownGraphUnit, BreakdownObjectType, BreakdownPathItem, BreakdownTab } from '../PaymentBreakdown.js';
import { BalanceItemBreakdownBuilder } from './BalanceItemBreakdownBuilder.js';
import { PaymentBreakdownBuilder } from './PaymentBreakdownBuilder.js';
import { PENDING_PAYMENT_ID, PENDING_PAYMENT_STATUSES } from '../PaymentSettlement.js';
import { StripeAccount, StripeBusinessProfile, StripeMetaData } from '../StripeAccount.js';
import { Cart } from '../webshops/Cart.js';
import { CartItem, CartItemPrice } from '../webshops/CartItem.js';
import { OrderData } from '../webshops/Order.js';
import { Product, ProductPrice } from '../webshops/Product.js';
import { TransferSettings } from '../webshops/TransferSettings.js';
import { TranslatedString } from '../TranslatedString.js';

describe('Breakdown builders', () => {
    beforeEach(() => {
        TestUtils.setEnvironment('userMode', 'organization');
        TestUtils.setEnvironment('platformName', 'stamhoofd');
    });

    function createRegistration({ groupId, groupName, price, priceName, memberId, option, quantity = 1, status = BalanceItemStatus.Due }: {
        groupId: string;
        groupName: string;
        price: number;
        priceName?: string;
        memberId?: string;
        /**
         * Something extra that was bought for the registration, e.g. a t-shirt size.
         */
        option?: { menu: string; name: string };
        quantity?: number;
        status?: BalanceItemStatus;
    }) {
        const relations = new Map([
            [BalanceItemRelationType.Group, BalanceItemRelation.create({ id: groupId, name: new TranslatedString(groupName) })],
        ]);

        if (priceName) {
            relations.set(
                BalanceItemRelationType.GroupPrice,
                BalanceItemRelation.create({ id: 'price-' + priceName, name: new TranslatedString(priceName) }),
            );
        }

        if (memberId) {
            relations.set(
                BalanceItemRelationType.Member,
                BalanceItemRelation.create({ id: memberId, name: new TranslatedString('Lid ' + memberId) }),
            );
        }

        if (option) {
            relations.set(
                BalanceItemRelationType.GroupOptionMenu,
                BalanceItemRelation.create({ id: 'menu-' + option.menu, name: new TranslatedString(option.menu) }),
            );
            relations.set(
                BalanceItemRelationType.GroupOption,
                BalanceItemRelation.create({ id: 'option-' + option.name, name: new TranslatedString(option.name) }),
            );
        }

        return BalanceItem.create({
            type: BalanceItemType.Registration,
            amount: quantity,
            unitPrice: price,
            status,
            relations,
        });
    }

    function createOrder({ webshopId, webshopName, price }: { webshopId: string; webshopName: string; price: number }) {
        return BalanceItem.create({
            type: BalanceItemType.Order,
            amount: 1,
            unitPrice: price,
            relations: new Map([
                [BalanceItemRelationType.Webshop, BalanceItemRelation.create({ id: webshopId, name: new TranslatedString(webshopName) })],
            ]),
        });
    }

    function createPayment({ items, method = PaymentMethod.Transfer, provider = null, transferSettings = null, stripeAccountId = null, settlement = null, status = PaymentStatus.Succeeded, roundingAmount = 0, price }: {
        items: [BalanceItem, number][];
        method?: PaymentMethod;
        provider?: PaymentProvider | null;
        transferSettings?: TransferSettings | null;
        stripeAccountId?: string | null;
        settlement?: Settlement | null;
        status?: PaymentStatus;
        /**
         * What this payment rounded away, because a payment goes to the cent while what was charged
         * goes to four digits after the comma.
         */
        roundingAmount?: number;
        /**
         * What the payment is worth, when that is more than the things it says it paid for.
         */
        price?: number;
    }) {
        return PaymentGeneral.create({
            method,
            provider,
            transferSettings,
            stripeAccountId,
            settlement,
            status,
            roundingAmount,
            price: price ?? items.reduce((total, [_, price]) => total + price, 0) + roundingAmount,
            balanceItemPayments: items.map(([balanceItem, price]) => BalanceItemPaymentDetailed.create({
                price,
                balanceItem,
            })),
        });
    }

    /**
     * A payout of a payment provider, e.g. everything Mollie transferred on one day.
     */
    function createSettlement({ reference, settledAt }: { reference: string; settledAt: string }) {
        return Settlement.create({
            id: 'stl_' + reference,
            reference,
            settledAt: new Date(settledAt),
            amount: 0,
        });
    }

    /**
     * An online payment of one balance item, the way a balance item knows how it was paid.
     */
    function createOnlinePaymentFor(price: number, options: { settlement?: Settlement | null; status?: PaymentStatus; provider?: PaymentProvider } = {}) {
        return BalanceItemPaymentWithPrivatePayment.create({
            price,
            payment: PrivatePayment.create({
                method: PaymentMethod.Bancontact,
                provider: options.provider ?? PaymentProvider.Mollie,
                status: options.status ?? PaymentStatus.Succeeded,
                settlement: options.settlement ?? null,
                price,
            }),
        });
    }

    /**
     * Breaks down payments the way an endpoint does: page by page.
     */
    function breakDownPayments(pages: PaymentGeneral[][], options: { path?: BreakdownPathItem[]; stripeAccounts?: StripeAccount[]; filter?: StamhoofdFilter; orders?: Map<string, OrderData> } = {}) {
        const builder = new PaymentBreakdownBuilder(options.path ?? []);

        for (const page of pages) {
            builder.add(page, { stripeAccounts: options.stripeAccounts ?? [], orders: options.orders });
        }

        return builder.build(options.filter ?? null);
    }

    function breakDownBalanceItems(items: BalanceItem[], options: { path?: BreakdownPathItem[]; filter?: StamhoofdFilter; balanceItemPayments?: Map<string, BalanceItemPaymentWithPrivatePayment[]>; orders?: Map<string, OrderData> } = {}) {
        const builder = new BalanceItemBreakdownBuilder(options.path ?? []);
        cachePaidAmounts(items, options.balanceItemPayments);
        builder.add(items, { balanceItemPayments: options.balanceItemPayments, orders: options.orders });
        return builder.build(options.filter ?? null);
    }

    /**
     * Fills in what a balance item caches about its payments, the way the database keeps it up to date.
     * Without this an item would say nothing was ever paid for it while its payments say otherwise.
     */
    function cachePaidAmounts(items: BalanceItem[], balanceItemPayments?: Map<string, BalanceItemPaymentWithPrivatePayment[]>) {
        for (const item of items) {
            const payments = balanceItemPayments?.get(item.id) ?? [];

            item.pricePaid = payments.reduce((total, p) => total + (p.payment.status === PaymentStatus.Succeeded ? p.price : 0), 0);
            item.pricePending = payments.reduce((total, p) => total + (PENDING_PAYMENT_STATUSES.includes(p.payment.status) ? p.price : 0), 0);
        }
    }

    /**
     * A webshop order of one product, with the balance item it was charged with.
     */
    function createWebshopOrder({ webshopId, webshopName, unitPrice, amount }: { webshopId: string; webshopName: string; unitPrice: number; amount: number }) {
        const product = Product.create({ name: 'T-shirt', prices: [ProductPrice.create({ name: 'Standaard', price: unitPrice })] });

        const order = OrderData.create({
            cart: Cart.create({
                items: [CartItem.create({
                    product,
                    productPrice: product.prices[0],
                    amount,
                    // Normally calculated during checkout
                    unitPrice,
                    calculatedPrices: Array.from({ length: amount }, () => CartItemPrice.create({ price: unitPrice })),
                })],
            }),
        });

        const balanceItem = BalanceItem.create({
            type: BalanceItemType.Order,
            orderId: 'order-' + webshopId,
            amount: 1,
            unitPrice: order.totalPrice,
            relations: new Map([
                [BalanceItemRelationType.Webshop, BalanceItemRelation.create({ id: webshopId, name: new TranslatedString(webshopName) })],
            ]),
        });

        return { order, balanceItem, orders: new Map([[balanceItem.orderId!, order]]) };
    }

    describe('Splitting payments over what they paid for', () => {
        test('a payment that paid for two things is split over both', () => {
            const registration = createRegistration({ groupId: 'group-a', groupName: 'Kapoenen', price: 60_00 });
            const order = createOrder({ webshopId: 'shop-a', webshopName: 'Wafelverkoop', price: 40_00 });

            const breakdown = breakDownPayments([[
                createPayment({ items: [[registration, 60_00], [order, 40_00]] }),
            ]]);

            expect(breakdown.price).toBe(100_00);
            expect(breakdown.paymentCount).toBe(1);
            expect(breakdown.selection.isListPartial).toBe(false);
            expect(breakdown.byCategory.map(r => ({ name: r.name.toString(), price: r.price }))).toEqual([
                { name: 'Kapoenen', price: 60_00 },
                { name: 'Wafelverkoop', price: 40_00 },
            ]);
        });

        test('only the paid part of a balance item counts, not the price that was charged', () => {
            const registration = createRegistration({ groupId: 'group-a', groupName: 'Kapoenen', price: 100_00 });

            // Two partial payments of a balance item of 100 euro, read in two different pages
            const breakdown = breakDownPayments([
                [createPayment({ items: [[registration, 30_00]] })],
                [createPayment({ items: [[registration, 20_00]] })],
            ]);

            expect(breakdown.byCategory).toHaveLength(1);
            expect(breakdown.byCategory[0].price).toBe(50_00);
            expect(breakdown.byCategory[0].count).toBe(2);

            // Two payments, but they bought one registration
            expect(breakdown.byCategory[0].quantity).toBe(1);
        });

        test('what a payment rounded away is an article of its own', () => {
            // Charged 12,1234 but paid 12,12: a payment only goes to the cent
            const registration = createRegistration({ groupId: 'group-a', groupName: 'Kapoenen', price: 12_1234 });
            const settlement = createSettlement({ reference: '1234567.0312.01', settledAt: '2026-03-12T09:00:00.000Z' });
            const other = createRegistration({ groupId: 'group-b', groupName: 'Welpen', price: 10_00 });

            const breakdown = breakDownPayments([[
                createPayment({ items: [[registration, 12_1234]], roundingAmount: -34, method: PaymentMethod.Bancontact, provider: PaymentProvider.Mollie, settlement }),
                // A second payout, so the payout tab is not left out for holding a single row
                createPayment({ items: [[other, 10_00]], method: PaymentMethod.PointOfSale }),
            ]]);

            expect(breakdown.price).toBe(12_1200 + 10_00);
            expect(breakdown.selection.isListPartial).toBe(false);

            // What it was for holds what was charged, plus a row for what was rounded away
            expect(breakdown.byCategory.map(r => ({ name: r.name.toString(), price: r.price }))).toEqual([
                { name: 'Kapoenen', price: 12_1234 },
                { name: 'Welpen', price: 10_00 },
                { name: $t('%1b6'), price: -34 },
            ]);
            expect(breakdown.byArticle.map(r => r.price)).toEqual([12_1234, 10_00, -34]);
            expect(breakdown.byArticle[2].name.toString()).toBe($t('%1b6'));

            // It arrived on the same account and in the same payout as the rest of the payment, so
            // those tabs hold what the bank account actually saw
            expect(breakdown.byAccount.map(r => r.price)).toEqual([12_1200, 10_00]);
            expect(breakdown.bySettlement.map(r => ({ name: r.name.toString(), price: r.price }))).toEqual([
                { name: '1234567.0312.01', price: 12_1200 },
                { name: $t('%ZjN'), price: 10_00 },
            ]);

            // It is not for one thing in particular, so it can't be broken down further, but the
            // payments that rounded something away can still be listed
            const rounding = breakdown.byArticle.find(r => r.id === 'rounding')!;
            expect(rounding.canNarrowDown).toBe(false);
            expect(rounding.selection!.amountType).toBe(BreakdownAmountType.Rounding);
            expect(rounding.selection!.filter).toEqual({ roundingAmount: { $neq: 0 } });
        });

        test('a payment that says nothing about what it paid for keeps its money in the breakdown', () => {
            const registration = createRegistration({ groupId: 'group-a', groupName: 'Kapoenen', price: 60_00 });

            // An imported payment: it is worth 40 euro, but it doesn't say what it was for
            const payments = [
                createPayment({ items: [[registration, 60_00]] }),
                createPayment({ items: [], price: 40_00 }),
            ];

            const breakdown = breakDownPayments([payments]);

            expect(breakdown.price).toBe(100_00);
            expect(breakdown.paymentCount).toBe(2);
            expect(breakdown.selection.isListPartial).toBe(false);

            // It arrived on the same account as the rest, so that tab holds everything that came in
            expect(breakdown.byAccount.map(r => r.price)).toEqual([100_00]);
            expect(breakdown.graph.points.map(p => p.price)).toEqual([100_00]);

            // What it was for is not known, so it gets a row of its own instead of disappearing
            expect(breakdown.byCategory.map(r => ({ name: r.name.toString(), price: r.price }))).toEqual([
                { name: 'Kapoenen', price: 60_00 },
                { name: $t('%Zjq'), price: 40_00 },
            ]);
            expect(breakdown.byArticle.map(r => r.price)).toEqual([60_00, 40_00]);

            // There is no way to ask the server for the part of a payment that isn't linked to anything
            const unallocated = breakdown.byArticle.find(r => r.id === 'unallocated')!;
            expect(unallocated.count).toBe(1);
            expect(unallocated.canNarrowDown).toBe(false);
            expect(unallocated.selection).toBeNull();

            // It belongs to the payment, so it survives narrowing down to where it arrived
            const byAccount = breakDownPayments([payments], {
                path: [BreakdownPathItem.create({ tab: BreakdownTab.Account, id: breakdown.byAccount[0].id })],
            });
            expect(byAccount.price).toBe(100_00);
        });

        test('narrowing down to a category leaves out what the payment rounded away', () => {
            const registration = createRegistration({ groupId: 'group-a', groupName: 'Kapoenen', price: 12_1234 });
            const payments = [createPayment({ items: [[registration, 12_1234]], roundingAmount: -34 })];

            const account = breakDownPayments([payments]).byAccount[0];
            const byAccount = breakDownPayments([payments], {
                path: [BreakdownPathItem.create({ tab: BreakdownTab.Account, id: account.id })],
            });

            // The rounding belongs to the payment, so it survives narrowing down to where it arrived
            expect(byAccount.price).toBe(12_1200);
            expect(byAccount.selection.isListPartial).toBe(false);

            const category = breakDownPayments([payments]).byCategory.find(r => r.name.toString() === 'Kapoenen')!;
            const byCategory = breakDownPayments([payments], {
                path: [BreakdownPathItem.create({ tab: BreakdownTab.Category, id: category.id })],
            });

            // But it is not part of what was paid for, so only a part of the payment is left
            expect(byCategory.price).toBe(12_1234);
            expect(byCategory.selection.isListPartial).toBe(true);
        });
    });

    describe('Grouping by where the money arrived', () => {
        test('transfers are grouped per bank account, other methods per method', () => {
            const item = createRegistration({ groupId: 'group-a', groupName: 'Kapoenen', price: 100_00 });

            const breakdown = breakDownPayments([[
                createPayment({
                    items: [[item, 30_00]],
                    transferSettings: TransferSettings.create({ iban: 'BE68539007547034', creditor: 'Eerste rekening' }),
                }),
                createPayment({
                    items: [[item, 20_00]],
                    transferSettings: TransferSettings.create({ iban: 'BE68539007547034', creditor: 'Eerste rekening' }),
                }),
                createPayment({ items: [[item, 10_00]], method: PaymentMethod.PointOfSale }),
            ]]);

            expect(breakdown.byAccount.map(r => ({ name: r.name.toString(), description: r.description, price: r.price, count: r.count }))).toEqual([
                { name: 'Eerste rekening', description: 'BE68539007547034', price: 50_00, count: 2 },
                { name: PaymentMethodHelper.getNameCapitalized(PaymentMethod.PointOfSale), description: '', price: 10_00, count: 1 },
            ]);
        });

        test('Stripe payments are grouped per Stripe account and named after the account holder', () => {
            const item = createRegistration({ groupId: 'group-a', groupName: 'Kapoenen', price: 100_00 });

            const account = StripeAccount.create({
                id: 'acct_1',
                meta: StripeMetaData.create({
                    business_profile: StripeBusinessProfile.create({ name: 'Scouts Gent' }),
                    bank_account_last4: '4242',
                }),
            });

            const breakdown = breakDownPayments([[
                createPayment({ items: [[item, 40_00]], method: PaymentMethod.Bancontact, provider: PaymentProvider.Stripe, stripeAccountId: 'acct_1' }),
            ]], { stripeAccounts: [account] });

            expect(breakdown.byAccount).toHaveLength(1);
            expect(breakdown.byAccount[0].name.toString()).toBe('Scouts Gent');
            expect(breakdown.byAccount[0].description).toBe('xxxx 4242');
            expect(breakdown.byAccount[0].icon).toBe('card');
            // Every payment that was not made via Stripe has no Stripe account either
            expect(breakdown.byAccount[0].selection!.filter).toEqual({
                $and: [
                    { provider: PaymentProvider.Stripe },
                    { stripeAccountId: 'acct_1' },
                ],
            });

        });

        test('payments of a deleted Stripe account stay grouped together', () => {
            const item = createRegistration({ groupId: 'group-a', groupName: 'Kapoenen', price: 100_00 });

            const breakdown = breakDownPayments([[
                createPayment({ items: [[item, 40_00]], method: PaymentMethod.Bancontact, provider: PaymentProvider.Stripe, stripeAccountId: 'acct_gone' }),
                createPayment({ items: [[item, 10_00]], method: PaymentMethod.Bancontact, provider: PaymentProvider.Stripe, stripeAccountId: 'acct_gone' }),
            ]]);

            expect(breakdown.byAccount).toHaveLength(1);
            expect(breakdown.byAccount[0].price).toBe(50_00);
        });
    });

    describe('Grouping by payout', () => {
        const march = createSettlement({ reference: '1234567.0312.01', settledAt: '2026-03-12T09:00:00.000Z' });
        const april = createSettlement({ reference: '1234567.0409.01', settledAt: '2026-04-09T09:00:00.000Z' });

        function createOnlinePayment(item: BalanceItem, price: number, settlement: Settlement | null) {
            return createPayment({ items: [[item, price]], method: PaymentMethod.Bancontact, provider: PaymentProvider.Mollie, settlement });
        }

        test('payments settled together are one row, per payout', () => {
            const item = createRegistration({ groupId: 'group-a', groupName: 'Kapoenen', price: 100_00 });

            const breakdown = breakDownPayments([[
                createOnlinePayment(item, 40_00, march),
                createOnlinePayment(item, 10_00, march),
                createOnlinePayment(item, 25_00, april),
            ]]);

            expect(breakdown.bySettlement.map(r => ({ name: r.name.toString(), price: r.price, count: r.count }))).toEqual([
                { name: '1234567.0312.01', price: 50_00, count: 2 },
                { name: '1234567.0409.01', price: 25_00, count: 1 },
            ]);

            expect(breakdown.bySettlement.every(r => r.canNarrowDown)).toBe(true);
        });

        test('payouts of different providers stay apart, also with the same reference', () => {
            const item = createRegistration({ groupId: 'group-a', groupName: 'Kapoenen', price: 100_00 });
            const sameReference = createSettlement({ reference: 'payout-1', settledAt: '2026-03-12T09:00:00.000Z' });

            const breakdown = breakDownPayments([[
                createPayment({ items: [[item, 40_00]], method: PaymentMethod.Bancontact, provider: PaymentProvider.Mollie, settlement: sameReference }),
                createPayment({ items: [[item, 25_00]], method: PaymentMethod.Bancontact, provider: PaymentProvider.Stripe, settlement: sameReference }),
            ]]);

            expect(breakdown.bySettlement.map(r => r.price)).toEqual([40_00, 25_00]);
            expect(breakdown.bySettlement[0].selection!.filter).toMatchObject({ $and: expect.arrayContaining([{ provider: PaymentProvider.Mollie }]) });
        });

        test('what was not paid online, and what is still waiting to be paid out, are rows of their own', () => {
            const item = createRegistration({ groupId: 'group-a', groupName: 'Kapoenen', price: 100_00 });

            const breakdown = breakDownPayments([[
                createOnlinePayment(item, 40_00, march),
                createOnlinePayment(item, 30_00, null),
                createPayment({ items: [[item, 20_00]], method: PaymentMethod.Transfer }),
                createPayment({ items: [[item, 10_00]], method: PaymentMethod.PointOfSale }),
                createPayment({ items: [[item, 5_00]], method: PaymentMethod.Unknown }),
            ]]);

            // The biggest amounts first
            expect(breakdown.bySettlement.map(r => ({ name: r.name.toString(), price: r.price }))).toEqual([
                { name: '1234567.0312.01', price: 40_00 },
                { name: $t('%ZjN'), price: 35_00 },
                { name: $t('%Zjn'), price: 30_00 },
            ]);
        });

        test('providers we get no payout information from are grouped per provider', () => {
            const item = createRegistration({ groupId: 'group-a', groupName: 'Kapoenen', price: 100_00 });

            const breakdown = breakDownPayments([[
                createOnlinePayment(item, 40_00, null),
                createPayment({ items: [[item, 25_00]], method: PaymentMethod.Bancontact, provider: PaymentProvider.Buckaroo }),
                createPayment({ items: [[item, 15_00]], method: PaymentMethod.Payconiq, provider: PaymentProvider.Payconiq }),
                createPayment({ items: [[item, 5_00]], method: PaymentMethod.Payconiq, provider: PaymentProvider.Payconiq }),
            ]]);

            // Only Mollie and Stripe tell us when they paid out, so the others say nothing more than
            // which provider is holding the money
            expect(breakdown.bySettlement.map(r => ({ name: r.name.toString(), price: r.price }))).toEqual([
                { name: $t('%Zjn'), price: 40_00 },
                { name: getPaymentProviderName(PaymentProvider.Buckaroo), price: 25_00 },
                { name: getPaymentProviderName(PaymentProvider.Payconiq), price: 20_00 },
            ]);
        });

        test('money that never arrived is a row per status, not a payout', () => {
            const item = createRegistration({ groupId: 'group-a', groupName: 'Kapoenen', price: 100_00 });

            const breakdown = breakDownPayments([[
                createOnlinePayment(item, 40_00, march),
                createPayment({ items: [[item, 25_00]], method: PaymentMethod.Bancontact, provider: PaymentProvider.Mollie, status: PaymentStatus.Failed }),
                createPayment({ items: [[item, 20_00]], method: PaymentMethod.Bancontact, provider: PaymentProvider.Mollie, status: PaymentStatus.Pending }),
                createPayment({ items: [[item, 10_00]], method: PaymentMethod.Bancontact, provider: PaymentProvider.Mollie, status: PaymentStatus.Created }),
            ]]);

            // Created and Pending are the same thing to an admin: the money is on its way
            expect(breakdown.bySettlement.map(r => ({ name: r.name.toString(), price: r.price }))).toEqual([
                { name: '1234567.0312.01', price: 40_00 },
                { name: $t('%1OL'), price: 30_00 },
                { name: $t('%ZjW'), price: 25_00 },
            ]);

            // Every payment ends up in exactly one row
            expect(breakdown.bySettlement.reduce((total, r) => total + r.price, 0)).toBe(breakdown.price);
        });

        test('nothing is broken down per payout when every payment ended up in the same place', () => {
            const item = createRegistration({ groupId: 'group-a', groupName: 'Kapoenen', price: 100_00 });

            const breakdown = breakDownPayments([[
                createPayment({ items: [[item, 40_00]], method: PaymentMethod.Transfer }),
                createPayment({ items: [[item, 10_00]], method: PaymentMethod.PointOfSale }),
            ]]);

            // One row would only repeat the total
            expect(breakdown.bySettlement).toEqual([]);
        });

        test('narrowing down to a payout keeps only the payments it held', () => {
            const item = createRegistration({ groupId: 'group-a', groupName: 'Kapoenen', price: 100_00 });

            const payments = [
                createOnlinePayment(item, 40_00, march),
                createOnlinePayment(item, 25_00, april),
                createPayment({ items: [[item, 10_00]], method: PaymentMethod.Transfer }),
            ];

            const row = breakDownPayments([payments]).bySettlement.find(r => r.name.toString() === '1234567.0312.01')!;
            const narrowed = breakDownPayments([payments], {
                path: [BreakdownPathItem.create({ tab: BreakdownTab.Settlement, id: row.id })],
            });

            expect(narrowed.price).toBe(40_00);
            expect(narrowed.paymentCount).toBe(1);
            expect(narrowed.selection.filter).toEqual({
                $and: [
                    // A payment that failed can still carry the payout it was meant to be part of
                    { status: PaymentStatus.Succeeded },
                    { provider: PaymentProvider.Mollie },
                    { settlement: { reference: '1234567.0312.01' } },
                    { settlement: { settledAt: march.settledAt } },
                ],
            });
        });
    });

    describe('Grouping what was charged by payout', () => {
        const march = createSettlement({ reference: '1234567.0312.01', settledAt: '2026-03-12T09:00:00.000Z' });
        const april = createSettlement({ reference: '1234567.0409.01', settledAt: '2026-04-09T09:00:00.000Z' });

        test('a balance item that was paid out in parts is counted in every payout it was part of', () => {
            const item = createRegistration({ groupId: 'group-a', groupName: 'Kapoenen', price: 100_00 });
            const other = createRegistration({ groupId: 'group-b', groupName: 'Welpen', price: 25_00 });

            const breakdown = breakDownBalanceItems([item, other], {
                balanceItemPayments: new Map([
                    [item.id, [createOnlinePaymentFor(60_00, { settlement: march }), createOnlinePaymentFor(40_00, { settlement: april })]],
                    [other.id, [createOnlinePaymentFor(25_00, { settlement: march })]],
                ]),
            });

            // The whole price is still what was charged, the payouts only hold what was received
            expect(breakdown.price).toBe(125_00);

            expect(breakdown.bySettlement.map(r => ({ name: r.name.toString(), price: r.price, count: r.count }))).toEqual([
                { name: '1234567.0312.01', price: 85_00, count: 2 },
                { name: '1234567.0409.01', price: 40_00, count: 1 },
            ]);

            // A payout holds money, not pieces: counting them would count the same item twice
            expect(breakdown.bySettlement.every(r => r.quantity === 0)).toBe(true);
        });

        test('money that was not received gets a row per status instead of a payout', () => {
            const item = createRegistration({ groupId: 'group-a', groupName: 'Kapoenen', price: 100_00 });

            const breakdown = breakDownBalanceItems([item], {
                balanceItemPayments: new Map([
                    [item.id, [
                        createOnlinePaymentFor(40_00, { settlement: march }),
                        createOnlinePaymentFor(30_00, { status: PaymentStatus.Pending }),
                        // A failed payment is never part of a payout, whatever it says
                        createOnlinePaymentFor(20_00, { status: PaymentStatus.Failed, settlement: april }),
                    ]],
                ]),
            });

            // Only the 20 euro that was tried sits under the failed payment: the 10 euro that is left
            // was never attempted
            expect(breakdown.bySettlement.map(r => ({ name: r.name.toString(), price: r.price }))).toEqual([
                { name: '1234567.0312.01', price: 40_00 },
                { name: $t('%1OL'), price: 30_00 },
                { name: $t('%ZjW'), price: 20_00 },
                { name: $t('%ZjC'), price: 10_00 },
            ]);

            // Every part of what was charged ends up in exactly one row
            expect(breakdown.bySettlement.reduce((total, r) => total + r.price, 0)).toBe(breakdown.price);
        });

        test('a failed attempt never absorbs more than what is still open', () => {
            const item = createRegistration({ groupId: 'group-a', groupName: 'Kapoenen', price: 100_00 });

            const breakdown = breakDownBalanceItems([item], {
                balanceItemPayments: new Map([
                    [item.id, [
                        createOnlinePaymentFor(60_00, { settlement: march }),
                        // Tried to pay the whole price again after a part of it already came in
                        createOnlinePaymentFor(100_00, { status: PaymentStatus.Failed }),
                    ]],
                ]),
            });

            expect(breakdown.bySettlement.map(r => ({ name: r.name.toString(), price: r.price }))).toEqual([
                { name: '1234567.0312.01', price: 60_00 },
                { name: $t('%ZjW'), price: 40_00 },
            ]);
            expect(breakdown.bySettlement.reduce((total, r) => total + r.price, 0)).toBe(breakdown.price);
        });

        test('what was paid for something that is not owed anymore is money to pay back', () => {
            const canceled = createRegistration({ groupId: 'group-a', groupName: 'Kapoenen', price: 50_00, status: BalanceItemStatus.Canceled });
            canceled.pricePaid = 50_00;

            const due = createRegistration({ groupId: 'group-b', groupName: 'Welpen', price: 25_00 });

            const breakdown = breakDownBalanceItems([canceled, due], {
                balanceItemPayments: new Map([
                    [canceled.id, [createOnlinePaymentFor(50_00, { settlement: march })]],
                ]),
            });

            // A canceled item is not charged anymore, so what came in for it has to go back
            const refund = breakdown.bySettlement.find(r => r.name.toString() === $t('%10b'))!;
            expect(refund.price).toBe(-50_00);
            expect(refund.selection!.filter).toEqual({ priceOpen: { $lt: 0 } });

            expect(breakdown.bySettlement.map(r => ({ name: r.name.toString(), price: r.price }))).toEqual([
                { name: '1234567.0312.01', price: 50_00 },
                { name: $t('%10b'), price: -50_00 },
                { name: $t('%1Ni'), price: 25_00 },
            ]);
            expect(breakdown.bySettlement.reduce((total, r) => total + r.price, 0)).toBe(breakdown.price);
        });

        test('what is still open is split over whether paying it was already tried', () => {
            const tried = createRegistration({ groupId: 'group-a', groupName: 'Kapoenen', price: 100_00 });
            const untried = createRegistration({ groupId: 'group-b', groupName: 'Welpen', price: 25_00 });

            const breakdown = breakDownBalanceItems([tried, untried], {
                balanceItemPayments: new Map([
                    // Two attempts of the whole price, both failed
                    [tried.id, [
                        createOnlinePaymentFor(100_00, { status: PaymentStatus.Failed }),
                        createOnlinePaymentFor(100_00, { status: PaymentStatus.Failed }),
                    ]],
                ]),
            });

            expect(breakdown.bySettlement.map(r => ({ name: r.name.toString(), price: r.price }))).toEqual([
                { name: $t('%ZjW'), price: 100_00 },
                { name: $t('%1Ni'), price: 25_00 },
            ]);

            expect(breakdown.bySettlement.reduce((total, r) => total + r.price, 0)).toBe(breakdown.price);
        });

        test('narrowing down to what is still being processed keeps only that part', () => {
            const paid = createRegistration({ groupId: 'group-a', groupName: 'Kapoenen', price: 40_00 });
            const processing = createRegistration({ groupId: 'group-b', groupName: 'Welpen', price: 25_00 });

            const balanceItemPayments = new Map([
                [paid.id, [createOnlinePaymentFor(40_00, { settlement: march })]],
                [processing.id, [createOnlinePaymentFor(25_00, { status: PaymentStatus.Pending })]],
            ]);

            const narrowed = breakDownBalanceItems([paid, processing], {
                balanceItemPayments,
                path: [BreakdownPathItem.create({ tab: BreakdownTab.Settlement, id: PENDING_PAYMENT_ID })],
            });

            expect(narrowed.balanceItemCount).toBe(1);
            expect(narrowed.price).toBe(25_00);
            expect(narrowed.byCategory.map(r => r.name.toString())).toEqual(['Welpen']);

            // The money itself is what these payments paid for these items
            expect(narrowed.selection.objectType).toBe(BreakdownObjectType.BalanceItemPayments);
            expect(narrowed.selection.filter).toEqual({
                payment: {
                    status: { $in: [PaymentStatus.Created, PaymentStatus.Pending] },
                },
            });

            // A list shows the balance items around it, selected through the payments because a
            // balance item doesn't know how it was paid
            expect(narrowed.selection.listFilter).toEqual({
                payments: {
                    $elemMatch: {
                        payment: {
                            status: { $in: [PaymentStatus.Created, PaymentStatus.Pending] },
                        },
                    },
                },
            });
        });

        test('narrowing down to a payout keeps only the money that was paid out there', () => {
            const item = createRegistration({ groupId: 'group-a', groupName: 'Kapoenen', price: 100_00 });
            const other = createRegistration({ groupId: 'group-b', groupName: 'Welpen', price: 25_00 });

            const balanceItemPayments = new Map([
                [item.id, [createOnlinePaymentFor(60_00, { settlement: march }), createOnlinePaymentFor(40_00, { settlement: april })]],
                [other.id, [createOnlinePaymentFor(25_00, { settlement: april })]],
            ]);

            const row = breakDownBalanceItems([item, other], { balanceItemPayments }).bySettlement.find(r => r.name.toString() === '1234567.0312.01')!;
            const narrowed = breakDownBalanceItems([item, other], {
                balanceItemPayments,
                path: [BreakdownPathItem.create({ tab: BreakdownTab.Settlement, id: row.id })],
            });

            // The amount the row showed, not what the item behind it was charged
            expect(narrowed.balanceItemCount).toBe(1);
            expect(narrowed.price).toBe(60_00);
            expect(narrowed.price).toBe(row.price);
            expect(narrowed.selection.amountType).toBe(BreakdownAmountType.Paid);

            // Everything below says the same thing about the same money
            expect(narrowed.byCategory.map(r => ({ name: r.name.toString(), price: r.price }))).toEqual([
                { name: 'Kapoenen', price: 60_00 },
            ]);

            // Only one part is left, so the payout tab would repeat the total above it
            expect(narrowed.bySettlement).toEqual([]);

            // The item is worth more than this, so the list behind it holds more
            expect(narrowed.selection.isListPartial).toBe(true);

            // The €60 itself is what this payment paid for this item, which is the only thing that
            // holds exactly that amount
            expect(narrowed.selection.objectType).toBe(BreakdownObjectType.BalanceItemPayments);
            expect(narrowed.selection.filter).toEqual({
                payment: {
                    $and: [
                        { status: PaymentStatus.Succeeded },
                        { provider: PaymentProvider.Mollie },
                        { settlement: { reference: '1234567.0312.01' } },
                        { settlement: { settledAt: march.settledAt } },
                    ],
                },
            });

            // A list shows the balance items around it, selected through the payments that paid for them
            expect(narrowed.selection.listObjectType).toBe(BreakdownObjectType.BalanceItems);
            expect(narrowed.selection.listFilter).toEqual({
                payments: {
                    $elemMatch: {
                        payment: {
                            $and: [
                                { status: PaymentStatus.Succeeded },
                                { provider: PaymentProvider.Mollie },
                                { settlement: { reference: '1234567.0312.01' } },
                                { settlement: { settledAt: march.settledAt } },
                            ],
                        },
                    },
                },
            });
        });

        test('nothing is broken down per payout when nothing was paid via a provider that pays out', () => {
            const item = createRegistration({ groupId: 'group-a', groupName: 'Kapoenen', price: 100_00 });

            const breakdown = breakDownBalanceItems([item], {
                balanceItemPayments: new Map([
                    [item.id, [BalanceItemPaymentWithPrivatePayment.create({
                        price: 100_00,
                        payment: PrivatePayment.create({ method: PaymentMethod.Transfer, status: PaymentStatus.Succeeded, price: 100_00 }),
                    })]],
                ]),
            });

            expect(breakdown.bySettlement).toEqual([]);
        });
    });

    describe('Grouping by article', () => {
        test('the same registration with a different price choice is a separate article', () => {
            const standard = createRegistration({ groupId: 'group-a', groupName: 'Kapoenen', priceName: 'Standaardtarief', price: 40_00 });
            const reduced = createRegistration({ groupId: 'group-a', groupName: 'Kapoenen', priceName: 'Verminderd tarief', price: 20_00 });

            const breakdown = breakDownPayments([[
                createPayment({ items: [[standard, 40_00], [reduced, 20_00]] }),
            ]]);

            // One category, but two articles
            expect(breakdown.byCategory).toHaveLength(1);
            expect(breakdown.byArticle.map(a => a.price)).toEqual([40_00, 20_00]);
        });

        test('identical registrations of different members are added together', () => {
            const first = createRegistration({ groupId: 'group-a', groupName: 'Kapoenen', price: 40_00, memberId: 'member-1' });
            const second = createRegistration({ groupId: 'group-a', groupName: 'Kapoenen', price: 40_00, memberId: 'member-2' });

            const breakdown = breakDownPayments([[
                createPayment({ items: [[first, 40_00], [second, 40_00]] }),
            ]]);

            expect(breakdown.byArticle).toHaveLength(1);
            expect(breakdown.byArticle[0].price).toBe(80_00);
            expect(breakdown.byArticle[0].quantity).toBe(2);

            // The members are not the same, so the row doesn't pretend it is only for one of them
            expect(breakdown.byArticle[0].relations.has(BalanceItemRelationType.Member)).toBe(false);
            expect(breakdown.byArticle[0].relations.get(BalanceItemRelationType.Group)?.id).toBe('group-a');
        });

        test('a member who pays less for the same article is not a separate row', () => {
            // Same group and same price choice, but one member gets a reduced tariff
            const full = createRegistration({ groupId: 'group-a', groupName: 'Kapoenen', priceName: 'Standaardtarief', price: 40_00, memberId: 'member-1' });
            const reduced = createRegistration({ groupId: 'group-a', groupName: 'Kapoenen', priceName: 'Standaardtarief', price: 15_00, memberId: 'member-2' });

            const breakdown = breakDownPayments([[
                createPayment({ items: [[full, 40_00], [reduced, 15_00]] }),
            ]]);

            expect(breakdown.byArticle).toHaveLength(1);
            expect(breakdown.byArticle[0].price).toBe(55_00);
            expect(breakdown.byArticle[0].quantity).toBe(2);
        });

        test('an option that was bought for a registration is its own article in the same category', () => {
            const registration = createRegistration({ groupId: 'group-a', groupName: 'Kapoenen', price: 40_00, memberId: 'member-1' });
            const shirt = createRegistration({ groupId: 'group-a', groupName: 'Kapoenen', price: 15_00, memberId: 'member-1', option: { menu: 'T-shirt', name: 'Maat M' } });

            const breakdown = breakDownPayments([[
                createPayment({ items: [[registration, 40_00], [shirt, 15_00]] }),
            ]]);

            expect(breakdown.byCategory.map(r => ({ name: r.name.toString(), price: r.price }))).toEqual([
                { name: 'Kapoenen', price: 55_00 },
            ]);

            expect(breakdown.byArticle.map(r => ({ name: r.name.toString(), price: r.price }))).toEqual([
                { name: expect.stringContaining('Kapoenen'), price: 40_00 },
                { name: 'T-shirt: Maat M', price: 15_00 },
            ]);
        });

        test('a row keeps the relations everything in it has in common', () => {
            const first = createRegistration({ groupId: 'group-a', groupName: 'Kapoenen', priceName: 'Verminderd tarief', price: 20_00, memberId: 'member-1' });
            const second = createRegistration({ groupId: 'group-a', groupName: 'Kapoenen', priceName: 'Verminderd tarief', price: 20_00, memberId: 'member-1' });

            const breakdown = breakDownPayments([[createPayment({ items: [[first, 20_00], [second, 20_00]] })]]);

            expect(breakdown.byArticle).toHaveLength(1);
            expect(breakdown.byArticle[0].relations.get(BalanceItemRelationType.Member)?.id).toBe('member-1');
            expect(breakdown.byArticle[0].relations.get(BalanceItemRelationType.GroupPrice)?.name.toString()).toBe('Verminderd tarief');
        });
    });

    describe('Reading the payments in pages', () => {
        test('the totals are the same no matter how the payments are split up', () => {
            const first = createRegistration({ groupId: 'group-a', groupName: 'Kapoenen', price: 40_00, memberId: 'member-1' });
            const second = createRegistration({ groupId: 'group-a', groupName: 'Kapoenen', price: 40_00, memberId: 'member-2' });
            const order = createOrder({ webshopId: 'shop-a', webshopName: 'Wafelverkoop', price: 15_00 });

            const payments = [
                createPayment({ items: [[first, 40_00]] }),
                createPayment({ items: [[second, 20_00]] }),
                createPayment({ items: [[second, 20_00], [order, 15_00]] }),
            ];

            const inOnePage = breakDownPayments([payments]);
            const inThreePages = breakDownPayments(payments.map(payment => [payment]));

            expect(inThreePages.encode({ version: 0 })).toEqual(inOnePage.encode({ version: 0 }));
            expect(inThreePages.price).toBe(95_00);
            expect(inThreePages.paymentCount).toBe(3);

            // Two registrations and one order, even though the second registration was paid twice
            expect(inThreePages.byArticle.reduce((total, row) => total + row.quantity, 0)).toBe(3);
        });
    });

    describe('Breaking down what was charged', () => {
        test('sums the charged price and quantity per category', () => {
            const breakdown = breakDownBalanceItems([
                createRegistration({ groupId: 'group-a', groupName: 'Kapoenen', price: 40_00, quantity: 2 }),
                createRegistration({ groupId: 'group-a', groupName: 'Kapoenen', price: 40_00 }),
                createOrder({ webshopId: 'shop-a', webshopName: 'Wafelverkoop', price: 15_00 }),
            ]);

            expect(breakdown.price).toBe(135_00);
            expect(breakdown.balanceItemCount).toBe(3);
            expect(breakdown.byCategory.map(r => ({ name: r.name.toString(), price: r.price, quantity: r.quantity, count: r.count }))).toEqual([
                { name: 'Kapoenen', price: 120_00, quantity: 3, count: 2 },
                { name: 'Wafelverkoop', price: 15_00, quantity: 1, count: 1 },
            ]);
        });

        test('canceled items do not count as charged', () => {
            const breakdown = breakDownBalanceItems([
                createRegistration({ groupId: 'group-a', groupName: 'Kapoenen', price: 40_00 }),
                createRegistration({ groupId: 'group-a', groupName: 'Kapoenen', price: 999_00, status: BalanceItemStatus.Canceled }),
            ]);

            expect(breakdown.price).toBe(40_00);
            expect(breakdown.byCategory).toHaveLength(1);
            expect(breakdown.byCategory[0].price).toBe(40_00);
            expect(breakdown.byCategory[0].quantity).toBe(1);
        });

        test('groups by article across members', () => {
            const breakdown = breakDownBalanceItems([
                createRegistration({ groupId: 'group-a', groupName: 'Kapoenen', priceName: 'Standaardtarief', price: 40_00, memberId: 'member-1' }),
                createRegistration({ groupId: 'group-a', groupName: 'Kapoenen', priceName: 'Standaardtarief', price: 40_00, memberId: 'member-2' }),
                createRegistration({ groupId: 'group-a', groupName: 'Kapoenen', priceName: 'Verminderd tarief', price: 20_00, memberId: 'member-3' }),
            ]);

            expect(breakdown.byArticle.map(r => ({ price: r.price, quantity: r.quantity }))).toEqual([
                { price: 80_00, quantity: 2 },
                { price: 20_00, quantity: 1 },
            ]);
        });
    });

    describe('What came in over time', () => {
        /**
         * A payment that was received on a day, at noon in Brussels.
         */
        function createPaymentOn(day: string, price: number) {
            const payment = createPayment({ items: [[createRegistration({ groupId: 'group-a', groupName: 'Kapoenen', price }), price]] });
            payment.paidAt = Formatter.luxon(new Date()).set({ hour: 12, minute: 0, second: 0, millisecond: 0 }).setZone(Formatter.timezone).set({
                year: parseInt(day.substring(0, 4)),
                month: parseInt(day.substring(5, 7)),
                day: parseInt(day.substring(8, 10)),
            }).toJSDate();

            return payment;
        }

        test('a selection of a few days is one point per day', () => {
            const breakdown = breakDownPayments([[
                createPaymentOn('2026-03-02', 40_00),
                createPaymentOn('2026-03-02', 20_00),
                createPaymentOn('2026-03-05', 25_00),
            ]]);

            // Only the days something came in: the days in between are added again where it is drawn
            expect(breakdown.graph.unit).toBe(BreakdownGraphUnit.Day);
            expect(breakdown.graph.points.map(p => ({ day: Formatter.dateIso(p.date), price: p.price }))).toEqual([
                { day: '2026-03-02', price: 60_00 },
                { day: '2026-03-05', price: 25_00 },
            ]);

            expect(breakdown.graph.filledPoints.map(p => ({ day: Formatter.dateIso(p.date), price: p.price }))).toEqual([
                { day: '2026-03-02', price: 60_00 },
                { day: '2026-03-03', price: 0 },
                { day: '2026-03-04', price: 0 },
                { day: '2026-03-05', price: 25_00 },
            ]);
        });

        test('a selection of more than a month is one point per week, starting on a monday', () => {
            const breakdown = breakDownPayments([[
                createPaymentOn('2026-03-04', 40_00),
                createPaymentOn('2026-03-06', 20_00),
                createPaymentOn('2026-05-11', 25_00),
            ]]);

            expect(breakdown.graph.unit).toBe(BreakdownGraphUnit.Week);

            const points = breakdown.graph.points;
            expect(Formatter.dateIso(points[0].date)).toBe('2026-03-02');
            expect(points[0].price).toBe(60_00);
            expect(points).toHaveLength(2);

            // Every week in between is added when it is drawn, so the graph doesn't jump over them
            const filled = breakdown.graph.filledPoints;
            expect(filled).toHaveLength(11);
            expect(filled[filled.length - 1].price).toBe(25_00);
            expect(filled.reduce((total, point) => total + point.price, 0)).toBe(85_00);
        });

        test('a day is counted in the timezone of the app, not in UTC', () => {
            const payment = createPayment({ items: [[createRegistration({ groupId: 'group-a', groupName: 'Kapoenen', price: 40_00 }), 40_00]] });
            // 23:30 in Brussels on the 2nd, which is the 2nd in UTC as well, but 00:30 on the 3rd in Kiev
            payment.paidAt = Formatter.luxon(new Date()).setZone('Europe/Brussels').set({
                year: 2026, month: 3, day: 2, hour: 23, minute: 30, second: 0, millisecond: 0,
            }).toJSDate();

            const breakdown = breakDownPayments([[payment]]);

            expect(breakdown.graph.points).toHaveLength(1);
            expect(Formatter.dateIso(breakdown.graph.points[0].date)).toBe('2026-03-02');
        });

        test('what was charged is counted on the day it was charged', () => {
            const first = createRegistration({ groupId: 'group-a', groupName: 'Kapoenen', price: 40_00 });
            first.createdAt = Formatter.luxon(new Date()).set({ year: 2026, month: 3, day: 2, hour: 12, minute: 0, second: 0, millisecond: 0 }).toJSDate();

            const second = createRegistration({ groupId: 'group-a', groupName: 'Kapoenen', price: 25_00 });
            second.createdAt = Formatter.luxon(new Date()).set({ year: 2026, month: 3, day: 4, hour: 12, minute: 0, second: 0, millisecond: 0 }).toJSDate();

            const breakdown = breakDownBalanceItems([first, second]);

            expect(breakdown.graph.points.map(p => ({ day: Formatter.dateIso(p.date), price: p.price }))).toEqual([
                { day: '2026-03-02', price: 40_00 },
                { day: '2026-03-04', price: 25_00 },
            ]);
        });
    });

    describe('Narrowing down to one group', () => {
        test('a category and an article have to be the same balance item, not two', () => {
            const kapoenen = createRegistration({ groupId: 'group-a', groupName: 'Kapoenen', price: 60_00 });
            const welpen = createRegistration({ groupId: 'group-b', groupName: 'Welpen', price: 40_00 });

            // One payment that paid for both groups
            const payments = [createPayment({ items: [[kapoenen, 60_00], [welpen, 40_00]] })];

            const category = breakDownPayments([payments]).byCategory.find(r => r.name.toString() === 'Kapoenen')!;
            const inCategory = breakDownPayments([payments], {
                path: [BreakdownPathItem.create({ tab: BreakdownTab.Category, id: category.id })],
            });
            const article = inCategory.byArticle[0];

            const narrowed = breakDownPayments([payments], {
                path: [
                    BreakdownPathItem.create({ tab: BreakdownTab.Category, id: category.id }),
                    BreakdownPathItem.create({ tab: BreakdownTab.Article, id: article.id }),
                ],
            });

            expect(narrowed.price).toBe(60_00);

            // One balance item payment has to satisfy both steps at once: a payment that paid for
            // something in this category and for something else that is this article paid for neither
            expect(narrowed.selection.filter).toEqual({
                balanceItem: {
                    $and: [kapoenen.categoryFilter, kapoenen.articleFilter],
                },
            });

            // A list shows the payments around it, which is the same requirement in one $elemMatch
            expect(narrowed.selection.listFilter).toEqual({
                balanceItemPayments: {
                    $elemMatch: {
                        balanceItem: {
                            $and: [kapoenen.categoryFilter, kapoenen.articleFilter],
                        },
                    },
                },
            });
        });

        test('keeps only the part of a payment that belongs to that group', () => {
            const registration = createRegistration({ groupId: 'group-a', groupName: 'Kapoenen', price: 60_00 });
            const order = createOrder({ webshopId: 'shop-a', webshopName: 'Wafelverkoop', price: 40_00 });

            const payments = [createPayment({ items: [[registration, 60_00], [order, 40_00]] })];
            const webshopRow = breakDownPayments([payments]).byCategory.find(r => r.name.toString() === 'Wafelverkoop')!;

            const narrowed = breakDownPayments([payments], {
                path: [BreakdownPathItem.create({ tab: BreakdownTab.Category, id: webshopRow.id })],
                filter: { organizationId: 'org' },
            });

            expect(narrowed.price).toBe(40_00);
            expect(narrowed.byCategory).toHaveLength(1);

            // The whole payment paid for more than what is shown
            expect(narrowed.selection.isListPartial).toBe(true);

            // The €40 itself is what this payment paid for the webshop order, so the export holds
            // exactly that instead of the €100 payment around it
            const webshopItem = {
                $and: [
                    { type: BalanceItemType.Order },
                    { relations: { [BalanceItemRelationType.Webshop]: { id: 'shop-a' } } },
                ],
            };

            expect(narrowed.selection.objectType).toBe(BreakdownObjectType.BalanceItemPayments);
            expect(narrowed.selection.filter).toEqual({
                $and: [
                    { payment: { organizationId: 'org' } },
                    { balanceItem: webshopItem },
                ],
            });

            // The list shows the payment as a whole: it contains at least one matching balance item
            expect(narrowed.selection.listObjectType).toBe(BreakdownObjectType.Payments);
            expect(narrowed.selection.listFilter).toEqual({
                $and: [
                    { organizationId: 'org' },
                    { balanceItemPayments: { $elemMatch: { balanceItem: webshopItem } } },
                ],
            });
        });

        test('a row that holds a part of its payments can be opened, so that part can be exported', () => {
            const kapoenen = createRegistration({ groupId: 'group-a', groupName: 'Kapoenen', price: 60_00 });
            const welpen = createRegistration({ groupId: 'group-b', groupName: 'Welpen', price: 40_00 });

            const builder = new PaymentBreakdownBuilder();
            builder.add([createPayment({ items: [[kapoenen, 60_00], [welpen, 40_00]] })]);

            const breakdown = builder.build();

            // An article is the deepest level, so it normally only leads to a list of its payments. The
            // amount of a row that holds a part of them only exists as a breakdown of its own
            const article = breakdown.byArticle.find(g => g.name.toString().includes('Kapoenen'))!;
            expect(article.selection!.isListPartial).toBe(true);
            expect(article.canNarrowDown).toBe(true);

            // Nothing was split here, so this one still leads straight to the list
            const whole = new PaymentBreakdownBuilder();
            whole.add([createPayment({ items: [[kapoenen, 60_00]] })]);

            const single = whole.build().byArticle[0];
            expect(single.selection!.isListPartial).toBe(false);
            expect(single.canNarrowDown).toBe(false);
        });

        test('narrowing down to an account keeps a plain payment filter', () => {
            const item = createRegistration({ groupId: 'group-a', groupName: 'Kapoenen', price: 100_00 });

            const payments = [
                createPayment({ items: [[item, 30_00]], method: PaymentMethod.PointOfSale }),
                createPayment({ items: [[item, 20_00]], method: PaymentMethod.Transfer }),
            ];

            const row = breakDownPayments([payments]).byAccount.find(r => r.price === 20_00)!;
            const narrowed = breakDownPayments([payments], {
                path: [BreakdownPathItem.create({ tab: BreakdownTab.Account, id: row.id })],
            });

            expect(narrowed.price).toBe(20_00);
            expect(narrowed.paymentCount).toBe(1);
            expect(narrowed.selection.filter).toEqual({
                method: PaymentMethod.Transfer,
                provider: null,
                // Transfers to a known bank account are their own group. An account number that was
                // never filled in is stored as null by some payments and as an empty string by others.
                transferSettings: {
                    iban: { $in: [null, ''] },
                    creditor: { $in: [null, ''] },
                },
            });
        });

        test('narrowing down what was charged selects the same category', () => {
            const items = [
                createRegistration({ groupId: 'group-a', groupName: 'Kapoenen', price: 40_00 }),
                createOrder({ webshopId: 'shop-a', webshopName: 'Wafelverkoop', price: 15_00 }),
            ];

            const row = breakDownBalanceItems(items).byCategory.find(r => r.name.toString() === 'Kapoenen')!;
            const narrowed = breakDownBalanceItems(items, {
                path: [BreakdownPathItem.create({ tab: BreakdownTab.Category, id: row.id })],
            });

            expect(narrowed.price).toBe(40_00);
            expect(narrowed.selection.filter).toEqual({
                $and: [
                    { type: BalanceItemType.Registration },
                    { relations: { [BalanceItemRelationType.Group]: { id: 'group-a' } } },
                ],
            });
        });

        test('a group that turned out to hold nothing selects nothing, not everything', () => {
            const item = createRegistration({ groupId: 'group-a', groupName: 'Kapoenen', price: 40_00 });
            const filter: StamhoofdFilter = { organizationId: 'org-1' };
            const path = [BreakdownPathItem.create({ tab: BreakdownTab.Category, id: 'gone' })];

            // A group can empty out between the moment it was shown and the moment it was opened
            const payments = breakDownPayments([[createPayment({ items: [[item, 40_00]] })]], { filter, path });
            expect(payments.price).toBe(0);
            expect(payments.selection.filter).toEqual({ id: { $in: [] } });

            const balanceItems = breakDownBalanceItems([item], { filter, path });
            expect(balanceItems.price).toBe(0);
            expect(balanceItems.selection.filter).toEqual({ id: { $in: [] } });
        });
    });

    describe('Money that never arrived', () => {
        test('a deduction from another balance is not money that came in', () => {
            const item = createRegistration({ groupId: 'group-a', groupName: 'Kapoenen', price: 100_00 });

            const breakdown = breakDownPayments([[
                createPayment({ items: [[item, 40_00]], method: PaymentMethod.Transfer }),
                createPayment({ items: [[item, 10_00]], method: PaymentMethod.AccountDeductions }),
            ]]);

            expect(breakdown.bySettlement.map(r => ({ name: r.name.toString(), price: r.price }))).toEqual([
                { name: $t('%ZjN'), price: 40_00 },
                { name: PaymentMethodHelper.getNameCapitalized(PaymentMethod.AccountDeductions), price: 10_00 },
            ]);

            // The two rows stay apart: what arrived outside a payment provider never holds a deduction
            const offline = breakdown.bySettlement[0].selection!.filter as { $and: { method?: { $in: PaymentMethod[] } }[] };
            expect(offline.$and[1].method!.$in).not.toContain(PaymentMethod.AccountDeductions);
        });

        test('the part of a selection that was never received is counted apart', () => {
            const item = createRegistration({ groupId: 'group-a', groupName: 'Kapoenen', price: 100_00 });

            const breakdown = breakDownPayments([[
                createPayment({ items: [[item, 40_00]] }),
                createPayment({ items: [[item, 30_00]], status: PaymentStatus.Pending }),
                createPayment({ items: [[item, 10_00]], status: PaymentStatus.Created }),
                createPayment({ items: [[item, 20_00]], status: PaymentStatus.Failed }),
            ]]);

            expect(breakdown.price).toBe(100_00);
            expect(breakdown.pricePending).toBe(40_00);
            expect(breakdown.priceFailed).toBe(20_00);
        });

        test('nothing is pending or failed when every payment succeeded', () => {
            const item = createRegistration({ groupId: 'group-a', groupName: 'Kapoenen', price: 40_00 });
            const breakdown = breakDownPayments([[createPayment({ items: [[item, 40_00]] })]]);

            expect(breakdown.pricePending).toBe(0);
            expect(breakdown.priceFailed).toBe(0);
        });
    });

    describe('Naming what a row holds', () => {
        test('an order that was paid in parts is not a changed order', () => {
            const { balanceItem, orders } = createWebshopOrder({ webshopId: 'shop-a', webshopName: 'Wafelverkoop', unitPrice: 15_00, amount: 2 });

            const partial = breakDownPayments([[createPayment({ items: [[balanceItem, 10_00]] })]], { orders });
            expect(partial.byArticle.map(r => ({ name: r.name.toString(), price: r.price }))).toEqual([
                { name: $t('%Zjb'), price: 10_00 },
            ]);

            // More than the order costs can only mean the order changed after it was paid
            const changed = breakDownPayments([[createPayment({ items: [[balanceItem, 40_00]] })]], { orders });
            expect(changed.byArticle.map(r => r.name.toString())).toEqual([$t('%Zik')]);

            const refunded = breakDownPayments([[createPayment({ items: [[balanceItem, -5_00]] })]], { orders });
            expect(refunded.byArticle.map(r => r.name.toString())).toEqual([$t('%ZjK')]);
        });

        test('what was charged for an order can never be a partial payment', () => {
            const { balanceItem, orders } = createWebshopOrder({ webshopId: 'shop-a', webshopName: 'Wafelverkoop', unitPrice: 15_00, amount: 2 });

            // Charged less than the order costs, which is a changed order and not an instalment
            balanceItem.unitPrice = 20_00;

            const breakdown = breakDownBalanceItems([balanceItem], { orders });
            expect(breakdown.byArticle.map(r => ({ name: r.name.toString(), price: r.price }))).toEqual([
                { name: $t('%Zik'), price: 20_00 },
            ]);
        });

        test('two categories with the same name say which kind of item they hold', () => {
            const registration = createRegistration({ groupId: 'group-a', groupName: 'Kapoenen', price: 40_00 });
            const cancellationFee = BalanceItem.create({
                type: BalanceItemType.CancellationFee,
                amount: 1,
                unitPrice: 5_00,
                relations: new Map([
                    [BalanceItemRelationType.Group, BalanceItemRelation.create({ id: 'group-a', name: new TranslatedString('Kapoenen') })],
                ]),
            });

            const breakdown = breakDownBalanceItems([registration, cancellationFee]);

            expect(breakdown.byCategory.map(r => ({ name: r.name.toString(), description: r.description }))).toEqual([
                { name: 'Kapoenen', description: getBalanceItemTypeName(BalanceItemType.Registration) },
                { name: expect.stringContaining('Kapoenen'), description: getBalanceItemTypeName(BalanceItemType.CancellationFee) },
            ]);

            expect(breakdown.byCategory[0].id).not.toBe(breakdown.byCategory[1].id);
        });
    });

    describe('Keeping the number of rows readable', () => {
        /**
         * A one-off correction has no relations, so every description is a category of its own.
         */
        function createCorrection(index: number) {
            return BalanceItem.create({
                type: BalanceItemType.Other,
                description: 'Correctie ' + index,
                amount: 1,
                unitPrice: (200 - index) * 100,
            });
        }

        test('everything below the biggest rows is added together in one row at the end', () => {
            const items = Array.from({ length: 150 }, (_, index) => createCorrection(index));
            const breakdown = breakDownBalanceItems(items);

            expect(breakdown.byCategory).toHaveLength(100);

            const last = breakdown.byCategory[99];
            expect(last.name.toString()).toBe($t('%mV'));
            expect(last.canNarrowDown).toBe(false);
            expect(last.selection).toBeNull();

            // The tab still adds up to the total above it
            expect(breakdown.byCategory.reduce((total, r) => total + r.price, 0)).toBe(breakdown.price);

            // The biggest amounts are still on top, so the rolled up row is genuinely the tail
            expect(breakdown.byCategory[0].price).toBeGreaterThan(breakdown.byCategory[98].price);
            expect(last.price).toBe(items.slice(99).reduce((total, item) => total + item.priceWithVAT, 0));
        });

        test('nothing is rolled up as long as the rows fit', () => {
            const breakdown = breakDownBalanceItems(Array.from({ length: 100 }, (_, index) => createCorrection(index)));

            expect(breakdown.byCategory).toHaveLength(100);
            expect(breakdown.byCategory.every(r => r.name.toString() !== $t('%mV'))).toBe(true);
        });
    });

    /**
     * What has to hold for every row of every tab, whatever it groups by, so a tab that is added later
     * is either right or fails here.
     */
    describe('What a row promises', () => {
        const payoutTabs = [BreakdownTab.Category, BreakdownTab.Article, BreakdownTab.Settlement];

        /**
         * A registration paid over two payouts, one that is still open, and a payment that paid for two
         * things at once: every kind of row a breakdown can build.
         */
        function createMixedBalanceItems() {
            const march = createSettlement({ reference: '1234567.0312.01', settledAt: '2026-03-12T09:00:00.000Z' });
            const april = createSettlement({ reference: '1234567.0409.01', settledAt: '2026-04-09T09:00:00.000Z' });

            const split = createRegistration({ groupId: 'group-a', groupName: 'Kapoenen', price: 100_00 });
            const open = createRegistration({ groupId: 'group-b', groupName: 'Welpen', price: 25_00 });
            const pending = createRegistration({ groupId: 'group-c', groupName: 'Jonggivers', price: 40_00 });

            return {
                items: [split, open, pending],
                balanceItemPayments: new Map([
                    [split.id, [createOnlinePaymentFor(60_00, { settlement: march }), createOnlinePaymentFor(40_00, { settlement: april })]],
                    [pending.id, [createOnlinePaymentFor(40_00, { status: PaymentStatus.Pending })]],
                ]),
            };
        }

        function getRows(breakdown: { byCategory: BreakdownGroup[]; byArticle: BreakdownGroup[]; bySettlement: BreakdownGroup[] }, tab: BreakdownTab): BreakdownGroup[] {
            switch (tab) {
                case BreakdownTab.Article: return breakdown.byArticle;
                case BreakdownTab.Settlement: return breakdown.bySettlement;
                default: return breakdown.byCategory;
            }
        }

        test.each(payoutTabs)('every row of the %s tab measures what it opens', (tab) => {
            const { items, balanceItemPayments } = createMixedBalanceItems();
            const breakdown = breakDownBalanceItems(items, { balanceItemPayments });
            const rows = getRows(breakdown, tab).filter(row => row.selection !== null);

            expect(rows.length).toBeGreaterThan(0);

            const measured = rows.map((row) => {
                const narrowed = breakDownBalanceItems(items, {
                    balanceItemPayments,
                    path: [BreakdownPathItem.create({ tab, id: row.id })],
                });

                return {
                    row: row.name.toString(),
                    price: row.price,
                    // The page a row opens reports the same money under the same measure
                    measured: getMeasuredAmount(narrowed, row.selection!.amountType),
                    amountType: row.selection!.amountType,
                    pageAmountType: narrowed.selection.amountType,
                    // A row that holds everything of its items opens a page that says the same
                    isListPartial: row.selection!.isListPartial,
                    pageIsListPartial: narrowed.selection.isListPartial,
                };
            });

            for (const row of measured) {
                expect(row).toEqual({
                    ...row,
                    measured: row.price,
                    pageAmountType: row.amountType,
                    pageIsListPartial: row.isListPartial,
                });
            }
        });

        test.each(payoutTabs)('the %s tab adds up to the total above it, also after narrowing down', (tab) => {
            const { items, balanceItemPayments } = createMixedBalanceItems();
            const breakdown = breakDownBalanceItems(items, { balanceItemPayments });

            for (const row of getRows(breakdown, tab)) {
                if (!row.canNarrowDown) {
                    continue;
                }

                const narrowed = breakDownBalanceItems(items, {
                    balanceItemPayments,
                    path: [BreakdownPathItem.create({ tab, id: row.id })],
                });

                // Opening a row shows the amount that row showed, not what the objects behind it hold
                expect({ row: row.name.toString(), price: narrowed.price }).toEqual({ row: row.name.toString(), price: row.price });

                // And every tab below it still explains that amount
                for (const narrowedTab of payoutTabs) {
                    const rows = getRows(narrowed, narrowedTab);

                    if (rows.length === 0) {
                        continue;
                    }

                    expect(rows.reduce((total, r) => total + r.price, 0)).toBe(narrowed.price);
                }
            }
        });

        /**
         * What a breakdown reports under one measure, which is what a row that holds that measure
         * promises to be worth.
         */
        function getMeasuredAmount(breakdown: BalanceItemBreakdown, amountType: BreakdownAmountType): number {
            switch (amountType) {
                case BreakdownAmountType.Paid: return breakdown.pricePaid;
                case BreakdownAmountType.Pending: return breakdown.pricePending;
                case BreakdownAmountType.Open: return breakdown.priceOpen;
                default: return breakdown.price;
            }
        }
    });
});
