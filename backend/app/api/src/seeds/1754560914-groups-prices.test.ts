import { Group, GroupFactory, Organization, OrganizationFactory, OrganizationRegistrationPeriod, OrganizationRegistrationPeriodFactory, RegistrationPeriod, RegistrationPeriodFactory } from '@stamhoofd/models';
import { GroupCategory, GroupPriceDiscountType, OldGroupPrice, OldGroupPrices, TranslatedString } from '@stamhoofd/structures';
import { migratePrices } from './1754560914-groups-prices';

describe('migration.migratePrices', () => {
    describe('Case 1 - family members in category', () => {
        let period: RegistrationPeriod;
        let organization: Organization;
        let organizationPeriod: OrganizationRegistrationPeriod;
        let group1: Group;
        let group2: Group;
        let group3: Group;

        beforeAll(async () => {
            const startDate = new Date(2025, 0, 1);
            const endDate = new Date(2025, 11, 31);
            period = await new RegistrationPeriodFactory({ startDate, endDate }).create();
            organization = await new OrganizationFactory({ period }).create();
            period.organizationId = organization.id;
            await period.save();
            organizationPeriod = await new OrganizationRegistrationPeriodFactory({ organization, period }).create();

            group1 = await new GroupFactory({ organization, period }).create();
            group1.settings.prices = [];
            group1.settings.name = new TranslatedString('group1');

            // family members in category
            const oldPrices1 = OldGroupPrices.create({
                startDate: null,
                sameMemberOnlyDiscount: false,
                onlySameGroup: false,
                prices: [
                    OldGroupPrice.create({
                        price: 30,
                        reducedPrice: 20,
                    }),
                    OldGroupPrice.create({
                        price: 25,
                        reducedPrice: 15,
                    }),
                    OldGroupPrice.create({
                        price: 20,
                        reducedPrice: 10,
                    }),
                ],
            });

            // family members in category but other price
            const oldPrices2 = OldGroupPrices.create({
                startDate: new Date(2025, 2, 1),
                sameMemberOnlyDiscount: false,
                onlySameGroup: false,
                prices: [
                    OldGroupPrice.create({
                        price: 300,
                        reducedPrice: 200,
                    }),
                    OldGroupPrice.create({
                        price: 200,
                        reducedPrice: 100,
                    }),
                ],
            });

            group1.settings.oldPrices = [oldPrices2, oldPrices1];

            await group1.save();

            group2 = await new GroupFactory({ organization, period }).create();
            group2.settings.prices = [];
            group2.settings.oldPrices = [];
            group2.settings.name = new TranslatedString('group2');
            await group2.save();

            group3 = await new GroupFactory({ organization, period }).create();
            group3.settings.prices = [];
            group3.settings.oldPrices = [];
            group3.settings.name = new TranslatedString('group3');
            await group3.save();

            organizationPeriod.settings.categories = [
                GroupCategory.create({
                    groupIds: [group1.id, group2.id],
                }),
                GroupCategory.create({
                    groupIds: [group3.id],
                }),
            ];

            await organizationPeriod.save();

            await migratePrices();
        });

        afterAll(async () => {
            await group1.delete();
            await group2.delete();
            await group3.delete();

            await organizationPeriod.delete();
            period.organizationId = null;
            await period.save();

            await organization.delete();
            await period.delete();
        });

        test('organization period', async () => {
            // check organization registration period
            const orgPeriod = await OrganizationRegistrationPeriod.getByID(organizationPeriod.id);
            expect(orgPeriod!.settings.bundleDiscounts).toHaveLength(1);
        });

        test('group 1', async () => {
            const g1 = await Group.getByID(group1.id);

            // check prices
            expect(g1!.settings.oldPrices).toHaveLength(0);
            expect(g1!.settings.prices).toHaveLength(2);
            expect(g1!.settings.prices[0].price.price).toBe(30);
            expect(g1!.settings.prices[0].price.reducedPrice).toBe(20);
            expect(g1!.settings.prices[1].price.price).toBe(300);
            expect(g1!.settings.prices[1].price.reducedPrice).toBe(200);

            // check bundle discounts
            expect(g1!.settings.prices[0].bundleDiscounts.size).toBe(1);
            expect(g1!.settings.prices[1].bundleDiscounts.size).toBe(1);
        });

        test('group 2', async () => {
            // group 2
            const g2 = await Group.getByID(group2.id);

            // check prices
            expect(g2!.settings.oldPrices).toHaveLength(0);
            expect(g2!.settings.prices).toHaveLength(1);
            expect(g2!.settings.prices[0].price.price).toBe(0);
            expect(g2!.settings.prices[0].price.reducedPrice).toBeNull();

            // check bundle discounts
            expect(g2!.settings.prices[0].bundleDiscounts.size).toBe(1); // category discount from group 1
        });

        test('group 3', async () => {
            // group 3
            const g3 = await Group.getByID(group3.id);

            // check prices
            expect(g3!.settings.oldPrices).toHaveLength(0);
            expect(g3!.settings.prices).toHaveLength(1);
            expect(g3!.settings.prices[0].price.price).toBe(0);
            expect(g3!.settings.prices[0].price.reducedPrice).toBeNull();

            // check bundle discounts
            expect(g3!.settings.prices[0].bundleDiscounts.size).toBe(0); // no category discount from group 1
        });
    });

    describe('Case 2 - same members in category', () => {
        let period: RegistrationPeriod;
        let organization: Organization;
        let organizationPeriod: OrganizationRegistrationPeriod;
        let group1: Group;
        let group2: Group;
        let group3: Group;

        beforeAll(async () => {
            const startDate = new Date(2025, 0, 1);
            const endDate = new Date(2025, 11, 31);
            period = await new RegistrationPeriodFactory({ startDate, endDate }).create();
            organization = await new OrganizationFactory({ period }).create();
            period.organizationId = organization.id;
            await period.save();
            organizationPeriod = await new OrganizationRegistrationPeriodFactory({ organization, period }).create();

            group1 = await new GroupFactory({ organization, period }).create();
            group1.settings.prices = [];
            group1.settings.name = new TranslatedString('group1');

            // same members in category
            const oldPrices1 = OldGroupPrices.create({
                startDate: null,
                sameMemberOnlyDiscount: true,
                onlySameGroup: false,
                prices: [
                    OldGroupPrice.create({
                        price: 30,
                        reducedPrice: 20,
                    }),
                    OldGroupPrice.create({
                        price: 25,
                        reducedPrice: 15,
                    }),
                    OldGroupPrice.create({
                        price: 20,
                        reducedPrice: 10,
                    }),
                ],
            });

            // same members in category but other price
            const oldPrices2 = OldGroupPrices.create({
                startDate: new Date(2025, 2, 1),
                sameMemberOnlyDiscount: true,
                onlySameGroup: false,
                prices: [
                    OldGroupPrice.create({
                        price: 300,
                        reducedPrice: 200,
                    }),
                    OldGroupPrice.create({
                        price: 200,
                        reducedPrice: 100,
                    }),
                ],
            });

            group1.settings.oldPrices = [oldPrices2, oldPrices1];

            await group1.save();

            group2 = await new GroupFactory({ organization, period }).create();
            group2.settings.prices = [];
            group2.settings.oldPrices = [];
            group2.settings.name = new TranslatedString('group2');
            await group2.save();

            group3 = await new GroupFactory({ organization, period }).create();
            group3.settings.prices = [];
            group3.settings.oldPrices = [];
            group3.settings.name = new TranslatedString('group3');
            await group3.save();

            organizationPeriod.settings.categories = [
                GroupCategory.create({
                    groupIds: [group1.id, group2.id],
                }),
                GroupCategory.create({
                    groupIds: [group3.id],
                }),
            ];

            await organizationPeriod.save();

            await migratePrices();
        });

        afterAll(async () => {
            await group1.delete();
            await group2.delete();
            await group3.delete();

            await organizationPeriod.delete();
            period.organizationId = null;
            await period.save();

            await organization.delete();
            await period.delete();
        });

        test('organization period', async () => {
            // check organization registration period
            const orgPeriod = await OrganizationRegistrationPeriod.getByID(organizationPeriod.id);
            expect(orgPeriod!.settings.bundleDiscounts).toHaveLength(1);
        });

        test('group 1', async () => {
            const g1 = await Group.getByID(group1.id);

            // check prices
            expect(g1!.settings.oldPrices).toHaveLength(0);
            expect(g1!.settings.prices).toHaveLength(2);
            expect(g1!.settings.prices[0].price.price).toBe(30);
            expect(g1!.settings.prices[0].price.reducedPrice).toBe(20);
            expect(g1!.settings.prices[1].price.price).toBe(300);
            expect(g1!.settings.prices[1].price.reducedPrice).toBe(200);

            // check bundle discounts
            expect(g1!.settings.prices[0].bundleDiscounts.size).toBe(1);
            expect(g1!.settings.prices[1].bundleDiscounts.size).toBe(1);
        });

        test('group 2', async () => {
            // group 2
            const g2 = await Group.getByID(group2.id);

            // check prices
            expect(g2!.settings.oldPrices).toHaveLength(0);
            expect(g2!.settings.prices).toHaveLength(1);
            expect(g2!.settings.prices[0].price.price).toBe(0);
            expect(g2!.settings.prices[0].price.reducedPrice).toBeNull();

            // check bundle discounts
            expect(g2!.settings.prices[0].bundleDiscounts.size).toBe(1); // category discount from group 1
        });

        test('group 3', async () => {
            // group 3
            const g3 = await Group.getByID(group3.id);

            // check prices
            expect(g3!.settings.oldPrices).toHaveLength(0);
            expect(g3!.settings.prices).toHaveLength(1);
            expect(g3!.settings.prices[0].price.price).toBe(0);
            expect(g3!.settings.prices[0].price.reducedPrice).toBeNull();

            // check bundle discounts
            expect(g3!.settings.prices[0].bundleDiscounts.size).toBe(0); // no category discount from group 1
        });
    });

    describe('Case 3 - combination of family members in category and same members in category', () => {
        let period: RegistrationPeriod;
        let organization: Organization;
        let organizationPeriod: OrganizationRegistrationPeriod;
        let group1: Group;
        let group2: Group;
        let group3: Group;

        beforeAll(async () => {
            const startDate = new Date(2025, 0, 1);
            const endDate = new Date(2025, 11, 31);
            period = await new RegistrationPeriodFactory({ startDate, endDate }).create();
            organization = await new OrganizationFactory({ period }).create();
            period.organizationId = organization.id;
            await period.save();
            organizationPeriod = await new OrganizationRegistrationPeriodFactory({ organization, period }).create();

            group1 = await new GroupFactory({ organization, period }).create();
            group1.settings.prices = [];
            group1.settings.name = new TranslatedString('group1');

            // family members in category
            const oldPrices1 = OldGroupPrices.create({
                startDate: null,
                sameMemberOnlyDiscount: true,
                onlySameGroup: false,
                prices: [
                    OldGroupPrice.create({
                        price: 30,
                        reducedPrice: 20,
                    }),
                    OldGroupPrice.create({
                        price: 25,
                        reducedPrice: 15,
                    }),
                    OldGroupPrice.create({
                        price: 20,
                        reducedPrice: 10,
                    }),
                ],
            });

            // same members in category and other price
            const oldPrices2 = OldGroupPrices.create({
                startDate: new Date(2025, 2, 1),
                sameMemberOnlyDiscount: false,
                onlySameGroup: false,
                prices: [
                    OldGroupPrice.create({
                        price: 300,
                        reducedPrice: 200,
                    }),
                    OldGroupPrice.create({
                        price: 200,
                        reducedPrice: 100,
                    }),
                ],
            });

            group1.settings.oldPrices = [oldPrices2, oldPrices1];

            await group1.save();

            group2 = await new GroupFactory({ organization, period }).create();
            group2.settings.prices = [];
            group2.settings.oldPrices = [];
            group2.settings.name = new TranslatedString('group2');
            await group2.save();

            group3 = await new GroupFactory({ organization, period }).create();
            group3.settings.prices = [];
            group3.settings.oldPrices = [];
            group3.settings.name = new TranslatedString('group3');
            await group3.save();

            organizationPeriod.settings.categories = [
                GroupCategory.create({
                    groupIds: [group1.id, group2.id],
                }),
                GroupCategory.create({
                    groupIds: [group3.id],
                }),
            ];

            await organizationPeriod.save();

            await migratePrices();
        });

        afterAll(async () => {
            await group1.delete();
            await group2.delete();
            await group3.delete();

            await organizationPeriod.delete();
            period.organizationId = null;
            await period.save();

            await organization.delete();
            await period.delete();
        });

        test('organization period', async () => {
            // check organization registration period
            const orgPeriod = await OrganizationRegistrationPeriod.getByID(organizationPeriod.id);
            expect(orgPeriod!.settings.bundleDiscounts).toHaveLength(2);
        });

        test('group 1', async () => {
            const g1 = await Group.getByID(group1.id);

            // check prices
            expect(g1!.settings.oldPrices).toHaveLength(0);
            expect(g1!.settings.prices).toHaveLength(2);
            expect(g1!.settings.prices[0].price.price).toBe(30);
            expect(g1!.settings.prices[0].price.reducedPrice).toBe(20);
            expect(g1!.settings.prices[1].price.price).toBe(300);
            expect(g1!.settings.prices[1].price.reducedPrice).toBe(200);

            // check bundle discounts
            expect(g1!.settings.prices[0].bundleDiscounts.size).toBe(2);
            expect([...g1!.settings.prices[0].bundleDiscounts.values()]).toEqual(
                expect.arrayContaining([
                    // is default discount for category
                    expect.objectContaining({ customDiscounts: null }),
                    // is connected to family discount, but zero discount
                    expect.objectContaining({ customDiscounts: expect.arrayContaining([
                        expect.objectContaining({
                            type: GroupPriceDiscountType.Fixed,
                            value: expect.objectContaining({
                                price: 0,
                                reducedPrice: null,
                            }),
                        }),
                    ]) }),
                ]),
            );
            expect(g1!.settings.prices[1].bundleDiscounts.size).toBe(2);
            expect([...g1!.settings.prices[1].bundleDiscounts.values()]).toEqual(
                expect.arrayContaining([
                    // is default discount for category
                    expect.objectContaining({ customDiscounts: null }),
                    // is connected to member only discount, but zero discount
                    expect.objectContaining({ customDiscounts: expect.arrayContaining([
                        expect.objectContaining({
                            type: GroupPriceDiscountType.Fixed,
                            value: expect.objectContaining({
                                price: 0,
                                reducedPrice: null,
                            }),
                        }),
                    ]) }),
                ]),
            );
        });

        test('group 2', async () => {
            // group 2
            const g2 = await Group.getByID(group2.id);

            // check prices
            expect(g2!.settings.oldPrices).toHaveLength(0);
            expect(g2!.settings.prices).toHaveLength(1);
            expect(g2!.settings.prices[0].price.price).toBe(0);
            expect(g2!.settings.prices[0].price.reducedPrice).toBeNull();

            // check bundle discounts
            expect(g2!.settings.prices[0].bundleDiscounts.size).toBe(2); // category discount from group 1
            expect([...g2!.settings.prices[0].bundleDiscounts.values()]).toEqual(
                expect.arrayContaining([
                    // is connected to family discount, but zero discount
                    expect.objectContaining({ customDiscounts: expect.arrayContaining([
                        expect.objectContaining({
                            type: GroupPriceDiscountType.Fixed,
                            value: expect.objectContaining({
                                price: 0,
                                reducedPrice: null,
                            }),
                        }),
                    ]) }),
                    // is connected to member only discount, but zero discount
                    expect.objectContaining({ customDiscounts: expect.arrayContaining([
                        expect.objectContaining({
                            type: GroupPriceDiscountType.Fixed,
                            value: expect.objectContaining({
                                price: 0,
                                reducedPrice: null,
                            }),
                        }),
                    ]) }),
                ]),
            );
        });

        test('group 3', async () => {
            // group 3
            const g3 = await Group.getByID(group3.id);

            // check prices
            expect(g3!.settings.oldPrices).toHaveLength(0);
            expect(g3!.settings.prices).toHaveLength(1);
            expect(g3!.settings.prices[0].price.price).toBe(0);
            expect(g3!.settings.prices[0].price.reducedPrice).toBeNull();

            // check bundle discounts
            expect(g3!.settings.prices[0].bundleDiscounts.size).toBe(0); // no category discount from group 1
        });
    });
});
