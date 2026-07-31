import { TestUtils } from '@stamhoofd/test-utils';
import type { StamhoofdFilter } from './filters/StamhoofdFilter.js';
import { BalanceItem, BalanceItemPaymentWithPrivatePayment, BalanceItemRelation, BalanceItemRelationType, BalanceItemStatus, BalanceItemType } from './BalanceItem.js';
import { BalanceItemPaymentDetailed } from './BalanceItemDetailed.js';
import { PrivatePayment, Settlement } from './members/Payment.js';
import { PaymentGeneral } from './members/PaymentGeneral.js';
import { PaymentMethod, PaymentMethodHelper } from './PaymentMethod.js';
import { getPaymentProviderName, PaymentProvider } from './PaymentProvider.js';
import { PaymentStatus } from './PaymentStatus.js';
import { Formatter } from '@stamhoofd/utility';
import { BreakdownGraphUnit, BreakdownPathItem, BreakdownTab } from './PaymentBreakdown.js';
import { BalanceItemBreakdownBuilder, PaymentBreakdownBuilder } from './PaymentBreakdownBuilder.js';
import { PENDING_PAYMENT_ID } from './PaymentSettlement.js';
import { StripeAccount, StripeBusinessProfile, StripeMetaData } from './StripeAccount.js';
import { TransferSettings } from './webshops/TransferSettings.js';
import { TranslatedString } from './TranslatedString.js';

