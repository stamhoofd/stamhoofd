import { Request } from '@simonbackx/simple-endpoints';
import type { BalanceItem, Organization, User } from '@stamhoofd/models';
import { BalanceItemFactory, BalanceItemPayment, OrderFactory, OrganizationFactory, Payment, StripeAccount, Token, UserFactory, WebshopFactory } from '@stamhoofd/models';
import type { StamhoofdFilter } from '@stamhoofd/structures';
import { BalanceItemRelation, BalanceItemRelationType, BalanceItemType, Cart, CartItem, CartItemOption, CartItemPrice, Customer, getBalanceItemTypeIcon, getPaymentProviderName, OptionMenu, OrderData, Option, PaymentMethod, PaymentMethodHelper, PaymentProvider, PaymentStatus, PermissionLevel, Permissions, Product, ProductPrice, Settlement, StripeBusinessProfile, StripeMetaData, TransferSettings, TranslatedString } from '@stamhoofd/structures';
import { BreakdownRequest } from '@stamhoofd/structures/breakdown/BreakdownRequest.js';
import type { PaymentBreakdown } from '@stamhoofd/structures/PaymentBreakdown.js';
import { BreakdownGraphUnit, BreakdownObjectType, BreakdownPathItem, BreakdownTab } from '@stamhoofd/structures/PaymentBreakdown.js';
import { Formatter } from '@stamhoofd/utility';
import { v4 as uuidv4 } from 'uuid';
import { exportSlice } from '../../../../../tests/helpers/ExportSlice.js';
import { testServer } from '../../../../../tests/helpers/TestServer.js';
import { GetPaymentEndpoint } from '../../shared/GetPaymentEndpoint.js';
import { GetPaymentBreakdownEndpoint } from './GetPaymentBreakdownEndpoint.js';

/**
 * What was ordered: the name of the product, its unit price, how many, and optionally one chosen
 * option (menu name, option name, option price).
 */
type OrderedProduct = [string, number, number, [string, string, number]?];

