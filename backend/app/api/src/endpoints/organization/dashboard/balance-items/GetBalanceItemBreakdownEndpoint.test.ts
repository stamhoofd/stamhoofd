import { Request } from '@simonbackx/simple-endpoints';
import type { BalanceItem, Organization, User } from '@stamhoofd/models';
import { BalanceItemFactory, BalanceItemPayment, OrderFactory, OrganizationFactory, Payment, Token, UserFactory, WebshopFactory } from '@stamhoofd/models';
import type { BalanceItemBreakdown, StamhoofdFilter } from '@stamhoofd/structures';
import { BalanceItemRelation, BalanceItemRelationType, BalanceItemStatus, BalanceItemType, BreakdownPathItem, BreakdownRequest, BreakdownTab, Cart, CartItem, CartItemOption, CartItemPrice, Customer, Option, OptionMenu, OrderData, PaymentMethod, PaymentProvider, PaymentStatus, PermissionLevel, Permissions, Product, ProductPrice, Settlement, TranslatedString } from '@stamhoofd/structures';
import { testServer } from '../../../../../tests/helpers/TestServer.js';
import { GetBalanceItemBreakdownEndpoint } from './GetBalanceItemBreakdownEndpoint.js';
import { GetBalanceItemEndpoint } from './GetBalanceItemEndpoint.js';

