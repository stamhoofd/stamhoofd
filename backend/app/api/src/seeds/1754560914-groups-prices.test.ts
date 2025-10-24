import { Group, GroupFactory, Organization, OrganizationFactory, OrganizationRegistrationPeriod, OrganizationRegistrationPeriodFactory, RegistrationPeriod, RegistrationPeriodFactory } from '@stamhoofd/models';
import { GroupCategory, GroupCategorySettings, GroupPriceDiscountType, OldGroupPrice, OldGroupPrices, TranslatedString } from '@stamhoofd/structures';
import { migratePrices } from './1754560914-groups-prices';

describe('migration.migratePrices', () => {
    /**
     * Test case 1 description:
     * An organization with 3 groups. Group 1 and 2 are in the same category. Only group 1 has prices set with a discount if family members are in the same category.
     * The tests checks if the prices and bundle discounts for each group are migrated correctly. See each test for a more detailed description.
     */
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

            // initial price with discount if family members in same category
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

            // price with discount after startDate 2025-03-01 if family members in same category
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

            // add both prices with discounts to group 1
            group1.settings.oldPrices = [oldPrices2, oldPrices1];

            await group1.save();

            group2 = await new GroupFactory({ organization, period }).create();
            group2.settings.prices = [];
            // do not set old prices for group 2 (should be set to 0 automatically in migration)
            group2.settings.oldPrices = [];
            group2.settings.name = new TranslatedString('group2');
            await group2.save();

            group3 = await new GroupFactory({ organization, period }).create();
            group3.settings.prices = [];
            // do not set old prices for group 3 (should be set to 0 automatically in migration)
            group3.settings.oldPrices = [];
            group3.settings.name = new TranslatedString('group3');
            await group3.save();

            // add group 1 and to 2 to same category, add group 3 to different category
            organizationPeriod.settings.categories = [
                GroupCategory.create({
                    settings: GroupCategorySettings.create({ name: 'category1' }),
                    groupIds: [group1.id, group2.id],
                }),
                GroupCategory.create({
                    settings: GroupCategorySettings.create({ name: 'category2' }),
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

            // the organization period should have 1 bundle discount for family members in category 1
            expect(orgPeriod!.settings.bundleDiscounts).toHaveLength(1);

            expect(orgPeriod!.settings.bundleDiscounts).toEqual(
                expect.arrayContaining([
                    // is connected to family discount, but zero discount
                    expect.objectContaining({ discounts: expect.arrayContaining([
                        expect.objectContaining({
                            type: GroupPriceDiscountType.Fixed,
                            value: expect.objectContaining({
                                price: 5,
                                reducedPrice: 5,
                            }),
                        }),
                        expect.objectContaining({
                            type: GroupPriceDiscountType.Fixed,
                            value: expect.objectContaining({
                                price: 10,
                                reducedPrice: 10,
                            }),
                        }),
                    ]) }),
                ]),
            );
        });

        test('group 1', async () => {
            const g1 = await Group.getByID(group1.id);

            // check prices (should be equal to old prices)
            expect(g1!.settings.oldPrices).toHaveLength(0);
            expect(g1!.settings.prices).toHaveLength(2);
            expect(g1!.settings.prices[0].price.price).toBe(30);
            expect(g1!.settings.prices[0].price.reducedPrice).toBe(20);
            expect(g1!.settings.prices[1].price.price).toBe(300);
            expect(g1!.settings.prices[1].price.reducedPrice).toBe(200);

            // check bundle discounts (each price should have 1 bundle discount for family members in same category)
            expect(g1!.settings.prices[0].bundleDiscounts.size).toBe(1);
            expect(g1!.settings.prices[1].bundleDiscounts.size).toBe(1);

            // custom discount for bundle discount of first price should be null
            expect([...g1!.settings.prices[0].bundleDiscounts.values()]).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({ customDiscounts: null }),
                ]),
            );

            // custom discount for bundle discount of second price should not be null, it should contain the discount for oldPrices2
            expect([...g1!.settings.prices[1].bundleDiscounts.values()]).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({ customDiscounts: expect.arrayContaining([
                        expect.objectContaining({
                            type: GroupPriceDiscountType.Fixed,
                            value: expect.objectContaining({
                                price: 100,
                                reducedPrice: 100,
                            }),
                        }),
                    ]) }),
                ]),
            );
        });

        test('group 2', async () => {
            // group 2
            const g2 = await Group.getByID(group2.id);

            // check prices (the price should be 0 because there were no old prices configured)
            expect(g2!.settings.oldPrices).toHaveLength(0);
            expect(g2!.settings.prices).toHaveLength(1);
            expect(g2!.settings.prices[0].price.price).toBe(0);
            expect(g2!.settings.prices[0].price.reducedPrice).toBeNull();

            // check bundle discounts (each price should have 1 bundle discount for family members in same category)
            expect(g2!.settings.prices[0].bundleDiscounts.size).toBe(1);
        });

        test('group 3', async () => {
            // group 3
            const g3 = await Group.getByID(group3.id);

            // check prices (the price should be 0 because there were no old prices configured)
            expect(g3!.settings.oldPrices).toHaveLength(0);
            expect(g3!.settings.prices).toHaveLength(1);
            expect(g3!.settings.prices[0].price.price).toBe(0);
            expect(g3!.settings.prices[0].price.reducedPrice).toBeNull();

            // check bundle discounts (should have no bundle discount)
            expect(g3!.settings.prices[0].bundleDiscounts.size).toBe(0);
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
                    settings: GroupCategorySettings.create({ name: 'category1' }),
                    groupIds: [group1.id, group2.id],
                }),
                GroupCategory.create({
                    settings: GroupCategorySettings.create({ name: 'category2' }),
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

        test.skip('organization period', async () => {
            // check organization registration period
            const orgPeriod = await OrganizationRegistrationPeriod.getByID(organizationPeriod.id);
            expect(orgPeriod!.settings.bundleDiscounts).toHaveLength(3);
        });

        test.skip('group 1', async () => {
            const g1 = await Group.getByID(group1.id);

            // check prices (should be equal to old prices)
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

        test.skip('group 2', async () => {
            // group 2
            const g2 = await Group.getByID(group2.id);

            // check prices (should be equal to old prices)
            expect(g2!.settings.oldPrices).toHaveLength(0);
            expect(g2!.settings.prices).toHaveLength(1);
            expect(g2!.settings.prices[0].price.price).toBe(0);
            expect(g2!.settings.prices[0].price.reducedPrice).toBeNull();

            // check bundle discounts
            expect(g2!.settings.prices[0].bundleDiscounts.size).toBe(2); // category discount from group 1
        });

        test.skip('group 3', async () => {
            // group 3
            const g3 = await Group.getByID(group3.id);

            // check prices (should be equal to old prices)
            expect(g3!.settings.oldPrices).toHaveLength(0);
            expect(g3!.settings.prices).toHaveLength(1);
            expect(g3!.settings.prices[0].price.price).toBe(0);
            expect(g3!.settings.prices[0].price.reducedPrice).toBeNull();

            // check bundle discounts
            expect(g3!.settings.prices[0].bundleDiscounts.size).toBe(1); // no category discount from group 1
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

            // family members in category and other price
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
                    settings: GroupCategorySettings.create({ name: 'category1' }),
                    groupIds: [group1.id, group2.id],
                }),
                GroupCategory.create({
                    settings: GroupCategorySettings.create({ name: 'category2' }),
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

        test.skip('organization period', async () => {
            // check organization registration period
            const orgPeriod = await OrganizationRegistrationPeriod.getByID(organizationPeriod.id);
            expect(orgPeriod!.settings.bundleDiscounts).toHaveLength(4);
        });

        test.skip('group 1', async () => {
            const g1 = await Group.getByID(group1.id);

            // check prices (should be equal to old prices)
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

        test.skip('group 2', async () => {
            // group 2
            const g2 = await Group.getByID(group2.id);

            // check prices (should be equal to old prices)
            expect(g2!.settings.oldPrices).toHaveLength(0);
            expect(g2!.settings.prices).toHaveLength(1);
            expect(g2!.settings.prices[0].price.price).toBe(0);
            expect(g2!.settings.prices[0].price.reducedPrice).toBeNull();

            // check bundle discounts
            expect(g2!.settings.prices[0].bundleDiscounts.size).toBe(3); // category discount from group 1
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

        test.skip('group 3', async () => {
            // group 3
            const g3 = await Group.getByID(group3.id);

            // check prices (should be equal to old prices)
            expect(g3!.settings.oldPrices).toHaveLength(0);
            expect(g3!.settings.prices).toHaveLength(1);
            expect(g3!.settings.prices[0].price.price).toBe(0);
            expect(g3!.settings.prices[0].price.reducedPrice).toBeNull();

            // check bundle discounts
            expect(g3!.settings.prices[0].bundleDiscounts.size).toBe(1); // no category discount from group 1
        });
    });

    describe('Case 4 - combination of different discounts and multiple group categories', () => {
        let period: RegistrationPeriod;
        let organization: Organization;
        let organizationPeriod: OrganizationRegistrationPeriod;
        let group1: Group;
        let group2: Group;
        let group3: Group;
        let group4: Group;

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

            // family members in category and other price
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

            // same members in category
            const oldPrices3 = OldGroupPrices.create({
                startDate: new Date(2025, 6, 5),
                sameMemberOnlyDiscount: true,
                onlySameGroup: true,
                prices: [
                    OldGroupPrice.create({
                        price: 31,
                        reducedPrice: 21,
                    }),
                    OldGroupPrice.create({
                        price: 26,
                        reducedPrice: 16,
                    }),
                    OldGroupPrice.create({
                        price: 21,
                        reducedPrice: 11,
                    }),
                ],
            });

            group1.settings.oldPrices = [oldPrices2, oldPrices1, oldPrices3];

            await group1.save();

            group2 = await new GroupFactory({ organization, period }).create();
            group2.settings.prices = [];

            const oldPrices_g2_1 = OldGroupPrices.create({
                startDate: null,
                sameMemberOnlyDiscount: false,
                onlySameGroup: false,
                prices: [
                    OldGroupPrice.create({
                        price: 32,
                        reducedPrice: 22,
                    }),
                    OldGroupPrice.create({
                        price: 27,
                        reducedPrice: 17,
                    }),
                    OldGroupPrice.create({
                        price: 22,
                        reducedPrice: 12,
                    }),
                ],
            });

            const oldPrices_g2_2 = OldGroupPrices.create({
                startDate: new Date(2025, 7, 2),
                sameMemberOnlyDiscount: false,
                onlySameGroup: false,
                prices: [
                    OldGroupPrice.create({
                        price: 33,
                        reducedPrice: 23,
                    }),
                    OldGroupPrice.create({
                        price: 23,
                        reducedPrice: 13,
                    }),
                ],
            });
            group2.settings.oldPrices = [oldPrices_g2_1, oldPrices_g2_2];
            group2.settings.name = new TranslatedString('group2');
            await group2.save();

            group3 = await new GroupFactory({ organization, period }).create();
            group3.settings.prices = [];
            const oldPrices_g3_1 = OldGroupPrices.create({
                startDate: null,
                sameMemberOnlyDiscount: true,
                onlySameGroup: false,
                prices: [
                    OldGroupPrice.create({
                        price: 29,
                        reducedPrice: 19,
                    }),
                    OldGroupPrice.create({
                        price: 28,
                        reducedPrice: 18,
                    }),
                ],
            });
            group3.settings.oldPrices = [oldPrices_g3_1];
            group3.settings.name = new TranslatedString('group3');
            await group3.save();

            group4 = await new GroupFactory({ organization, period }).create();
            group4.settings.prices = [];
            group4.settings.oldPrices = [];
            group4.settings.name = new TranslatedString('group4');
            await group4.save();

            organizationPeriod.settings.categories = [
                GroupCategory.create({
                    settings: GroupCategorySettings.create({ name: 'category1' }),
                    groupIds: [group1.id, group2.id],
                }),
                GroupCategory.create({
                    settings: GroupCategorySettings.create({ name: 'category2' }),
                    groupIds: [group3.id, group4.id],
                }),
            ];

            await organizationPeriod.save();

            await migratePrices();
        });

        afterAll(async () => {
            await group1.delete();
            await group2.delete();
            await group3.delete();
            await group4.delete();

            await organizationPeriod.delete();
            period.organizationId = null;
            await period.save();

            await organization.delete();
            await period.delete();
        });

        test.skip('organization period', async () => {
            // check organization registration period
            const orgPeriod = await OrganizationRegistrationPeriod.getByID(organizationPeriod.id);
            expect(orgPeriod!.settings.bundleDiscounts).toHaveLength(5);
            expect([...orgPeriod!.settings.bundleDiscounts.values()]).toEqual(
                expect.arrayContaining([
                    // todo: check discounts
                    expect.objectContaining({ countWholeFamily: false, countPerGroup: false }),
                    expect.objectContaining({ countWholeFamily: true, countPerGroup: false }),
                    expect.objectContaining({ countWholeFamily: true, countPerGroup: false }),
                    expect.objectContaining({ countWholeFamily: true, countPerGroup: true }),
                    expect.objectContaining({ countWholeFamily: false, countPerGroup: true }),
                    // is connected to family discount, but zero discount
                    // expect.objectContaining({ customDiscounts: expect.arrayContaining([
                    //     expect.objectContaining({
                    //         type: GroupPriceDiscountType.Fixed,
                    //         value: expect.objectContaining({
                    //             price: 0,
                    //             reducedPrice: null,
                    //         }),
                    //     }),
                    // ]) }),
                ]),
            );
        });

        test.skip('group 1', async () => {
            const g1 = await Group.getByID(group1.id);

            // check prices (should be equal to old prices)
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

        test.skip('group 2', async () => {
            // group 2
            const g2 = await Group.getByID(group2.id);

            // check prices (should be equal to old prices)
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

        test.skip('group 3', async () => {
            // group 3
            const g3 = await Group.getByID(group3.id);

            // check prices (should be equal to old prices)
            expect(g3!.settings.oldPrices).toHaveLength(0);
            expect(g3!.settings.prices).toHaveLength(1);
            expect(g3!.settings.prices[0].price.price).toBe(0);
            expect(g3!.settings.prices[0].price.reducedPrice).toBeNull();

            // check bundle discounts
            expect(g3!.settings.prices[0].bundleDiscounts.size).toBe(0); // no category discount from group 1
        });

        test.skip('group 4', async () => {
            // group 3
            const g4 = await Group.getByID(group4.id);

            // check prices (should be equal to old prices)
            expect(g4!.settings.oldPrices).toHaveLength(0);
            expect(g4!.settings.prices).toHaveLength(1);
            expect(g4!.settings.prices[0].price.price).toBe(0);
            expect(g4!.settings.prices[0].price.reducedPrice).toBeNull();

            // check bundle discounts
            expect(g4!.settings.prices[0].bundleDiscounts.size).toBe(0); // no category discount from group 1
        });
    });
});