describe('Payment breakdown', () => {
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

    function createPayment({ items, method = PaymentMethod.Transfer, provider = null, transferSettings = null, stripeAccountId = null, settlement = null, status = PaymentStatus.Succeeded, roundingAmount = 0 }: {
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
    }) {
        return PaymentGeneral.create({
            method,
            provider,
            transferSettings,
            stripeAccountId,
            settlement,
            status,
            roundingAmount,
            price: items.reduce((total, [_, price]) => total + price, 0) + roundingAmount,
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
    function breakDownPayments(pages: PaymentGeneral[][], options: { path?: BreakdownPathItem[]; stripeAccounts?: StripeAccount[]; filter?: StamhoofdFilter } = {}) {
        const builder = new PaymentBreakdownBuilder(options.path ?? []);

        for (const page of pages) {
            builder.add(page, { stripeAccounts: options.stripeAccounts ?? [] });
        }

        return builder.build(options.filter ?? null);
    }

    function breakDownBalanceItems(items: BalanceItem[], options: { path?: BreakdownPathItem[]; filter?: StamhoofdFilter; balanceItemPayments?: Map<string, BalanceItemPaymentWithPrivatePayment[]> } = {}) {
        const builder = new BalanceItemBreakdownBuilder(options.path ?? []);
        builder.add(items, { balanceItemPayments: options.balanceItemPayments });
        return builder.build(options.filter ?? null);
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
            expect(breakdown.isPartial).toBe(false);
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
            expect(breakdown.isPartial).toBe(false);

            // What it was for holds what was charged, plus a row for what was rounded away
            expect(breakdown.byCategory.map(r => ({ name: r.name.toString(), price: r.price }))).toEqual([
                { name: 'Kapoenen', price: 12_1234 },
                { name: 'Welpen', price: 10_00 },
                { name: $t('Afronding'), price: -34 },
            ]);
            expect(breakdown.byArticle.map(r => r.price)).toEqual([12_1234, 10_00, -34]);
            expect(breakdown.byArticle[2].name.toString()).toBe($t('Afronding'));

            // It arrived on the same account and in the same payout as the rest of the payment, so
            // those tabs hold what the bank account actually saw
            expect(breakdown.byAccount.map(r => r.price)).toEqual([12_1200, 10_00]);
            expect(breakdown.bySettlement.map(r => ({ name: r.name.toString(), price: r.price }))).toEqual([
                { name: '1234567.0312.01', price: 12_1200 },
                { name: $t('Niet online betaald'), price: 10_00 },
            ]);

            // It is not for one thing in particular, so it can't be opened
            const rounding = breakdown.byArticle.find(r => r.id === 'rounding')!;
            expect(rounding.canNarrowDown).toBe(false);
            expect(rounding.filter).toBeNull();
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
            expect(byAccount.isPartial).toBe(false);

            const category = breakDownPayments([payments]).byCategory.find(r => r.name.toString() === 'Kapoenen')!;
            const byCategory = breakDownPayments([payments], {
                path: [BreakdownPathItem.create({ tab: BreakdownTab.Category, id: category.id })],
            });

            // But it is not part of what was paid for, so only a part of the payment is left
            expect(byCategory.price).toBe(12_1234);
            expect(byCategory.isPartial).toBe(true);
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
            expect(breakdown.byAccount[0].filter).toEqual({
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
            expect(breakdown.bySettlement[0].filter).toMatchObject({ $and: expect.arrayContaining([{ provider: PaymentProvider.Mollie }]) });
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
                { name: $t('Niet online betaald'), price: 35_00 },
                { name: $t('Nog niet uitbetaald'), price: 30_00 },
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
                { name: $t('Nog niet uitbetaald'), price: 40_00 },
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
                { name: $t('In verwerking'), price: 30_00 },
                { name: $t('Mislukte betaling'), price: 25_00 },
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
            expect(narrowed.exportFilter).toEqual({
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

            // What is still open sits under the failed payment that tried to cover it, whatever that
            // payment was worth: it is owed once, not once per attempt
            expect(breakdown.bySettlement.map(r => ({ name: r.name.toString(), price: r.price }))).toEqual([
                { name: '1234567.0312.01', price: 40_00 },
                { name: $t('In verwerking'), price: 30_00 },
                { name: $t('Mislukte betaling'), price: 30_00 },
            ]);

            // Every part of what was charged ends up in exactly one row
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
                { name: $t('Mislukte betaling'), price: 100_00 },
                { name: $t('Openstaand'), price: 25_00 },
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

            // Selected through the payments, because a balance item doesn't know how it was paid
            expect(narrowed.exportFilter).toEqual({
                payments: {
                    $elemMatch: {
                        payment: {
                            status: { $in: [PaymentStatus.Created, PaymentStatus.Pending] },
                        },
                    },
                },
            });
        });

        test('narrowing down to a payout keeps the part that was paid out there', () => {
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

            // Only the balance item that was part of this payout is left, at the price it was charged
            expect(narrowed.balanceItemCount).toBe(1);
            expect(narrowed.price).toBe(100_00);
            expect(narrowed.byCategory.map(r => r.name.toString())).toEqual(['Kapoenen']);

            // The payout tab keeps every part of that item, so it still explains the price above it
            expect(narrowed.bySettlement.map(r => ({ name: r.name.toString(), price: r.price }))).toEqual([
                { name: '1234567.0312.01', price: 60_00 },
                { name: '1234567.0409.01', price: 40_00 },
            ]);
            expect(narrowed.bySettlement.reduce((total, r) => total + r.price, 0)).toBe(narrowed.price);

            // A balance item is selected through the payments that paid for it
            expect(narrowed.exportFilter).toEqual({
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

            // Both steps end up in the same $elemMatch: a payment that paid for something in this
            // category and for something else that is this article paid for neither
            expect(narrowed.exportFilter).toEqual({
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
            expect(narrowed.isPartial).toBe(true);

            // The payment is exported as a whole: it contains at least one matching balance item
            expect(narrowed.exportFilter).toEqual({
                $and: [
                    { organizationId: 'org' },
                    {
                        balanceItemPayments: {
                            $elemMatch: {
                                balanceItem: {
                                    $and: [
                                        { type: BalanceItemType.Order },
                                        { relations: { [BalanceItemRelationType.Webshop]: { id: 'shop-a' } } },
                                    ],
                                },
                            },
                        },
                    },
                ],
            });
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
            expect(narrowed.exportFilter).toEqual({
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
            expect(narrowed.exportFilter).toEqual({
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
            expect(payments.exportFilter).toEqual({ id: { $in: [] } });

            const balanceItems = breakDownBalanceItems([item], { filter, path });
            expect(balanceItems.price).toBe(0);
            expect(balanceItems.exportFilter).toEqual({ id: { $in: [] } });
        });
    });
});