describe('Endpoint.GetBalanceItemBreakdownEndpoint', () => {
    const endpoint = new GetBalanceItemBreakdownEndpoint();

    const getBreakdown = async ({ filter, path, organization, user }: { filter?: StamhoofdFilter; path?: BreakdownPathItem[]; organization: Organization; user: User }) => {
        const token = await Token.createToken(user);

        const request = Request.get({
            path: '/balance-items/breakdown',
            host: organization.getApiHost(),
            query: new BreakdownRequest({ filter: filter ?? null, path: path ?? [] }),
            headers: {
                authorization: 'Bearer ' + token.accessToken,
            },
        });

        return testServer.test<BalanceItemBreakdown>(endpoint, request);
    };

    const createFinanceUser = async (organization: Organization) => {
        return await new UserFactory({
            organization,
            permissions: Permissions.create({ level: PermissionLevel.Full }),
        }).create();
    };

    const createItem = async (organization: Organization, options: { price: number; quantity?: number; groupId: string; groupName: string; priceName?: string; status?: BalanceItemStatus; pricePaid?: number; pricePending?: number }) => {
        const relations = new Map([
            [BalanceItemRelationType.Group, BalanceItemRelation.create({ id: options.groupId, name: new TranslatedString(options.groupName) })],
        ]);

        if (options.priceName) {
            relations.set(
                BalanceItemRelationType.GroupPrice,
                BalanceItemRelation.create({ id: 'price-' + options.priceName, name: new TranslatedString(options.priceName) }),
            );
        }

        return await new BalanceItemFactory({
            organizationId: organization.id,
            type: BalanceItemType.Registration,
            amount: options.quantity ?? 1,
            unitPrice: options.price,
            pricePaid: options.pricePaid ?? 0,
            pricePending: options.pricePending ?? 0,
            status: options.status,
            relations,
        }).create();
    };

    test('splits what was charged per category and per article', async () => {
        const organization = await new OrganizationFactory({}).create();
        const user = await createFinanceUser(organization);

        await createItem(organization, { price: 40_00, groupId: 'group-a', groupName: 'Kapoenen', priceName: 'Standaardtarief', pricePaid: 40_00 });
        await createItem(organization, { price: 40_00, groupId: 'group-a', groupName: 'Kapoenen', priceName: 'Standaardtarief' });
        await createItem(organization, { price: 20_00, groupId: 'group-a', groupName: 'Kapoenen', priceName: 'Verminderd tarief' });
        await createItem(organization, { price: 25_00, groupId: 'group-b', groupName: 'Welpen', priceName: 'Standaardtarief' });

        const response = await getBreakdown({ organization, user });

        expect(response.status).toBe(200);
        expect(response.body.price).toBe(125_00);
        expect(response.body.pricePaid).toBe(40_00);
        expect(response.body.priceOpen).toBe(85_00);

        expect(response.body.byCategory.map(g => ({ name: g.name.toString(), price: g.price, quantity: g.quantity }))).toEqual([
            { name: 'Kapoenen', price: 100_00, quantity: 3 },
            { name: 'Welpen', price: 25_00, quantity: 1 },
        ]);

        // The two identical registrations are one article, the reduced price is another
        expect(response.body.byArticle).toHaveLength(3);
        expect(response.body.byArticle[0].quantity).toBe(2);
    });

    test('a webshop order is charged as one balance item, but split up per ordered product', async () => {
        const organization = await new OrganizationFactory({}).create();
        const user = await createFinanceUser(organization);

        const product = Product.create({ name: 'T-shirt', prices: [ProductPrice.create({ name: 'Standaard', price: 15_00 })] });
        const optionMenu = OptionMenu.create({ name: 'Maat', options: [Option.create({ name: 'XL', price: 2_00 })] });
        product.optionMenus.push(optionMenu);

        const webshop = await new WebshopFactory({ organizationId: organization.id }).create();
        const order = await new OrderFactory({
            webshop,
            data: OrderData.create({
                customer: Customer.create({ firstName: 'Eva', lastName: 'Peeters', email: 'eva@example.com' }),
                cart: Cart.create({
                    items: [
                        CartItem.create({
                            product,
                            productPrice: product.prices[0],
                            options: [CartItemOption.create({ optionMenu, option: optionMenu.options[0] })],
                            amount: 2,
                            // Normally calculated during checkout
                            unitPrice: 17_00,
                            calculatedPrices: [CartItemPrice.create({ price: 17_00 }), CartItemPrice.create({ price: 17_00 })],
                        }),
                    ],
                }),
            }),
        }).create();

        await new BalanceItemFactory({
            organizationId: organization.id,
            orderId: order.id,
            type: BalanceItemType.Order,
            amount: 1,
            unitPrice: order.data.totalPrice,
            relations: new Map([
                [BalanceItemRelationType.Webshop, BalanceItemRelation.create({ id: webshop.id, name: new TranslatedString(webshop.meta.name) })],
            ]),
        }).create();

        const response = await getBreakdown({ organization, user });

        expect(response.status).toBe(200);
        expect(response.body.byCategory).toHaveLength(1);
        expect(response.body.byArticle.map(g => ({ name: g.name.toString(), price: g.price, quantity: g.quantity, count: g.count }))).toEqual([
            { name: 'T-shirt', price: 30_00, quantity: 2, count: 1 },
            { name: 'Maat: XL', price: 4_00, quantity: 2, count: 1 },
        ]);
    });

    test('canceled items are not counted as charged', async () => {
        const organization = await new OrganizationFactory({}).create();
        const user = await createFinanceUser(organization);

        await createItem(organization, { price: 40_00, groupId: 'group-a', groupName: 'Kapoenen' });
        await createItem(organization, { price: 999_00, groupId: 'group-a', groupName: 'Kapoenen', status: BalanceItemStatus.Canceled });

        const response = await getBreakdown({ organization, user });

        expect(response.status).toBe(200);
        expect(response.body.price).toBe(40_00);
    });

    test('narrowing down to a category leaves only that category, and exports it', async () => {
        const organization = await new OrganizationFactory({}).create();
        const user = await createFinanceUser(organization);

        await createItem(organization, { price: 40_00, groupId: 'group-a', groupName: 'Kapoenen' });
        await createItem(organization, { price: 25_00, groupId: 'group-b', groupName: 'Welpen' });

        const all = await getBreakdown({ organization, user });
        const category = all.body.byCategory.find(g => g.name.toString() === 'Kapoenen')!;

        const narrowed = await getBreakdown({
            organization,
            user,
            path: [BreakdownPathItem.create({ tab: BreakdownTab.Category, id: category.id })],
        });

        expect(narrowed.status).toBe(200);
        expect(narrowed.body.price).toBe(40_00);
        expect(narrowed.body.exportFilter).toMatchObject({
            $and: [
                { type: BalanceItemType.Registration },
                { relations: { [BalanceItemRelationType.Group]: { id: 'group-a' } } },
            ],
        });
    });

    test('exporting a category gives back exactly the balance items that were shown', async () => {
        const organization = await new OrganizationFactory({}).create();
        const user = await createFinanceUser(organization);

        await createItem(organization, { price: 40_00, groupId: 'group-a', groupName: 'Kapoenen' });
        await createItem(organization, { price: 25_00, groupId: 'group-b', groupName: 'Welpen' });

        const all = await getBreakdown({ organization, user });
        const category = all.body.byCategory.find(g => g.name.toString() === 'Kapoenen')!;

        const narrowed = await getBreakdown({
            organization,
            user,
            path: [BreakdownPathItem.create({ tab: BreakdownTab.Category, id: category.id })],
        });

        expect(narrowed.body.price).toBe(40_00);

        // Running the export filter through the database selects the same balance items
        const exported = await getBreakdown({ organization, user, filter: narrowed.body.exportFilter });
        expect(exported.body.price).toBe(40_00);
        expect(exported.body.balanceItemCount).toBe(1);
    });

    test('items without relations are a category per description, and export as one', async () => {
        const organization = await new OrganizationFactory({}).create();
        const user = await createFinanceUser(organization);

        await new BalanceItemFactory({ organizationId: organization.id, type: BalanceItemType.Other, amount: 1, unitPrice: 30_00, description: 'Kampinschrijving' }).create();
        await new BalanceItemFactory({ organizationId: organization.id, type: BalanceItemType.Other, amount: 1, unitPrice: 12_00, description: 'Drankkaart' }).create();

        const all = await getBreakdown({ organization, user });
        expect(all.body.byCategory.map(g => g.name.toString())).toEqual(['Kampinschrijving', 'Drankkaart']);

        const category = all.body.byCategory.find(g => g.name.toString() === 'Drankkaart')!;
        const narrowed = await getBreakdown({
            organization,
            user,
            path: [BreakdownPathItem.create({ tab: BreakdownTab.Category, id: category.id })],
        });

        expect(narrowed.body.price).toBe(12_00);

        const exported = await getBreakdown({ organization, user, filter: narrowed.body.exportFilter });
        expect(exported.body.price).toBe(12_00);
    });

    test('an article can be listed on its own, without the items that have an extra option', async () => {
        const organization = await new OrganizationFactory({}).create();
        const user = await createFinanceUser(organization);

        await createItem(organization, { price: 40_00, groupId: 'group-a', groupName: 'Kapoenen', priceName: 'Standaardtarief' });
        await createItem(organization, { price: 40_00, groupId: 'group-a', groupName: 'Kapoenen', priceName: 'Standaardtarief' });

        // The same group and price, but for an option that was bought on top of it
        await new BalanceItemFactory({
            organizationId: organization.id,
            type: BalanceItemType.Registration,
            amount: 1,
            unitPrice: 5_00,
            relations: new Map([
                [BalanceItemRelationType.Group, BalanceItemRelation.create({ id: 'group-a', name: new TranslatedString('Kapoenen') })],
                [BalanceItemRelationType.GroupPrice, BalanceItemRelation.create({ id: 'price-Standaardtarief', name: new TranslatedString('Standaardtarief') })],
                [BalanceItemRelationType.GroupOptionMenu, BalanceItemRelation.create({ id: 'menu-a', name: new TranslatedString('Kamp') })],
                [BalanceItemRelationType.GroupOption, BalanceItemRelation.create({ id: 'option-a', name: new TranslatedString('Met overnachting') })],
            ]),
        }).create();

        const all = await getBreakdown({ organization, user });
        const article = all.body.byArticle.find(g => g.name.toString() === 'Inschrijving voor Kapoenen')!;

        // Listing the article shows the two registrations, not the option that was bought on top
        const listed = await getBreakdown({ organization, user, filter: article.filter });

        expect(listed.body.price).toBe(80_00);
        expect(listed.body.balanceItemCount).toBe(2);
    });

    describe('Grouping by payout', () => {
        const march = Settlement.create({ id: 'stl_march', reference: '1234567.0312.01', settledAt: new Date(2026, 2, 12), amount: 0 });
        const april = Settlement.create({ id: 'stl_april', reference: '1234567.0409.01', settledAt: new Date(2026, 3, 9), amount: 0 });

        /**
         * Pays a part of a balance item, the way a payment provider settles it afterwards.
         */
        const payItem = async (organization: Organization, balanceItem: BalanceItem, options: { price: number; settlement?: Settlement; status?: PaymentStatus; method?: PaymentMethod }) => {
            const payment = new Payment();
            payment.organizationId = organization.id;
            payment.method = options.method ?? PaymentMethod.Bancontact;
            payment.provider = payment.method === PaymentMethod.Bancontact ? PaymentProvider.Mollie : null;
            payment.status = options.status ?? PaymentStatus.Succeeded;
            payment.price = options.price;
            payment.paidAt = new Date();
            payment.settlement = options.settlement ?? null;
            await payment.save();

            const balanceItemPayment = new BalanceItemPayment();
            balanceItemPayment.balanceItemId = balanceItem.id;
            balanceItemPayment.paymentId = payment.id;
            balanceItemPayment.organizationId = organization.id;
            balanceItemPayment.price = options.price;
            await balanceItemPayment.save();
        };

        test('a balance item that was paid out in parts is counted in every payout it was part of', async () => {
            const organization = await new OrganizationFactory({}).create();
            const user = await createFinanceUser(organization);

            const first = await createItem(organization, { price: 100_00, groupId: 'group-a', groupName: 'Kapoenen', pricePaid: 100_00 });
            const second = await createItem(organization, { price: 25_00, groupId: 'group-b', groupName: 'Welpen', pricePaid: 25_00 });

            await payItem(organization, first, { price: 60_00, settlement: march });
            await payItem(organization, first, { price: 40_00, settlement: april });
            await payItem(organization, second, { price: 25_00, settlement: march });

            const response = await getBreakdown({ organization, user });

            expect(response.status).toBe(200);

            // The price is still what was charged, the payouts only hold what was received
            expect(response.body.price).toBe(125_00);
            expect(response.body.bySettlement.map(g => ({ name: g.name.toString(), price: g.price, count: g.count }))).toEqual([
                { name: '1234567.0312.01', price: 85_00, count: 2 },
                { name: '1234567.0409.01', price: 40_00, count: 1 },
            ]);
        });

        test('money that was not received gets a row per status instead of a payout', async () => {
            const organization = await new OrganizationFactory({}).create();
            const user = await createFinanceUser(organization);

            const item = await createItem(organization, { price: 100_00, groupId: 'group-a', groupName: 'Kapoenen', pricePaid: 40_00 });

            await payItem(organization, item, { price: 40_00, settlement: march });
            await payItem(organization, item, { price: 30_00, status: PaymentStatus.Pending });
            await payItem(organization, item, { price: 20_00, status: PaymentStatus.Failed, settlement: april });

            const response = await getBreakdown({ organization, user });

            expect(response.status).toBe(200);
            expect(response.body.bySettlement.map(g => ({ name: g.name.toString(), price: g.price }))).toEqual([
                { name: '1234567.0312.01', price: 40_00 },
                { name: $t('In verwerking'), price: 30_00 },
                // What is still open sits under the failed payment that tried to cover it
                { name: $t('Mislukte betaling'), price: 30_00 },
            ]);

            // Every part of what was charged ends up in exactly one row
            expect(response.body.bySettlement.reduce((total, g) => total + g.price, 0)).toBe(response.body.price);

            // Running the row through the database gives back the balance items it was added up from
            const row = response.body.bySettlement.find(g => g.name.toString() === $t('Mislukte betaling'))!;
            const exported = await getBreakdown({ organization, user, filter: row.filter });
            expect(exported.body.balanceItemCount).toBe(1);
        });

        test('what is still open is split over whether paying it was already tried', async () => {
            const organization = await new OrganizationFactory({}).create();
            const user = await createFinanceUser(organization);

            const tried = await createItem(organization, { price: 100_00, groupId: 'group-a', groupName: 'Kapoenen' });
            const untried = await createItem(organization, { price: 25_00, groupId: 'group-b', groupName: 'Welpen' });
            const paid = await createItem(organization, { price: 40_00, groupId: 'group-c', groupName: 'Jonggivers', pricePaid: 40_00 });

            await payItem(organization, tried, { price: 100_00, status: PaymentStatus.Failed });
            await payItem(organization, paid, { price: 40_00, settlement: march });

            const response = await getBreakdown({ organization, user });

            expect(response.status).toBe(200);
            expect(response.body.bySettlement.map(g => ({ name: g.name.toString(), price: g.price }))).toEqual([
                { name: $t('Mislukte betaling'), price: 100_00 },
                { name: '1234567.0312.01', price: 40_00 },
                { name: $t('Openstaand'), price: 25_00 },
            ]);

            // Both rows select exactly the balance items they were added up from
            for (const [name, count] of [[$t('Mislukte betaling'), 1], [$t('Openstaand'), 1]] as [string, number][]) {
                const row = response.body.bySettlement.find(g => g.name.toString() === name)!;
                const exported = await getBreakdown({ organization, user, filter: row.filter });
                expect(exported.body.balanceItemCount).toBe(count);
            }
        });

        test('exporting what is still being processed gives back exactly those balance items', async () => {
            const organization = await new OrganizationFactory({}).create();
            const user = await createFinanceUser(organization);

            const paid = await createItem(organization, { price: 40_00, groupId: 'group-a', groupName: 'Kapoenen', pricePaid: 40_00 });
            const processing = await createItem(organization, { price: 25_00, groupId: 'group-b', groupName: 'Welpen', pricePending: 25_00 });

            await payItem(organization, paid, { price: 40_00, settlement: march });
            await payItem(organization, processing, { price: 25_00, status: PaymentStatus.Pending });

            const all = await getBreakdown({ organization, user });
            const row = all.body.bySettlement.find(g => g.name.toString() === $t('In verwerking'))!;

            const narrowed = await getBreakdown({
                organization,
                user,
                path: [BreakdownPathItem.create({ tab: BreakdownTab.Settlement, id: row.id })],
            });

            expect(narrowed.status).toBe(200);
            expect(narrowed.body.balanceItemCount).toBe(1);
            expect(narrowed.body.price).toBe(25_00);

            // Running the export filter through the database selects the same balance items
            const exported = await getBreakdown({ organization, user, filter: narrowed.body.exportFilter });
            expect(exported.body.balanceItemCount).toBe(1);
            expect(exported.body.price).toBe(25_00);
        });

        test('nothing is broken down per payout when no provider has to pay out', async () => {
            const organization = await new OrganizationFactory({}).create();
            const user = await createFinanceUser(organization);

            const item = await createItem(organization, { price: 40_00, groupId: 'group-a', groupName: 'Kapoenen', pricePaid: 40_00 });
            await payItem(organization, item, { price: 40_00, method: PaymentMethod.Transfer });

            const response = await getBreakdown({ organization, user });

            expect(response.status).toBe(200);
            expect(response.body.bySettlement).toEqual([]);
        });

        test('exporting a payout gives back exactly the balance items that were shown', async () => {
            const organization = await new OrganizationFactory({}).create();
            const user = await createFinanceUser(organization);

            const first = await createItem(organization, { price: 100_00, groupId: 'group-a', groupName: 'Kapoenen', pricePaid: 100_00 });
            const second = await createItem(organization, { price: 25_00, groupId: 'group-b', groupName: 'Welpen', pricePaid: 25_00 });

            await payItem(organization, first, { price: 60_00, settlement: march });
            await payItem(organization, first, { price: 40_00, settlement: april });
            await payItem(organization, second, { price: 25_00, settlement: april });

            const all = await getBreakdown({ organization, user });
            const payout = all.body.bySettlement.find(g => g.name.toString() === '1234567.0312.01')!;

            const narrowed = await getBreakdown({
                organization,
                user,
                path: [BreakdownPathItem.create({ tab: BreakdownTab.Settlement, id: payout.id })],
            });

            // Only the balance item that was part of this payout is left, at the price it was charged
            expect(narrowed.status).toBe(200);
            expect(narrowed.body.balanceItemCount).toBe(1);
            expect(narrowed.body.price).toBe(100_00);

            // Running the export filter through the database selects the same balance items
            const exported = await getBreakdown({ organization, user, filter: narrowed.body.exportFilter });
            expect(exported.body.balanceItemCount).toBe(1);
            expect(exported.body.price).toBe(100_00);
        });
    });

    test('the breakdown url is not matched by the endpoint of a single balance item', async () => {
        const organization = await new OrganizationFactory({}).create();

        const request = Request.get({
            path: '/balance-items/breakdown',
            host: organization.getApiHost(),
        });

        expect(await new GetBalanceItemEndpoint().decode(request)).toBeNull();
    });

    test('never includes balance items of another organization', async () => {
        const organization = await new OrganizationFactory({}).create();
        const otherOrganization = await new OrganizationFactory({}).create();
        const user = await createFinanceUser(organization);

        await createItem(organization, { price: 40_00, groupId: 'group-a', groupName: 'Kapoenen' });
        await createItem(otherOrganization, { price: 999_00, groupId: 'group-x', groupName: 'Andere' });

        const response = await getBreakdown({ organization, user });

        expect(response.status).toBe(200);
        expect(response.body.price).toBe(40_00);
    });

    test('a user without permissions is not allowed to see the breakdown', async () => {
        const organization = await new OrganizationFactory({}).create();
        const user = await new UserFactory({ organization }).create();

        await expect(getBreakdown({ organization, user })).rejects.toThrow();
    });
});