describe('Endpoint.GetPaymentBreakdownEndpoint', () => {
    const endpoint = new GetPaymentBreakdownEndpoint();

    const getBreakdown = async ({ filter, path, search, narrowFilter, organization, user }: { filter?: StamhoofdFilter; path?: BreakdownPathItem[]; search?: string; narrowFilter?: StamhoofdFilter; organization: Organization; user: User }) => {
        const token = await Token.createToken(user);

        const request = Request.get({
            path: '/payments/breakdown',
            host: organization.getApiHost(),
            query: new BreakdownRequest({
                filter: filter ?? null,
                path: path ?? [],
                search: search ?? null,
                narrowFilter: narrowFilter ?? null,
            }),
            headers: {
                authorization: 'Bearer ' + token.accessToken,
            },
        });

        return testServer.test<PaymentBreakdown>(endpoint, request);
    };

    /**
     * An order with a few products in its cart, so it can be broken down per article.
     */
    const createOrderData = (products: OrderedProduct[], extra: { fixedDiscount?: number; percentageDiscount?: number; administrationFee?: number } = {}) => {
        // Two lines of the same product are the same product in a webshop, and its options are shared
        const catalog = new Map<string, { product: Product; optionMenus: Map<string, OptionMenu> }>();

        const getProduct = (name: string, unitPrice: number) => {
            let entry = catalog.get(name);

            if (!entry) {
                entry = {
                    product: Product.create({ name, prices: [ProductPrice.create({ name: 'Standaard', price: unitPrice })] }),
                    optionMenus: new Map(),
                };
                catalog.set(name, entry);
            }

            return entry;
        };

        const getOption = (name: string, unitPrice: number, [menuName, optionName, optionPrice]: [string, string, number]) => {
            const { product, optionMenus } = getProduct(name, unitPrice);
            let menu = optionMenus.get(menuName);

            if (!menu) {
                menu = OptionMenu.create({ name: menuName });
                optionMenus.set(menuName, menu);
                product.optionMenus.push(menu);
            }

            let option = menu.options.find(o => o.name === optionName);

            if (!option) {
                option = Option.create({ name: optionName, price: optionPrice });
                menu.options.push(option);
            }

            return CartItemOption.create({ optionMenu: menu, option });
        };

        return OrderData.create({
            ...extra,
            customer: Customer.create({ firstName: 'Eva', lastName: 'Peeters', email: 'eva@example.com' }),
            cart: Cart.create({
                items: products.map(([name, unitPrice, amount, option]) => {
                    const { product } = getProduct(name, unitPrice);
                    const options = option ? [getOption(name, unitPrice, option)] : [];
                    const priceWithOptions = unitPrice + options.reduce((total, o) => total + o.option.price, 0);

                    return CartItem.create({
                        product,
                        productPrice: product.prices[0],
                        options,
                        amount,
                        // Normally calculated during checkout
                        unitPrice: priceWithOptions,
                        calculatedPrices: Array.from({ length: amount }, () => CartItemPrice.create({ price: priceWithOptions })),
                    });
                }),
            }),
        });
    };

    const createFinanceUser = async (organization: Organization) => {
        return await new UserFactory({
            organization,
            permissions: Permissions.create({ level: PermissionLevel.Full }),
        }).create();
    };

    const createRegistrationItem = async (organization: Organization, options: { price: number; groupId: string; groupName: string; priceName?: string }) => {
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
            amount: 1,
            unitPrice: options.price,
            relations,
        }).create();
    };

    const createPayment = async (organization: Organization, options: {
        items: [BalanceItem, number][];
        method?: PaymentMethod;
        provider?: PaymentProvider | null;
        status?: PaymentStatus;
        iban?: string;
        transferDescription?: string;
        transferFee?: number;
        settlement?: Settlement;
        /**
         * What this payment rounded away, because a payment goes to the cent while what was charged
         * goes to four digits after the comma.
         */
        roundingAmount?: number;
    }) => {
        const payment = new Payment();
        payment.organizationId = organization.id;
        payment.method = options.method ?? PaymentMethod.Transfer;
        payment.provider = options.provider ?? null;
        payment.status = options.status ?? PaymentStatus.Succeeded;
        payment.roundingAmount = options.roundingAmount ?? 0;
        payment.price = options.items.reduce((total, [_, price]) => total + price, 0) + payment.roundingAmount;
        payment.paidAt = new Date();
        payment.transferFee = options.transferFee ?? 0;
        payment.settlement = options.settlement ?? null;
        payment.transferDescription = options.transferDescription ?? null;

        if (options.iban) {
            payment.transferSettings = TransferSettings.create({ iban: options.iban, creditor: 'Hoofdrekening' });
        }

        await payment.save();

        for (const [balanceItem, price] of options.items) {
            const balanceItemPayment = new BalanceItemPayment();
            balanceItemPayment.balanceItemId = balanceItem.id;
            balanceItemPayment.paymentId = payment.id;
            balanceItemPayment.organizationId = organization.id;
            balanceItemPayment.price = price;
            await balanceItemPayment.save();
        }

        return payment;
    };

    describe('The three ways a selection is split up', () => {
        test('per account, per category and per article', async () => {
            const organization = await new OrganizationFactory({}).create();
            const user = await createFinanceUser(organization);

            const standard = await createRegistrationItem(organization, { price: 40_00, groupId: 'group-a', groupName: 'Kapoenen', priceName: 'Standaardtarief' });
            const reduced = await createRegistrationItem(organization, { price: 20_00, groupId: 'group-a', groupName: 'Kapoenen', priceName: 'Verminderd tarief' });
            const welpen = await createRegistrationItem(organization, { price: 25_00, groupId: 'group-b', groupName: 'Welpen', priceName: 'Standaardtarief' });

            await createPayment(organization, { items: [[standard, 40_00]], iban: 'BE68539007547034' });
            await createPayment(organization, { items: [[reduced, 20_00]], method: PaymentMethod.PointOfSale });
            await createPayment(organization, { items: [[welpen, 25_00]], iban: 'BE68539007547034' });

            const response = await getBreakdown({ organization, user });

            expect(response.status).toBe(200);
            expect(response.body.price).toBe(85_00);
            expect(response.body.paymentCount).toBe(3);

            // Where the money arrived: transfers to the same account are one row
            expect(response.body.byAccount.map(g => ({ name: g.name.toString(), price: g.price, icon: g.icon }))).toEqual([
                { name: 'Hoofdrekening', price: 65_00, icon: 'bank' },
                { name: 'Ter plaatse', price: 20_00, icon: 'card' },
            ]);

            // What it was for
            expect(response.body.byCategory.map(g => ({ name: g.name.toString(), price: g.price }))).toEqual([
                { name: 'Kapoenen', price: 60_00 },
                { name: 'Welpen', price: 25_00 },
            ]);

            // Which article: the two prices of Kapoenen are separate rows
            expect(response.body.byArticle).toHaveLength(3);
            expect(response.body.byArticle.every(g => !g.canNarrowDown)).toBe(true);
        });

        test('a group can be shown like a balance item, with an icon and its relations', async () => {
            const organization = await new OrganizationFactory({}).create();
            const user = await createFinanceUser(organization);

            const item = await createRegistrationItem(organization, { price: 40_00, groupId: 'group-a', groupName: 'Kapoenen', priceName: 'Standaardtarief' });
            await createPayment(organization, { items: [[item, 40_00]] });

            const response = await getBreakdown({ organization, user });

            expect(response.status).toBe(200);

            const category = response.body.byCategory[0];
            expect(category.icon).toBe(getBalanceItemTypeIcon(BalanceItemType.Registration));
            expect(category.relations.get(BalanceItemRelationType.Group)?.name.toString()).toBe('Kapoenen');

            const article = response.body.byArticle[0];
            expect(article.name.toString()).toContain('Kapoenen');
            expect(article.relations.get(BalanceItemRelationType.GroupPrice)?.name.toString()).toBe('Standaardtarief');
        });
    });

    describe('Webshop orders', () => {
        test('an order is charged as one balance item, so the articles come from the order itself', async () => {
            const organization = await new OrganizationFactory({}).create();
            const user = await createFinanceUser(organization);

            const webshop = await new WebshopFactory({ organizationId: organization.id }).create();
            const order = await new OrderFactory({ webshop, data: createOrderData([['T-shirt', 15_00, 2], ['Wafels', 6_00, 3]]) }).create();

            const balanceItem = await new BalanceItemFactory({
                organizationId: organization.id,
                orderId: order.id,
                type: BalanceItemType.Order,
                amount: 1,
                unitPrice: order.data.totalPrice,
                relations: new Map([
                    [BalanceItemRelationType.Webshop, BalanceItemRelation.create({ id: webshop.id, name: new TranslatedString(webshop.meta.name) })],
                ]),
            }).create();

            await createPayment(organization, { items: [[balanceItem, order.data.totalPrice]] });

            const response = await getBreakdown({ organization, user });

            expect(response.status).toBe(200);

            // One category for the webshop, but a row per ordered product
            expect(response.body.byCategory).toHaveLength(1);
            expect(response.body.byArticle.map(g => ({ name: g.name.toString(), price: g.price, quantity: g.quantity }))).toEqual([
                { name: 'T-shirt', price: 30_00, quantity: 2 },
                { name: 'Wafels', price: 18_00, quantity: 3 },
            ]);

            // An order is one balance item, so its articles can't be selected on their own
            expect(response.body.byArticle.every(g => g.selection === null)).toBe(true);
        });

        test('the options that were chosen for a product are counted on their own', async () => {
            const organization = await new OrganizationFactory({}).create();
            const user = await createFinanceUser(organization);

            const webshop = await new WebshopFactory({ organizationId: organization.id }).create();
            const order = await new OrderFactory({
                webshop,
                data: createOrderData([
                    ['T-shirt', 15_00, 2, ['Maat', 'XL', 2_00]],
                    ['T-shirt', 15_00, 1, ['Maat', 'S', 0]],
                ]),
            }).create();

            const balanceItem = await new BalanceItemFactory({
                organizationId: organization.id,
                orderId: order.id,
                type: BalanceItemType.Order,
                amount: 1,
                unitPrice: order.data.totalPrice,
            }).create();

            await createPayment(organization, { items: [[balanceItem, order.data.totalPrice]] });

            const response = await getBreakdown({ organization, user });

            expect(response.status).toBe(200);

            // The t-shirts are one row of 3 at their own price, the options are rows of their own
            expect(response.body.byArticle.map(g => ({ name: g.name.toString(), price: g.price, quantity: g.quantity }))).toEqual([
                { name: 'T-shirt', price: 45_00, quantity: 3 },
                { name: 'Maat: XL', price: 4_00, quantity: 2 },
                { name: 'Maat: S', price: 0, quantity: 1 },
            ]);

            // Everything of the order is accounted for
            expect(response.body.byArticle.reduce((total, g) => total + g.price, 0)).toBe(response.body.price);
        });

        test('a discount code and the administration costs are articles of their own', async () => {
            const organization = await new OrganizationFactory({}).create();
            const user = await createFinanceUser(organization);

            const webshop = await new WebshopFactory({ organizationId: organization.id }).create();
            const order = await new OrderFactory({
                webshop,
                data: createOrderData([['T-shirt', 10_00, 2]], { fixedDiscount: 5_00, administrationFee: 1_00 }),
            }).create();

            expect(order.data.totalPrice).toBe(16_00);

            const balanceItem = await new BalanceItemFactory({
                organizationId: organization.id,
                orderId: order.id,
                type: BalanceItemType.Order,
                amount: 1,
                unitPrice: order.data.totalPrice,
            }).create();

            await createPayment(organization, { items: [[balanceItem, order.data.totalPrice]] });

            const response = await getBreakdown({ organization, user });

            expect(response.status).toBe(200);
            expect(response.body.byArticle.map(g => ({ name: g.name.toString(), price: g.price }))).toEqual([
                { name: 'T-shirt', price: 20_00 },
                { name: 'Korting', price: -5_00 },
                { name: 'Administratiekosten', price: 1_00 },
            ]);

            // A discount that is not part of a cart line still has to be accounted for
            expect(response.body.byArticle.reduce((total, g) => total + g.price, 0)).toBe(response.body.price);
        });

        test('an order that was not paid in full is not attributed to single articles', async () => {
            const organization = await new OrganizationFactory({}).create();
            const user = await createFinanceUser(organization);

            const webshop = await new WebshopFactory({ organizationId: organization.id }).create();
            const order = await new OrderFactory({ webshop, data: createOrderData([['T-shirt', 15_00, 2]]) }).create();

            const balanceItem = await new BalanceItemFactory({
                organizationId: organization.id,
                orderId: order.id,
                type: BalanceItemType.Order,
                amount: 1,
                unitPrice: order.data.totalPrice,
            }).create();

            // Only a part of the order was paid
            await createPayment(organization, { items: [[balanceItem, 1_00]] });

            const response = await getBreakdown({ organization, user });

            expect(response.status).toBe(200);
            expect(response.body.byArticle).toHaveLength(1);
            expect(response.body.byArticle[0].name.toString()).toBe($t('%Zjb'));
            expect(response.body.byArticle[0].price).toBe(1_00);
        });

        test('an order that was paid for more than it costs was changed afterwards', async () => {
            const organization = await new OrganizationFactory({}).create();
            const user = await createFinanceUser(organization);

            const webshop = await new WebshopFactory({ organizationId: organization.id }).create();
            const order = await new OrderFactory({ webshop, data: createOrderData([['T-shirt', 15_00, 2]]) }).create();

            const balanceItem = await new BalanceItemFactory({
                organizationId: organization.id,
                orderId: order.id,
                type: BalanceItemType.Order,
                amount: 1,
                unitPrice: order.data.totalPrice,
            }).create();

            await createPayment(organization, { items: [[balanceItem, 40_00]] });

            const response = await getBreakdown({ organization, user });

            expect(response.status).toBe(200);
            expect(response.body.byArticle.map(g => g.name.toString())).toEqual([$t('%Zik')]);
        });
    });

    describe('What came in over time', () => {
        test('the money is counted per day, without the days nothing came in', async () => {
            const organization = await new OrganizationFactory({}).create();
            const user = await createFinanceUser(organization);

            const item = await createRegistrationItem(organization, { price: 100_00, groupId: 'group-a', groupName: 'Kapoenen' });

            // Midday of two fixed days, so the days in between never change with the clock: 48 hours
            // earlier is a different calendar day around a daylight saving switch
            const noon = (day: number) => Formatter.luxon(new Date()).set({ year: 2026, month: 3, day, hour: 12, minute: 0, second: 0, millisecond: 0 }).toJSDate();

            const first = await createPayment(organization, { items: [[item, 40_00]] });
            first.paidAt = noon(2);
            await first.save();

            const second = await createPayment(organization, { items: [[item, 25_00]] });
            second.paidAt = noon(4);
            await second.save();

            const response = await getBreakdown({ organization, user });

            expect(response.status).toBe(200);
            expect(response.body.graph.unit).toBe(BreakdownGraphUnit.Day);
            expect(response.body.graph.points.map(p => p.price)).toEqual([40_00, 25_00]);

            // The empty day in between is only added where the graph is drawn
            expect(response.body.graph.filledPoints.map(p => p.price)).toEqual([40_00, 0, 25_00]);
        });
    });

    describe('Narrowing down to one group', () => {
        test('only the part of a payment that belongs to that group is left', async () => {
            const organization = await new OrganizationFactory({}).create();
            const user = await createFinanceUser(organization);

            const registration = await createRegistrationItem(organization, { price: 60_00, groupId: 'group-a', groupName: 'Kapoenen' });
            const fee = await new BalanceItemFactory({
                organizationId: organization.id,
                type: BalanceItemType.AdministrationFee,
                amount: 1,
                unitPrice: 40_00,
            }).create();

            // One payment that paid both
            await createPayment(organization, { items: [[registration, 60_00], [fee, 40_00]] });

            const all = await getBreakdown({ organization, user });
            expect(all.body.price).toBe(100_00);

            const category = all.body.byCategory.find(g => g.name.toString() === 'Kapoenen')!;

            const narrowed = await getBreakdown({
                organization,
                user,
                path: [BreakdownPathItem.create({ tab: BreakdownTab.Category, id: category.id })],
            });

            expect(narrowed.status).toBe(200);
            expect(narrowed.body.price).toBe(60_00);

            // The payment as a whole paid for more than what is shown
            expect(narrowed.body.selection.isListPartial).toBe(true);

            const matchingItem = {
                $and: [
                    { type: BalanceItemType.Registration },
                    { relations: { [BalanceItemRelationType.Group]: { id: 'group-a' } } },
                ],
            };

            // Exporting gives the parts of the payments that were added up here
            expect(narrowed.body.selection.objectType).toBe(BreakdownObjectType.BalanceItemPayments);
            expect(narrowed.body.selection.filter).toMatchObject({ balanceItem: matchingItem });

            // A list gives the payments that paid for at least one matching item
            expect(narrowed.body.selection.listFilter).toMatchObject({
                balanceItemPayments: { $elemMatch: { balanceItem: matchingItem } },
            });
        });

        test('narrowing down to an account keeps only that account', async () => {
            const organization = await new OrganizationFactory({}).create();
            const user = await createFinanceUser(organization);

            const item = await createRegistrationItem(organization, { price: 100_00, groupId: 'group-a', groupName: 'Kapoenen' });

            await createPayment(organization, { items: [[item, 30_00]], iban: 'BE68539007547034' });
            await createPayment(organization, { items: [[item, 20_00]], method: PaymentMethod.PointOfSale });

            const all = await getBreakdown({ organization, user });
            const account = all.body.byAccount.find(g => g.name.toString() === 'Hoofdrekening')!;

            const narrowed = await getBreakdown({
                organization,
                user,
                path: [BreakdownPathItem.create({ tab: BreakdownTab.Account, id: account.id })],
            });

            expect(narrowed.status).toBe(200);
            expect(narrowed.body.price).toBe(30_00);
            expect(narrowed.body.selection.filter).toMatchObject({
                $and: [
                    { method: PaymentMethod.Transfer },
                    { transferSettings: { iban: 'BE68539007547034' } },
                ],
            });
        });

        test('exporting a category gives back exactly the payments that were shown', async () => {
            const organization = await new OrganizationFactory({}).create();
            const user = await createFinanceUser(organization);

            const kapoenen = await createRegistrationItem(organization, { price: 60_00, groupId: 'group-a', groupName: 'Kapoenen' });
            const welpen = await createRegistrationItem(organization, { price: 25_00, groupId: 'group-b', groupName: 'Welpen' });

            await createPayment(organization, { items: [[kapoenen, 60_00]] });
            await createPayment(organization, { items: [[welpen, 25_00]] });

            const all = await getBreakdown({ organization, user });
            const category = all.body.byCategory.find(g => g.name.toString() === 'Kapoenen')!;

            const narrowed = await getBreakdown({
                organization,
                user,
                path: [BreakdownPathItem.create({ tab: BreakdownTab.Category, id: category.id })],
            });

            expect(narrowed.body.price).toBe(60_00);

            // Running the export filter through the database selects the same payments
            const exported = await getBreakdown({ organization, user, filter: narrowed.body.selection.filter });
            expect(exported.body.price).toBe(60_00);
            expect(exported.body.paymentCount).toBe(1);
        });

        test('exporting a Stripe account gives back exactly the payments that were shown', async () => {
            const organization = await new OrganizationFactory({}).create();
            const user = await createFinanceUser(organization);

            const stripeAccount = new StripeAccount();
            stripeAccount.organizationId = organization.id;
            stripeAccount.accountId = 'acct_' + uuidv4();
            stripeAccount.meta = StripeMetaData.create({
                business_profile: StripeBusinessProfile.create({ name: 'Scouts Gent' }),
            });
            await stripeAccount.save();

            const item = await createRegistrationItem(organization, { price: 100_00, groupId: 'group-a', groupName: 'Kapoenen' });

            const online = await createPayment(organization, { items: [[item, 30_00]], method: PaymentMethod.Bancontact, provider: PaymentProvider.Stripe });
            online.stripeAccountId = stripeAccount.id;
            await online.save();

            await createPayment(organization, { items: [[item, 20_00]], method: PaymentMethod.PointOfSale });

            const all = await getBreakdown({ organization, user });
            const account = all.body.byAccount.find(g => g.name.toString() === 'Scouts Gent')!;

            const narrowed = await getBreakdown({
                organization,
                user,
                path: [BreakdownPathItem.create({ tab: BreakdownTab.Account, id: account.id })],
            });

            expect(narrowed.body.price).toBe(30_00);

            const exported = await getBreakdown({ organization, user, filter: narrowed.body.selection.filter });
            expect(exported.body.price).toBe(30_00);
        });

        test('a bundle discount is selected by its discount, not by the group it was given for', async () => {
            const organization = await new OrganizationFactory({}).create();
            const user = await createFinanceUser(organization);

            // A discount carries the group it was given for, but it is named after the discount
            const discount = await new BalanceItemFactory({
                organizationId: organization.id,
                type: BalanceItemType.RegistrationBundleDiscount,
                amount: 1,
                unitPrice: -10_00,
                relations: new Map([
                    [BalanceItemRelationType.Group, BalanceItemRelation.create({ id: 'group-a', name: new TranslatedString('Kapoenen') })],
                    [BalanceItemRelationType.Discount, BalanceItemRelation.create({ id: 'discount-a', name: new TranslatedString('Gezinskorting') })],
                ]),
            }).create();

            const registration = await createRegistrationItem(organization, { price: 60_00, groupId: 'group-a', groupName: 'Kapoenen' });

            await createPayment(organization, { items: [[registration, 60_00]] });
            await createPayment(organization, { items: [[discount, -10_00]] });

            const all = await getBreakdown({ organization, user });
            const category = all.body.byCategory.find(g => g.name.toString() === 'Gezinskorting')!;

            const narrowed = await getBreakdown({
                organization,
                user,
                path: [BreakdownPathItem.create({ tab: BreakdownTab.Category, id: category.id })],
            });

            expect(narrowed.body.price).toBe(-10_00);

            // The registration of the same group is not part of it
            const exported = await getBreakdown({ organization, user, filter: narrowed.body.selection.filter });
            expect(exported.body.price).toBe(-10_00);
        });

        test('transfers without a known account are not mixed up with the transfers that have one', async () => {
            const organization = await new OrganizationFactory({}).create();
            const user = await createFinanceUser(organization);

            const item = await createRegistrationItem(organization, { price: 100_00, groupId: 'group-a', groupName: 'Kapoenen' });

            await createPayment(organization, { items: [[item, 30_00]], iban: 'BE68539007547034' });
            await createPayment(organization, { items: [[item, 20_00]] });

            const all = await getBreakdown({ organization, user });
            const account = all.body.byAccount.find(g => g.name.toString() === PaymentMethodHelper.getNameCapitalized(PaymentMethod.Transfer))!;

            const narrowed = await getBreakdown({
                organization,
                user,
                path: [BreakdownPathItem.create({ tab: BreakdownTab.Account, id: account.id })],
            });

            expect(narrowed.status).toBe(200);
            expect(narrowed.body.price).toBe(20_00);

            // Exporting the narrowed selection gives back exactly what was shown
            const exported = await getBreakdown({ organization, user, filter: narrowed.body.selection.filter });
            expect(exported.body.price).toBe(20_00);
        });
    });

    describe('Grouping by payout', () => {
        const createSettlement = (reference: string, settledAt: Date) => {
            return Settlement.create({ id: 'stl_' + reference, reference, settledAt, amount: 0 });
        };

        test('per payout, with what is not online and what still has to be paid out apart', async () => {
            const organization = await new OrganizationFactory({}).create();
            const user = await createFinanceUser(organization);

            const item = await createRegistrationItem(organization, { price: 200_00, groupId: 'group-a', groupName: 'Kapoenen' });
            const march = createSettlement('1234567.0312.01', new Date(2026, 2, 12));

            const online = { method: PaymentMethod.Bancontact, provider: PaymentProvider.Mollie };
            await createPayment(organization, { items: [[item, 40_00]], ...online, settlement: march });
            await createPayment(organization, { items: [[item, 10_00]], ...online, settlement: march });
            await createPayment(organization, { items: [[item, 30_00]], ...online });
            await createPayment(organization, { items: [[item, 20_00]], method: PaymentMethod.PointOfSale });

            const response = await getBreakdown({ organization, user });

            expect(response.status).toBe(200);
            expect(response.body.bySettlement.map(g => ({ name: g.name.toString(), price: g.price, count: g.count }))).toEqual([
                { name: '1234567.0312.01', price: 50_00, count: 2 },
                { name: $t('%Zjn'), price: 30_00, count: 1 },
                { name: $t('%ZjN'), price: 20_00, count: 1 },
            ]);
        });

        test('nothing is broken down per payout when no provider has to pay out', async () => {
            const organization = await new OrganizationFactory({}).create();
            const user = await createFinanceUser(organization);

            const item = await createRegistrationItem(organization, { price: 100_00, groupId: 'group-a', groupName: 'Kapoenen' });
            await createPayment(organization, { items: [[item, 40_00]], iban: 'BE68539007547034' });
            await createPayment(organization, { items: [[item, 20_00]], method: PaymentMethod.PointOfSale });

            const response = await getBreakdown({ organization, user });

            expect(response.status).toBe(200);
            expect(response.body.bySettlement).toEqual([]);
        });

        test('exporting a payout gives back exactly the payments that were shown', async () => {
            const organization = await new OrganizationFactory({}).create();
            const user = await createFinanceUser(organization);

            const item = await createRegistrationItem(organization, { price: 200_00, groupId: 'group-a', groupName: 'Kapoenen' });
            const march = createSettlement('1234567.0312.01', new Date(2026, 2, 12));
            const april = createSettlement('1234567.0409.01', new Date(2026, 3, 9));

            const online = { method: PaymentMethod.Bancontact, provider: PaymentProvider.Mollie };
            await createPayment(organization, { items: [[item, 40_00]], ...online, settlement: march });
            await createPayment(organization, { items: [[item, 25_00]], ...online, settlement: april });
            await createPayment(organization, { items: [[item, 30_00]], ...online });
            await createPayment(organization, { items: [[item, 20_00]], method: PaymentMethod.PointOfSale });

            const all = await getBreakdown({ organization, user });
            const payout = all.body.bySettlement.find(g => g.name.toString() === '1234567.0312.01')!;

            const narrowed = await getBreakdown({
                organization,
                user,
                path: [BreakdownPathItem.create({ tab: BreakdownTab.Settlement, id: payout.id })],
            });

            expect(narrowed.status).toBe(200);
            expect(narrowed.body.price).toBe(40_00);
            expect(narrowed.body.paymentCount).toBe(1);

            // Running the export filter through the database selects the same payments
            const exported = await getBreakdown({ organization, user, filter: narrowed.body.selection.filter });
            expect(exported.body.price).toBe(40_00);
            expect(exported.body.paymentCount).toBe(1);
        });

        test('exporting what still has to be paid out leaves out what was already settled', async () => {
            const organization = await new OrganizationFactory({}).create();
            const user = await createFinanceUser(organization);

            const item = await createRegistrationItem(organization, { price: 200_00, groupId: 'group-a', groupName: 'Kapoenen' });
            const march = createSettlement('1234567.0312.01', new Date(2026, 2, 12));

            const online = { method: PaymentMethod.Bancontact, provider: PaymentProvider.Mollie };
            await createPayment(organization, { items: [[item, 40_00]], ...online, settlement: march });
            await createPayment(organization, { items: [[item, 30_00]], ...online });
            await createPayment(organization, { items: [[item, 20_00]], method: PaymentMethod.PointOfSale });

            const all = await getBreakdown({ organization, user });
            const pending = all.body.bySettlement.find(g => g.name.toString() === $t('%Zjn'))!;

            const exported = await getBreakdown({ organization, user, filter: pending.selection!.filter });
            expect(exported.body.price).toBe(30_00);
            expect(exported.body.paymentCount).toBe(1);
        });

        test('exporting what was not paid online leaves out the online payments', async () => {
            const organization = await new OrganizationFactory({}).create();
            const user = await createFinanceUser(organization);

            const item = await createRegistrationItem(organization, { price: 200_00, groupId: 'group-a', groupName: 'Kapoenen' });

            await createPayment(organization, { items: [[item, 40_00]], method: PaymentMethod.Bancontact, provider: PaymentProvider.Mollie });
            await createPayment(organization, { items: [[item, 20_00]], method: PaymentMethod.PointOfSale });
            await createPayment(organization, { items: [[item, 10_00]], iban: 'BE68539007547034' });

            const all = await getBreakdown({ organization, user });
            const offline = all.body.bySettlement.find(g => g.name.toString() === $t('%ZjN'))!;

            const exported = await getBreakdown({ organization, user, filter: offline.selection!.filter });
            expect(exported.body.price).toBe(30_00);
            expect(exported.body.paymentCount).toBe(2);
        });

        test('providers we get no payout information from get a row per provider', async () => {
            const organization = await new OrganizationFactory({}).create();
            const user = await createFinanceUser(organization);

            const item = await createRegistrationItem(organization, { price: 200_00, groupId: 'group-a', groupName: 'Kapoenen' });

            await createPayment(organization, { items: [[item, 40_00]], method: PaymentMethod.Bancontact, provider: PaymentProvider.Mollie });
            await createPayment(organization, { items: [[item, 25_00]], method: PaymentMethod.Bancontact, provider: PaymentProvider.Buckaroo });
            await createPayment(organization, { items: [[item, 15_00]], method: PaymentMethod.Payconiq, provider: PaymentProvider.Payconiq });
            await createPayment(organization, { items: [[item, 20_00]], method: PaymentMethod.PointOfSale });

            const all = await getBreakdown({ organization, user });

            expect(all.body.bySettlement.map(g => ({ name: g.name.toString(), price: g.price }))).toEqual([
                { name: $t('%Zjn'), price: 40_00 },
                { name: getPaymentProviderName(PaymentProvider.Buckaroo), price: 25_00 },
                { name: $t('%ZjN'), price: 20_00 },
                { name: getPaymentProviderName(PaymentProvider.Payconiq), price: 15_00 },
            ]);

            const row = all.body.bySettlement.find(g => g.name.toString() === getPaymentProviderName(PaymentProvider.Buckaroo))!;
            const exported = await getBreakdown({ organization, user, filter: row.selection!.listFilter });
            expect(exported.body.price).toBe(25_00);
            expect(exported.body.paymentCount).toBe(1);
        });
    });

    describe('What counts as received', () => {
        test('only succeeded payments', async () => {
            const organization = await new OrganizationFactory({}).create();
            const user = await createFinanceUser(organization);

            const item = await createRegistrationItem(organization, { price: 100_00, groupId: 'group-a', groupName: 'Kapoenen' });

            await createPayment(organization, { items: [[item, 30_00]] });
            await createPayment(organization, { items: [[item, 70_00]], status: PaymentStatus.Pending });

            const response = await getBreakdown({
                organization,
                user,
                filter: { status: PaymentStatus.Succeeded },
            });

            expect(response.status).toBe(200);
            expect(response.body.price).toBe(30_00);
        });

        test('what a payment rounded away is an article of its own', async () => {
            const organization = await new OrganizationFactory({}).create();
            const user = await createFinanceUser(organization);

            // VAT makes what is charged go further than the cent: 12,12 + 21% is 14,6652
            const item = await createRegistrationItem(organization, { price: 12_1200, groupId: 'group-a', groupName: 'Kapoenen' });
            item.VATPercentage = 21;
            item.VATIncluded = false;
            await item.save();

            expect(item.priceWithVAT).toBe(14_6652);

            // A payment only goes to the cent, so it carries the difference
            await createPayment(organization, { items: [[item, 14_6652]], roundingAmount: 48 });

            const response = await getBreakdown({ organization, user });

            expect(response.status).toBe(200);
            expect(response.body.price).toBe(14_6700);
            expect(response.body.selection.isListPartial).toBe(false);

            expect(response.body.byCategory.map(g => ({ name: g.name.toString(), price: g.price }))).toEqual([
                { name: 'Kapoenen', price: 14_6652 },
                { name: $t('%1b6'), price: 48 },
            ]);

            // Everything the payment is worth is accounted for
            expect(response.body.byAccount.reduce((total, g) => total + g.price, 0)).toBe(14_6700);
        });

        test('the costs of a payment are counted once, even when it paid for several things', async () => {
            const organization = await new OrganizationFactory({}).create();
            const user = await createFinanceUser(organization);

            const first = await createRegistrationItem(organization, { price: 60_00, groupId: 'group-a', groupName: 'Kapoenen' });
            const second = await createRegistrationItem(organization, { price: 40_00, groupId: 'group-b', groupName: 'Welpen' });

            await createPayment(organization, {
                items: [[first, 60_00], [second, 40_00]],
                method: PaymentMethod.Bancontact,
                provider: PaymentProvider.Mollie,
                transferFee: 39,
            });

            const response = await getBreakdown({ organization, user });

            expect(response.status).toBe(200);
            expect(response.body.transferFee).toBe(39);
        });

        test('a selection that holds unfinished payments says what of it never arrived', async () => {
            const organization = await new OrganizationFactory({}).create();
            const user = await createFinanceUser(organization);

            const item = await createRegistrationItem(organization, { price: 100_00, groupId: 'group-a', groupName: 'Kapoenen' });

            await createPayment(organization, { items: [[item, 40_00]] });
            await createPayment(organization, { items: [[item, 30_00]], status: PaymentStatus.Pending });
            await createPayment(organization, { items: [[item, 20_00]], status: PaymentStatus.Failed });

            const response = await getBreakdown({ organization, user });

            expect(response.status).toBe(200);
            expect(response.body.price).toBe(90_00);
            expect(response.body.pricePending).toBe(30_00);
            expect(response.body.priceFailed).toBe(20_00);
        });

        test('a deduction from another balance is not money that came in', async () => {
            const organization = await new OrganizationFactory({}).create();
            const user = await createFinanceUser(organization);

            const item = await createRegistrationItem(organization, { price: 100_00, groupId: 'group-a', groupName: 'Kapoenen' });

            await createPayment(organization, { items: [[item, 40_00]] });
            await createPayment(organization, { items: [[item, 10_00]], method: PaymentMethod.AccountDeductions });

            const response = await getBreakdown({ organization, user });

            expect(response.status).toBe(200);
            expect(response.body.bySettlement.map(g => ({ name: g.name.toString(), price: g.price }))).toEqual([
                { name: $t('%ZjN'), price: 40_00 },
                { name: PaymentMethodHelper.getNameCapitalized(PaymentMethod.AccountDeductions), price: 10_00 },
            ]);

            // Running the rows through the database keeps them apart
            for (const [name, price] of [[$t('%ZjN'), 40_00], [PaymentMethodHelper.getNameCapitalized(PaymentMethod.AccountDeductions), 10_00]] as [string, number][]) {
                const row = response.body.bySettlement.find(g => g.name.toString() === name)!;
                const exported = await getBreakdown({ organization, user, filter: row.selection!.listFilter });
                expect(exported.body.price).toBe(price);
            }
        });
    });

    describe('Scope and permissions', () => {
        test('never includes payments of another organization', async () => {
            const organization = await new OrganizationFactory({}).create();
            const otherOrganization = await new OrganizationFactory({}).create();
            const user = await createFinanceUser(organization);

            const item = await createRegistrationItem(organization, { price: 10_00, groupId: 'group-a', groupName: 'Kapoenen' });
            await createPayment(organization, { items: [[item, 10_00]] });

            const otherItem = await createRegistrationItem(otherOrganization, { price: 999_00, groupId: 'group-x', groupName: 'Andere' });
            await createPayment(otherOrganization, { items: [[otherItem, 999_00]] });

            const response = await getBreakdown({ organization, user });

            expect(response.status).toBe(200);
            expect(response.body.price).toBe(10_00);
        });

        test('a user without permissions is not allowed to see the breakdown', async () => {
            const organization = await new OrganizationFactory({}).create();
            const user = await new UserFactory({ organization }).create();

            await expect(getBreakdown({ organization, user })).rejects.toThrow();
        });

        test('an admin without access to the finances is not allowed to see the breakdown', async () => {
            const organization = await new OrganizationFactory({}).create();
            const user = await new UserFactory({
                organization,
                permissions: Permissions.create({ level: PermissionLevel.Read }),
            }).create();

            const item = await createRegistrationItem(organization, { price: 10_00, groupId: 'group-a', groupName: 'Kapoenen' });
            await createPayment(organization, { items: [[item, 10_00]] });

            await expect(getBreakdown({ organization, user })).rejects.toThrow();
        });

        test('the breakdown url is not matched by the endpoint of a single payment', async () => {
            const organization = await new OrganizationFactory({}).create();

            const request = Request.get({
                path: '/payments/breakdown',
                host: organization.getApiHost(),
            });

            expect(await new GetPaymentEndpoint().decode(request)).toBeNull();
        });
    });

    describe('Exporting what a row was added up from', () => {
        test('a row that holds a part of its payments exports exactly that part', async () => {
            const organization = await new OrganizationFactory({}).create();
            const user = await createFinanceUser(organization);

            const registration = await createRegistrationItem(organization, { price: 60_00, groupId: 'group-a', groupName: 'Kapoenen' });
            const other = await createRegistrationItem(organization, { price: 40_00, groupId: 'group-b', groupName: 'Welpen' });

            // One payment paid for both, so a row per category holds a part of it
            await createPayment(organization, { items: [[registration, 60_00], [other, 40_00]] });

            const all = await getBreakdown({ organization, user });
            const row = all.body.byCategory.find(g => g.name.toString() === 'Kapoenen')!;

            expect(row.price).toBe(60_00);
            expect(row.selection!.isListPartial).toBe(true);
            expect(row.selection!.objectType).toBe(BreakdownObjectType.BalanceItemPayments);

            // The export holds the €60 of that payment, not the €100 payment around it
            const slice = await exportSlice({ organization, user, filter: row.selection!.filter });
            expect(slice.price).toBe(60_00);
            expect(slice.count).toBe(1);

            // While the list still shows the whole payment
            const listed = await getBreakdown({ organization, user, filter: row.selection!.listFilter });
            expect(listed.body.price).toBe(100_00);
        });

        test('narrowing down reads less without changing what a row adds up to', async () => {
            const organization = await new OrganizationFactory({}).create();
            const user = await createFinanceUser(organization);

            const kapoenen = await createRegistrationItem(organization, { price: 60_00, groupId: 'group-a', groupName: 'Kapoenen' });
            const welpen = await createRegistrationItem(organization, { price: 40_00, groupId: 'group-b', groupName: 'Welpen' });

            await createPayment(organization, { items: [[kapoenen, 60_00], [welpen, 40_00]] });
            await createPayment(organization, { items: [[welpen, 40_00]] });

            const all = await getBreakdown({ organization, user });
            const row = all.body.byCategory.find(g => g.name.toString() === 'Kapoenen')!;
            const path = [BreakdownPathItem.create({ tab: BreakdownTab.Category, id: row.id })];

            const opened = await getBreakdown({ organization, user, path });

            // Leaving out the payments this row doesn't hold may never change what it says
            const narrowed = await getBreakdown({ organization, user, path, narrowFilter: row.selection!.listFilter });

            expect(narrowed.body.price).toBe(opened.body.price);
            expect(narrowed.body.paymentCount).toBe(opened.body.paymentCount);
            expect(narrowed.body.selection.filter).toEqual(opened.body.selection.filter);
        });

        test('a search selects the same payments in the breakdown and in the export', async () => {
            const organization = await new OrganizationFactory({}).create();
            const user = await createFinanceUser(organization);

            const wanted = await createRegistrationItem(organization, { price: 60_00, groupId: 'group-a', groupName: 'Kapoenen' });
            const other = await createRegistrationItem(organization, { price: 40_00, groupId: 'group-b', groupName: 'Welpen' });

            // One payment paid for both, so a row per category holds a part of it
            await createPayment(organization, { items: [[wanted, 60_00], [other, 40_00]], transferDescription: 'GEZOCHT' });
            await createPayment(organization, { items: [[other, 40_00]], transferDescription: 'ANDERE' });

            const found = await getBreakdown({ organization, user, search: 'GEZOCHT' });

            expect(found.body.price).toBe(100_00);
            expect(found.body.paymentCount).toBe(1);

            // The file has to hold exactly what was added up: without the search it would hold both
            const row = found.body.byCategory.find(g => g.name.toString() === 'Kapoenen')!;
            const slice = await exportSlice({ organization, user, filter: row.selection!.filter, search: 'GEZOCHT' });

            expect(slice.price).toBe(row.price);
            expect(slice.count).toBe(1);
        });

        test('a row that holds whole payments is exported as payments', async () => {
            const organization = await new OrganizationFactory({}).create();
            const user = await createFinanceUser(organization);

            const item = await createRegistrationItem(organization, { price: 100_00, groupId: 'group-a', groupName: 'Kapoenen' });
            await createPayment(organization, { items: [[item, 100_00]] });

            const all = await getBreakdown({ organization, user });
            const row = all.body.byCategory[0];

            // Nothing was split, so there is no reason to export the parts of these payments
            expect(row.selection!.isListPartial).toBe(false);
            expect(row.selection!.objectType).toBe(BreakdownObjectType.Payments);
            expect(row.selection!.filter).toEqual(row.selection!.listFilter);
        });

        test('a row that holds a part of its payments can be opened to export it', async () => {
            const organization = await new OrganizationFactory({}).create();
            const user = await createFinanceUser(organization);

            const registration = await createRegistrationItem(organization, { price: 60_00, groupId: 'group-a', groupName: 'Kapoenen' });
            const other = await createRegistrationItem(organization, { price: 40_00, groupId: 'group-b', groupName: 'Welpen' });

            await createPayment(organization, { items: [[registration, 60_00], [other, 40_00]] });

            const all = await getBreakdown({ organization, user });

            // An article is the deepest level, so it is normally only shown as a list. A row that holds
            // a part of its payments is the exception: that part only exists as its own breakdown
            const article = all.body.byArticle.find(g => g.name.toString().includes('Kapoenen'))!;
            expect(article.selection!.isListPartial).toBe(true);
            expect(article.canNarrowDown).toBe(true);
        });

        // The filter a breakdown starts from is about payments, while a slice is read from the balance
        // item payments: everything it says has to keep pointing at the payments table
        describe('The selection the breakdown started from', () => {
            test.each([
                ['a date the payments were paid', () => ({ paidAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } })],
                ['the payments that were picked by hand', (paymentId: string) => ({ id: { $in: [paymentId] } })],
            ] as [string, (paymentId: string) => StamhoofdFilter][])('is kept by the slice export: %s', async (_name, buildFilter) => {
                const organization = await new OrganizationFactory({}).create();
                const user = await createFinanceUser(organization);

                const registration = await createRegistrationItem(organization, { price: 60_00, groupId: 'group-a', groupName: 'Kapoenen' });
                const other = await createRegistrationItem(organization, { price: 40_00, groupId: 'group-b', groupName: 'Welpen' });

                const payment = await createPayment(organization, { items: [[registration, 60_00], [other, 40_00]] });
                const filter = buildFilter(payment.id);

                const all = await getBreakdown({ organization, user, filter });
                const row = all.body.byCategory.find(g => g.name.toString() === 'Kapoenen')!;
                expect(row.price).toBe(60_00);

                const slice = await exportSlice({ organization, user, filter: row.selection!.filter });
                expect(slice.price).toBe(60_00);
                expect(slice.count).toBe(1);
            });

            test('leaves the slice export empty when it selects other payments', async () => {
                const organization = await new OrganizationFactory({}).create();
                const user = await createFinanceUser(organization);

                const registration = await createRegistrationItem(organization, { price: 60_00, groupId: 'group-a', groupName: 'Kapoenen' });
                const other = await createRegistrationItem(organization, { price: 40_00, groupId: 'group-b', groupName: 'Welpen' });

                await createPayment(organization, { items: [[registration, 60_00], [other, 40_00]] });

                const all = await getBreakdown({ organization, user });
                const row = all.body.byCategory.find(g => g.name.toString() === 'Kapoenen')!;

                // The same row, but asked for payments that don't exist: reading the date of the
                // balance item payment instead of the one of the payment would still find them
                const slice = await exportSlice({
                    organization,
                    user,
                    filter: { $and: [row.selection!.filter, { payment: { createdAt: { $lt: new Date('2000-01-01') } } }] },
                });

                expect(slice.count).toBe(0);
            });
        });
    });
});
