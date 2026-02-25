import { Group, GroupFactory, Organization, OrganizationFactory, OrganizationRegistrationPeriod, OrganizationRegistrationPeriodFactory, RegistrationPeriod, RegistrationPeriodFactory } from '@stamhoofd/models';
import { GroupCategory, GroupCategorySettings, GroupPriceDiscountType, GroupStatus, OldGroupPrice, OldGroupPrices, TranslatedString } from '@stamhoofd/structures';
import { migratePrices } from './1754560914-groups-prices.js';

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
                    expect.objectContaining({
                        // the discount should be for family members in category 1
                        countWholeFamily: true,
                        countPerGroup: false,
                        // should contain the differences for oldPrices1
                        discounts: expect.arrayContaining([
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
            expect(g1!.settings.prices).toHaveLength(2);
            expect(g1!.settings.prices[0].price.price).toBe(30);
            expect(g1!.settings.prices[0].price.reducedPrice).toBe(20);
            expect(g1!.settings.prices[1].price.price).toBe(300);
            expect(g1!.settings.prices[1].price.reducedPrice).toBe(200);

            // check bundle discounts (each price should have 1 bundle discount for family members in same category)
            expect(g1!.settings.prices[0].bundleDiscounts.size).toBe(1);
            expect(g1!.settings.prices[1].bundleDiscounts.size).toBe(1);

            // custom discount for bundle discount of the first price should be null because the discounts are not different than the discounts for the bundle discount that is configured in the settings of the organization (which are the discounts for oldPrices1)
            expect([...g1!.settings.prices[0].bundleDiscounts.values()]).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({ customDiscounts: null }),
                ]),
            );

            // custom discount for bundle discount of second price should not be null because the discounts are different than the bundle discount that is configured in the settings of the organization (which are the discounts for oldPrices1), it should contain the discount for oldPrices2
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
            expect(g2!.settings.prices).toHaveLength(1);
            expect(g2!.settings.prices[0].price.price).toBe(0);
            expect(g2!.settings.prices[0].price.reducedPrice).toBeNull();

            // check bundle discounts (each price should have 1 bundle discount for family members in same category)
            expect(g2!.settings.prices[0].bundleDiscounts.size).toBe(1);

            // The custom discounts should be 0 because there were no prices for the group. It should only be linked to the bundle discount because the discount for group 1 should be applied if a member inscribes for group 2.
            expect([...g2!.settings.prices[0].bundleDiscounts.values()]).toEqual(
                expect.arrayContaining([
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

            // check prices (the price should be 0 because there were no old prices configured)
            expect(g3!.settings.oldPrices).toHaveLength(0);
            expect(g3!.settings.prices).toHaveLength(1);
            expect(g3!.settings.prices[0].price.price).toBe(0);
            expect(g3!.settings.prices[0].price.reducedPrice).toBeNull();

            // check bundle discounts (should have no bundle discount because the group is in another category)
            expect(g3!.settings.prices[0].bundleDiscounts.size).toBe(0);
        });
    });

    /**
     * Test case 2 description:
     * An organization with 3 groups. Group 1 and 2 are in the same category. Only group 1 has prices set with a discount if same members are in the same category.
     * The tests checks if the prices and bundle discounts for each group are migrated correctly. See each test for a more detailed description.
     */
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

            // initial price with discount if same members in same category
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

            // price with discount after startDate 2025-03-01 if same members in same category
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

        test('organization period', async () => {
            // check organization registration period
            const orgPeriod = await OrganizationRegistrationPeriod.getByID(organizationPeriod.id);

            // the organization period should have 1 bundle discount for same members in category 1
            expect(orgPeriod!.settings.bundleDiscounts).toHaveLength(1);

            expect(orgPeriod!.settings.bundleDiscounts).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({
                        // the discount should be for same members in category 1
                        countWholeFamily: false,
                        countPerGroup: false,
                        discounts: expect.arrayContaining([
                            // should contain the differences for oldPrices1
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
            expect(g1!.settings.prices).toHaveLength(2);
            expect(g1!.settings.prices[0].price.price).toBe(30);
            expect(g1!.settings.prices[0].price.reducedPrice).toBe(20);
            expect(g1!.settings.prices[1].price.price).toBe(300);
            expect(g1!.settings.prices[1].price.reducedPrice).toBe(200);

            // check bundle discounts (each price should have 1 bundle discount for same members in same category)
            expect(g1!.settings.prices[0].bundleDiscounts.size).toBe(1);
            expect(g1!.settings.prices[1].bundleDiscounts.size).toBe(1);

            // custom discount for bundle discount of the first price should be null because the discounts are not different than the discounts for the bundle discount that is configured in the settings of the organization (which are the discounts for oldPrices1)
            expect([...g1!.settings.prices[0].bundleDiscounts.values()]).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({ customDiscounts: null }),
                ]),
            );

            // custom discount for bundle discount of second price should not be null because the discounts are different than the bundle discount that is configured in the settings of the organization (which are the discounts for oldPrices1), it should contain the discount for oldPrices2
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
            expect(g2!.settings.prices).toHaveLength(1);
            expect(g2!.settings.prices[0].price.price).toBe(0);
            expect(g2!.settings.prices[0].price.reducedPrice).toBeNull();

            // check bundle discounts (each price should have 1 bundle discount for same members in same category)
            expect(g2!.settings.prices[0].bundleDiscounts.size).toBe(1);

            // The custom discounts should be 0 because there were no prices for the group. It should only be linked to the bundle discount because the discount for group 1 should be applied if a member inscribes for group 2.
            expect([...g2!.settings.prices[0].bundleDiscounts.values()]).toEqual(
                expect.arrayContaining([
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

            // check prices (the price should be 0 because there were no old prices configured)
            expect(g3!.settings.oldPrices).toHaveLength(0);
            expect(g3!.settings.prices).toHaveLength(1);
            expect(g3!.settings.prices[0].price.price).toBe(0);
            expect(g3!.settings.prices[0].price.reducedPrice).toBeNull();

            // check bundle discounts (should have no bundle discount because the group is in another category)
            expect(g3!.settings.prices[0].bundleDiscounts.size).toBe(0);
        });
    });

    /**
     * Test case 3 description:
     * An organization with 3 groups. Group 1 and 2 are in the same category. Only group 1 has prices set with a discount if same members are in the same category and a discount if family members are in the same category (after 2025-03-01).
     * The tests checks if the prices and bundle discounts for each group are migrated correctly. See each test for a more detailed description.
     */
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

            // initial price with discount if same members in same category
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

        test('organization period', async () => {
            // check organization registration period
            const orgPeriod = await OrganizationRegistrationPeriod.getByID(organizationPeriod.id);

            // the organization period should have 2 bundle discounts: 1 for family members in category 1 and 1 for same members in category 1
            expect(orgPeriod!.settings.bundleDiscounts).toHaveLength(2);

            expect(orgPeriod!.settings.bundleDiscounts).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({
                        // the discount should be for same members in category 1
                        countWholeFamily: false,
                        countPerGroup: false,
                        // should contain the differences for oldPrices1
                        discounts: expect.arrayContaining([
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
                    expect.objectContaining({
                        // the discount should be for family members in category 1
                        countWholeFamily: true,
                        countPerGroup: false,
                        discounts: expect.arrayContaining([
                            // should contain the differences for oldPrices2
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

        test('group 1', async () => {
            const g1 = await Group.getByID(group1.id);

            // check prices (should be equal to old prices)
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

            // check prices (the price should be 0 because there were no old prices configured)
            expect(g2!.settings.prices).toHaveLength(1);
            expect(g2!.settings.prices[0].price.price).toBe(0);
            expect(g2!.settings.prices[0].price.reducedPrice).toBeNull();

            // check bundle discounts (each price should have 2 bundle discounts for same members in same category and for family members in same category)
            expect(g2!.settings.prices[0].bundleDiscounts.size).toBe(2);

            // The custom discounts should be 0 because there were no prices for the group. It should only be linked to the 2 bundle discounts because the discount for group 1 should be applied if a member inscribes for group 2.
            expect([...g2!.settings.prices[0].bundleDiscounts.values()]).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({ customDiscounts: expect.arrayContaining([
                        expect.objectContaining({
                            type: GroupPriceDiscountType.Fixed,
                            value: expect.objectContaining({
                                price: 0,
                                reducedPrice: null,
                            }),
                        }),
                    ]) }),
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

            // check prices (the price should be 0 because there were no old prices configured)
            expect(g3!.settings.oldPrices).toHaveLength(0);
            expect(g3!.settings.prices).toHaveLength(1);
            expect(g3!.settings.prices[0].price.price).toBe(0);
            expect(g3!.settings.prices[0].price.reducedPrice).toBeNull();

            // check bundle discounts (should have no bundle discount because the group is in another category)
            expect(g3!.settings.prices[0].bundleDiscounts.size).toBe(0);
        });
    });

    /**
     * Test case 4 description:
     * An organization with 4 groups. Group 1 and 2 are in the same category. Group 3 and 4 are also in the same category. Group 1, group 2 and group 3 have prices set (a combination of different discounts). Group 1 also has a discount only for the same group. Group 4 has no prices set.
     * The tests checks if the prices and bundle discounts for each group are migrated correctly. See each test for a more detailed description.
     */
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

            // price with discount if same members in same category
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

            // price with discount after startDate 2025-07-05 if same members in same GROUP
            const oldPrices3 = OldGroupPrices.create({
                startDate: new Date(2025, 6, 5),
                sameMemberOnlyDiscount: true,
                onlySameGroup: true,
                prices: [
                    OldGroupPrice.create({
                        price: 32,
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

            // price with discount if family members in same category
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

            // price with discount after startDate 2025-08-02 if family members in same category
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

            // price with discount if same members in same category
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

        test('organization period', async () => {
            // check organization registration period
            const orgPeriod = await OrganizationRegistrationPeriod.getByID(organizationPeriod.id);
            expect(orgPeriod!.settings.bundleDiscounts).toHaveLength(4);

            // should have 4 different bundle discounts:
            // - oldPrices1
            // - oldPrices2
            // - oldPrices3
            // - oldPrices_g3_1
            expect([...orgPeriod!.settings.bundleDiscounts.values()]).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({ countWholeFamily: false, countPerGroup: false,
                        // should contain discounts for oldPrices1
                        discounts: expect.arrayContaining([
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
                        ]),
                    }),
                    expect.objectContaining({ countWholeFamily: true, countPerGroup: false,
                        // should contain discounts for oldPrices2
                        discounts: expect.arrayContaining([
                            expect.objectContaining({
                                type: GroupPriceDiscountType.Fixed,
                                value: expect.objectContaining({
                                    price: 100,
                                    reducedPrice: 100,
                                }),
                            }),
                        ]),
                    }),
                    expect.objectContaining({ countWholeFamily: false, countPerGroup: true,
                        // should contain discounts for oldPrices3
                        discounts: expect.arrayContaining([
                            expect.objectContaining({
                                type: GroupPriceDiscountType.Fixed,
                                value: expect.objectContaining({
                                    price: 6,
                                    reducedPrice: 5,
                                }),
                            }),
                            expect.objectContaining({
                                type: GroupPriceDiscountType.Fixed,
                                value: expect.objectContaining({
                                    price: 11,
                                    reducedPrice: 10,
                                }),
                            }),
                        ]),
                    }),
                    expect.objectContaining({ countWholeFamily: false, countPerGroup: false,
                        // should contain discounts for oldPrices_g3_1
                        discounts: expect.arrayContaining([
                            expect.objectContaining({
                                type: GroupPriceDiscountType.Fixed,
                                value: expect.objectContaining({
                                    price: 1,
                                    reducedPrice: 1,
                                }),
                            }),
                        ]),
                    }),
                    // see test case 5 for a case where countWholeFamily is true and countPerGroup is true
                ]),
            );
        });

        test('group 1', async () => {
            const g1 = await Group.getByID(group1.id);

            // check prices (should be equal to old prices)
            expect(g1!.settings.prices).toHaveLength(3);
            expect(g1!.settings.prices[0].price.price).toBe(30);
            expect(g1!.settings.prices[0].price.reducedPrice).toBe(20);
            expect(g1!.settings.prices[1].price.price).toBe(300);
            expect(g1!.settings.prices[1].price.reducedPrice).toBe(200);
            expect(g1!.settings.prices[2].price.price).toBe(32);
            expect(g1!.settings.prices[2].price.reducedPrice).toBe(21);

            // // check bundle discounts
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

            expect(g1!.settings.prices[2].bundleDiscounts.size).toBe(3);
            expect([...g1!.settings.prices[2].bundleDiscounts.values()]).toEqual(
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
                    // is default discount for member in group
                    expect.objectContaining({ customDiscounts: null }),
                ]),
            );
        });

        test('group 2', async () => {
            // group 2
            const g2 = await Group.getByID(group2.id);

            // check prices (should be equal to old prices)
            expect(g2!.settings.prices).toHaveLength(2);
            expect(g2!.settings.prices[0].price.price).toBe(32);
            expect(g2!.settings.prices[0].price.reducedPrice).toBe(22);
            expect(g2!.settings.prices[1].price.price).toBe(33);
            expect(g2!.settings.prices[1].price.reducedPrice).toBe(23);

            // check bundle discounts (each price should have 2 bundle discounts for same members in same category and for family members in same category)
            expect(g2!.settings.prices[0].bundleDiscounts.size).toBe(2);

            // There should be 2 custom discounts because the old prices of group 2 are different than the prices of the bundle discounts in the settings of the period.
            expect([...g2!.settings.prices[0].bundleDiscounts.values()]).toEqual(
                expect.arrayContaining([
                    // is connected to family discount, but different discount than group 1
                    expect.objectContaining({ customDiscounts: expect.arrayContaining([
                        expect.objectContaining({
                            type: GroupPriceDiscountType.Fixed,
                            value: expect.objectContaining({
                                price: 5,
                                reducedPrice: 5,
                            }),
                        }),
                    ]) }),
                    // is connected to family discount, but different discount than group 1
                    expect.objectContaining({ customDiscounts: expect.arrayContaining([
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

        test('group 3', async () => {
            // group 3
            const g3 = await Group.getByID(group3.id);

            // check prices (should be equal to old prices)
            expect(g3!.settings.prices).toHaveLength(1);
            expect(g3!.settings.prices[0].price.price).toBe(29);
            expect(g3!.settings.prices[0].price.reducedPrice).toBe(19);

            // check bundle discounts (should be only 1 bundle discount because the group is in another category and group 3 only has 1 discount configured in the old prices)
            expect(g3!.settings.prices[0].bundleDiscounts.size).toBe(1);

            // There should be no custom discounts because the discounts are the same as default
            expect([...g3!.settings.prices[0].bundleDiscounts.values()]).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({ customDiscounts: null }),
                ]),
            );
        });

        test('group 4', async () => {
            // group 4
            const g4 = await Group.getByID(group4.id);

            // check prices (should be equal to old prices)
            expect(g4!.settings.prices).toHaveLength(1);
            expect(g4!.settings.prices[0].price.price).toBe(0);
            expect(g4!.settings.prices[0].price.reducedPrice).toBeNull();

            // Should have 1 bundle discount because group 4 is in the same category as group 3 and group 3 has a discount for family members in the same category. The custom discounts should be 0 because there is no discount for this group, it is only linked.
            expect(g4!.settings.prices[0].bundleDiscounts.size).toBe(1);
            expect([...g4!.settings.prices[0].bundleDiscounts.values()]).toEqual(
                expect.arrayContaining([
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
    });

    /**
     * Test case 5 description:
     * An organization with 3 groups. Group 1 and 2 are in the same category. Only group 1 has prices set with a discount if family members are in the same category and a discount if family members are in the same group.
     * The tests checks if the prices and bundle discounts for each group are migrated correctly. See each test for a more detailed description.
     */
    describe('Case 5 - family members in same group', () => {
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
                onlySameGroup: true,
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
            expect(orgPeriod!.settings.bundleDiscounts).toHaveLength(2);

            expect(orgPeriod!.settings.bundleDiscounts).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({
                        // the discount should be for family members in group 1
                        countWholeFamily: true,
                        countPerGroup: true,
                        // should contain the differences for oldPrices1
                        discounts: expect.arrayContaining([
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
                    expect.objectContaining({
                        // the discount should be for family members in category 1
                        countWholeFamily: true,
                        countPerGroup: false,
                        // should contain the differences for oldPrices1
                        discounts: expect.arrayContaining([
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

        test('group 1', async () => {
            const g1 = await Group.getByID(group1.id);

            // check prices (should be equal to old prices)
            expect(g1!.settings.prices).toHaveLength(2);
            expect(g1!.settings.prices[0].price.price).toBe(30);
            expect(g1!.settings.prices[0].price.reducedPrice).toBe(20);
            expect(g1!.settings.prices[1].price.price).toBe(300);
            expect(g1!.settings.prices[1].price.reducedPrice).toBe(200);

            // check bundle discounts
            // a bundle discount for family members in the same category with 0 discount (only linked) and a bundle discount for family members in the same group
            expect(g1!.settings.prices[0].bundleDiscounts.size).toBe(2);
            // a bundle discount for family members in the same category
            expect(g1!.settings.prices[1].bundleDiscounts.size).toBe(1);

            // custom discount for bundle discount of the first price should be null because the discounts are not different than the discounts for the bundle discount that is configured in the settings of the organization (which are the discounts for oldPrices1)
            expect([...g1!.settings.prices[0].bundleDiscounts.values()]).toEqual(
                expect.arrayContaining([
                    // a bundle discount for family members in the same category with 0 discount (only linked)
                    expect.objectContaining({ customDiscounts:
                        expect.arrayContaining([
                            expect.objectContaining({
                                type: GroupPriceDiscountType.Fixed,
                                value: expect.objectContaining({
                                    price: 0,
                                    reducedPrice: null,
                                }),
                            }),
                        ]),
                    }),
                    // A bundle discount for family members in the same group. No custom discount because the discount is the same as the bundle discount on the organization period.
                    expect.objectContaining({ customDiscounts: null }),
                ]),
            );

            // custom discount for bundle discount of second price should be null because the discounts are the same as the bundle discount that is configured in the settings of the organization (which are the discounts for oldPrices2)
            expect([...g1!.settings.prices[1].bundleDiscounts.values()]).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({ customDiscounts: null }),
                ]),
            );
        });

        test('group 2', async () => {
            // group 2
            const g2 = await Group.getByID(group2.id);

            // check prices (the price should be 0 because there were no old prices configured)
            expect(g2!.settings.prices).toHaveLength(1);
            expect(g2!.settings.prices[0].price.price).toBe(0);
            expect(g2!.settings.prices[0].price.reducedPrice).toBeNull();

            // check bundle discounts (each price should have 1 bundle discount for family members in same category)
            expect(g2!.settings.prices[0].bundleDiscounts.size).toBe(1);

            // The custom discounts should be 0 because there were no prices for the group. It should only be linked to the bundle discount because the discount for group 1 should be applied if a member inscribes for group 2.
            expect([...g2!.settings.prices[0].bundleDiscounts.values()]).toEqual(
                expect.arrayContaining([
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

            // check prices (the price should be 0 because there were no old prices configured)
            expect(g3!.settings.prices).toHaveLength(1);
            expect(g3!.settings.prices[0].price.price).toBe(0);
            expect(g3!.settings.prices[0].price.reducedPrice).toBeNull();

            // check bundle discounts (should have no bundle discount because the group is in another category)
            expect(g3!.settings.prices[0].bundleDiscounts.size).toBe(0);
        });
    });

    describe('Old group price with single price should not result in an empty custom discount but in a custom discount of 0', () => {
        // The main purpose of this test is to check that the custom discount is not an array without items because the calculation of the bundle discount would fail.

        let period: RegistrationPeriod;
        let organization: Organization;
        let organizationPeriod: OrganizationRegistrationPeriod;
        let group1: Group;

        afterEach(async () => {
            if (group1) {
                await group1.delete();
            }

            if (organizationPeriod) {
                await organizationPeriod.delete();
            }

            if (period) {
                period.organizationId = null;
                await period.save();
            }

            if (organization) {
                await organization.delete();
            }

            if (period) {
                await period.delete();
            }
        });

        // case where the discount is for family members in the same category
        test('family member discount for category', async () => {
        // arrange
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
                ],
            });

            // add both prices with discounts to group 1
            group1.settings.oldPrices = [oldPrices2, oldPrices1];

            await group1.save();

            // add group 1 and to 2 to same category, add group 3 to different category
            organizationPeriod.settings.categories = [
                GroupCategory.create({
                    settings: GroupCategorySettings.create({ name: 'category1' }),
                    groupIds: [group1.id],
                }),
            ];

            await organizationPeriod.save();

            // act
            await migratePrices();
            const g1 = await Group.getByID(group1.id);

            // check prices (should be equal to old prices)
            expect(g1!.settings.prices).toHaveLength(2);
            expect(g1!.settings.prices[0].price.price).toBe(30);
            expect(g1!.settings.prices[0].price.reducedPrice).toBe(20);
            expect(g1!.settings.prices[1].price.price).toBe(300);
            expect(g1!.settings.prices[1].price.reducedPrice).toBe(200);

            // check bundle discounts (each price should have 1 bundle discount for family members in same category)
            expect(g1!.settings.prices[0].bundleDiscounts.size).toBe(1);
            expect(g1!.settings.prices[1].bundleDiscounts.size).toBe(1);

            // custom discount for bundle discount of the first price should be null because the discounts are not different than the discounts for the bundle discount that is configured in the settings of the organization (which are the discounts for oldPrices1)
            expect([...g1!.settings.prices[0].bundleDiscounts.values()]).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({ customDiscounts: null }),
                ]),
            );

            // custom discount for bundle discount of second price should not be null because the discounts are different than the bundle discount that is configured in the settings of the organization (which are the discounts for oldPrices1), it should contain the discount for oldPrices2 which is 0 because there is only one price
            expect([...g1!.settings.prices[1].bundleDiscounts.values()]).toEqual(
                expect.arrayContaining([
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

        // case where the discount is for same members in the same category
        test('same member discount for category', async () => {
            // arrange
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

            // initial price with discount if same members in same category
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

            // price with discount after startDate 2025-03-01 if same members in same category
            const oldPrices2 = OldGroupPrices.create({
                startDate: new Date(2025, 2, 1),
                sameMemberOnlyDiscount: true,
                onlySameGroup: false,
                prices: [
                    OldGroupPrice.create({
                        price: 300,
                        reducedPrice: 200,
                    }),
                ],
            });

            // add both prices with discounts to group 1
            group1.settings.oldPrices = [oldPrices2, oldPrices1];

            await group1.save();

            // add group 1 and to 2 to same category, add group 3 to different category
            organizationPeriod.settings.categories = [
                GroupCategory.create({
                    settings: GroupCategorySettings.create({ name: 'category1' }),
                    groupIds: [group1.id],
                }),
            ];

            await organizationPeriod.save();

            // act
            await migratePrices();
            const g1 = await Group.getByID(group1.id);

            // check prices (should be equal to old prices)
            expect(g1!.settings.prices).toHaveLength(2);
            expect(g1!.settings.prices[0].price.price).toBe(30);
            expect(g1!.settings.prices[0].price.reducedPrice).toBe(20);
            expect(g1!.settings.prices[1].price.price).toBe(300);
            expect(g1!.settings.prices[1].price.reducedPrice).toBe(200);

            // check bundle discounts (each price should have 1 bundle discount for family members in same category)
            expect(g1!.settings.prices[0].bundleDiscounts.size).toBe(1);
            expect(g1!.settings.prices[1].bundleDiscounts.size).toBe(1);

            // custom discount for bundle discount of the first price should be null because the discounts are not different than the discounts for the bundle discount that is configured in the settings of the organization (which are the discounts for oldPrices1)
            expect([...g1!.settings.prices[0].bundleDiscounts.values()]).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({ customDiscounts: null }),
                ]),
            );

            // custom discount for bundle discount of second price should not be null because the discounts are different than the bundle discount that is configured in the settings of the organization (which are the discounts for oldPrices1), it should contain the discount for oldPrices2 which is 0 because there is only one price
            expect([...g1!.settings.prices[1].bundleDiscounts.values()]).toEqual(
                expect.arrayContaining([
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

        // case where the discount is for family members in the same group
        test('family member discount for group', async () => {
            // arrange
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

            // initial price with discount if same members in same category
            const oldPrices1 = OldGroupPrices.create({
                startDate: null,
                sameMemberOnlyDiscount: true,
                onlySameGroup: true,
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

            // price with discount after startDate 2025-03-01 if same members in same category
            const oldPrices2 = OldGroupPrices.create({
                startDate: new Date(2025, 2, 1),
                sameMemberOnlyDiscount: true,
                onlySameGroup: true,
                prices: [
                    OldGroupPrice.create({
                        price: 300,
                        reducedPrice: 200,
                    }),
                ],
            });

            // add both prices with discounts to group 1
            group1.settings.oldPrices = [oldPrices2, oldPrices1];

            await group1.save();

            // add group 1 and to 2 to same category, add group 3 to different category
            organizationPeriod.settings.categories = [
                GroupCategory.create({
                    settings: GroupCategorySettings.create({ name: 'category1' }),
                    groupIds: [group1.id],
                }),
            ];

            await organizationPeriod.save();

            // act
            await migratePrices();
            const g1 = await Group.getByID(group1.id);

            // check prices (should be equal to old prices)
            expect(g1!.settings.prices).toHaveLength(2);
            expect(g1!.settings.prices[0].price.price).toBe(30);
            expect(g1!.settings.prices[0].price.reducedPrice).toBe(20);
            expect(g1!.settings.prices[1].price.price).toBe(300);
            expect(g1!.settings.prices[1].price.reducedPrice).toBe(200);

            // check bundle discounts
            // first price should have 1 bundle discount for same members in same group
            expect(g1!.settings.prices[0].bundleDiscounts.size).toBe(1);
            // second price should not have bundle discount because the group price has only one price
            expect(g1!.settings.prices[1].bundleDiscounts.size).toBe(0);

            // custom discount for bundle discount of the first price should be null because the discounts are not different than the discounts for the bundle discount that is configured in the settings of the organization (which are the discounts for oldPrices1)
            expect([...g1!.settings.prices[0].bundleDiscounts.values()]).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({ customDiscounts: null }),
                ]),
            );
        });
    });

    describe('Groups with same discounts in old prices should have bundle discounts without custom discounts', () => {
        let period: RegistrationPeriod;
        let organization: Organization;
        let organizationPeriod: OrganizationRegistrationPeriod;
        let group1: Group;
        let group2: Group;

        afterEach(async () => {
            if (group1) {
                await group1.delete();
            }

            if (group2) {
                await group2.delete();
            }

            if (organizationPeriod) {
                await organizationPeriod.delete();
            }

            if (period) {
                period.organizationId = null;
                await period.save();
            }

            if (organization) {
                await organization.delete();
            }

            if (period) {
                await period.delete();
            }
        });

        // case where the discount is for family members in the same category
        test('family member discount for category', async () => {
        // arrange
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

            group1.settings.oldPrices = [oldPrices1];

            await group1.save();

            group2 = await new GroupFactory({ organization, period }).create();
            group2.settings.prices = [];
            group2.settings.name = new TranslatedString('group2');

            // initial price with discount if family members in same category (same discounts as oldPrices1)
            const oldPrices2 = OldGroupPrices.create({
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
            group2.settings.oldPrices = [oldPrices2];

            await group2.save();

            // add group 1 and to 2 to same category
            organizationPeriod.settings.categories = [
                GroupCategory.create({
                    settings: GroupCategorySettings.create({ name: 'category1' }),
                    groupIds: [group1.id, group2.id],
                }),
            ];

            await organizationPeriod.save();

            // act
            await migratePrices();
            const g1 = await Group.getByID(group1.id);

            // test group 1

            // check prices (should be equal to old prices)
            expect(g1!.settings.prices).toHaveLength(1);
            expect(g1!.settings.prices[0].price.price).toBe(30);
            expect(g1!.settings.prices[0].price.reducedPrice).toBe(20);

            // check bundle discounts (each price should have 1 bundle discount for family members in same category)
            expect(g1!.settings.prices[0].bundleDiscounts.size).toBe(1);

            // custom discount for bundle discount of the first price should be null because the discounts are not different than the discounts for the bundle discount that is configured in the settings of the organization (which are the discounts for oldPrices1)
            expect([...g1!.settings.prices[0].bundleDiscounts.values()]).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({ customDiscounts: null }),
                ]),
            );

            // test group 2
            const g2 = await Group.getByID(group2.id);

            // check prices (should be equal to old prices)
            expect(g2!.settings.prices).toHaveLength(1);
            expect(g2!.settings.prices[0].price.price).toBe(30);
            expect(g2!.settings.prices[0].price.reducedPrice).toBe(20);

            // check bundle discounts (each price should have 1 bundle discount for family members in same category)
            expect(g2!.settings.prices[0].bundleDiscounts.size).toBe(1);

            // custom discount for bundle discount of the second price should be null because the discounts are not different than the discounts for the bundle discount that is configured in the settings of the organization (which are the discounts for oldPrices1)
            expect([...g2!.settings.prices[0].bundleDiscounts.values()]).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({ customDiscounts: null }),
                ]),
            );
        });
    });

    describe('Groups with different discounts in old prices should have bundle discounts with custom discounts', () => {
        let period: RegistrationPeriod;
        let organization: Organization;
        let organizationPeriod: OrganizationRegistrationPeriod;
        let group1: Group;
        let group2: Group;

        afterEach(async () => {
            if (group1) {
                await group1.delete();
            }

            if (group2) {
                await group2.delete();
            }

            if (organizationPeriod) {
                await organizationPeriod.delete();
            }

            if (period) {
                period.organizationId = null;
                await period.save();
            }

            if (organization) {
                await organization.delete();
            }

            if (period) {
                await period.delete();
            }
        });

        test('group 2 has same discount count but other price', async () => {
        // arrange
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

            group1.settings.oldPrices = [oldPrices1];

            await group1.save();

            group2 = await new GroupFactory({ organization, period }).create();
            group2.settings.prices = [];
            group2.settings.name = new TranslatedString('group2');

            // initial price with discount if family members in same category (different discount as oldPrices1)
            const oldPrices2 = OldGroupPrices.create({
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
                        // the only difference with oldPrices1!!!
                        price: 21,
                        reducedPrice: 10,
                    }),
                ],
            });
            group2.settings.oldPrices = [oldPrices2];

            await group2.save();

            // add group 1 and to 2 to same category
            organizationPeriod.settings.categories = [
                GroupCategory.create({
                    settings: GroupCategorySettings.create({ name: 'category1' }),
                    groupIds: [group1.id, group2.id],
                }),
            ];

            await organizationPeriod.save();

            // act
            await migratePrices();
            const g1 = await Group.getByID(group1.id);

            // test group 1

            // check prices (should be equal to old prices)
            expect(g1!.settings.prices).toHaveLength(1);
            expect(g1!.settings.prices[0].price.price).toBe(30);
            expect(g1!.settings.prices[0].price.reducedPrice).toBe(20);

            // check bundle discounts (each price should have 1 bundle discount for family members in same category)
            expect(g1!.settings.prices[0].bundleDiscounts.size).toBe(1);

            // custom discount for bundle discount of the first price should be null because the discounts are not different than the discounts for the bundle discount that is configured in the settings of the organization (which are the discounts for oldPrices1)
            expect([...g1!.settings.prices[0].bundleDiscounts.values()]).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({ customDiscounts: null }),
                ]),
            );

            // test group 2
            const g2 = await Group.getByID(group2.id);

            // check prices (should be equal to old prices)
            expect(g2!.settings.prices).toHaveLength(1);
            expect(g2!.settings.prices[0].price.price).toBe(30);
            expect(g2!.settings.prices[0].price.reducedPrice).toBe(20);

            // check bundle discounts (each price should have 1 bundle discount for family members in same category)
            expect(g2!.settings.prices[0].bundleDiscounts.size).toBe(1);

            // custom discount for bundle discount of the second price should not be null because the discounts are different than the discounts for the bundle discount that is configured in the settings of the organization (which are the discounts for oldPrices1)
            expect([...g2!.settings.prices[0].bundleDiscounts.values()]).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({ customDiscounts: expect.arrayContaining([
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
                                price: 9,
                                reducedPrice: 10,
                            }),
                        }),
                    ]) }),
                ]),
            );
        });

        test('group 2 has extra discount', async () => {
        // arrange
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

            group1.settings.oldPrices = [oldPrices1];

            await group1.save();

            group2 = await new GroupFactory({ organization, period }).create();
            group2.settings.prices = [];
            group2.settings.name = new TranslatedString('group2');

            // initial price with discount if family members in same category (different discount as oldPrices1)
            const oldPrices2 = OldGroupPrices.create({
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
                    // extra discount
                    OldGroupPrice.create({
                        price: 19,
                        reducedPrice: 9,
                    }),
                ],
            });
            group2.settings.oldPrices = [oldPrices2];

            await group2.save();

            // add group 1 and to 2 to same category
            organizationPeriod.settings.categories = [
                GroupCategory.create({
                    settings: GroupCategorySettings.create({ name: 'category1' }),
                    groupIds: [group1.id, group2.id],
                }),
            ];

            await organizationPeriod.save();

            // act
            await migratePrices();
            const g1 = await Group.getByID(group1.id);

            // test group 1

            // check prices (should be equal to old prices)
            expect(g1!.settings.prices).toHaveLength(1);
            expect(g1!.settings.prices[0].price.price).toBe(30);
            expect(g1!.settings.prices[0].price.reducedPrice).toBe(20);

            // check bundle discounts (each price should have 1 bundle discount for family members in same category)
            expect(g1!.settings.prices[0].bundleDiscounts.size).toBe(1);

            // custom discount for bundle discount of the first price should be null because the discounts are not different than the discounts for the bundle discount that is configured in the settings of the organization (which are the discounts for oldPrices1)
            expect([...g1!.settings.prices[0].bundleDiscounts.values()]).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({ customDiscounts: null }),
                ]),
            );

            // test group 2
            const g2 = await Group.getByID(group2.id);

            // check prices (should be equal to old prices)
            expect(g2!.settings.prices).toHaveLength(1);
            expect(g2!.settings.prices[0].price.price).toBe(30);
            expect(g2!.settings.prices[0].price.reducedPrice).toBe(20);

            // check bundle discounts (each price should have 1 bundle discount for family members in same category)
            expect(g2!.settings.prices[0].bundleDiscounts.size).toBe(1);

            // custom discount for bundle discount of the second price should not be null because the discounts are different than the discounts for the bundle discount that is configured in the settings of the organization (which are the discounts for oldPrices1)
            expect([...g2!.settings.prices[0].bundleDiscounts.values()]).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({ customDiscounts: expect.arrayContaining([
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
                        expect.objectContaining({
                            type: GroupPriceDiscountType.Fixed,
                            value: expect.objectContaining({
                                price: 11,
                                reducedPrice: 11,
                            }),
                        }),
                    ]) }),
                ]),
            );
        });

        test('group 2 has one less discount', async () => {
        // arrange
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

            group1.settings.oldPrices = [oldPrices1];

            await group1.save();

            group2 = await new GroupFactory({ organization, period }).create();
            group2.settings.prices = [];
            group2.settings.name = new TranslatedString('group2');

            // initial price with discount if family members in same category (different discount as oldPrices1)
            const oldPrices2 = OldGroupPrices.create({
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
                    // one less discount
                ],
            });
            group2.settings.oldPrices = [oldPrices2];

            await group2.save();

            // add group 1 and to 2 to same category
            organizationPeriod.settings.categories = [
                GroupCategory.create({
                    settings: GroupCategorySettings.create({ name: 'category1' }),
                    groupIds: [group1.id, group2.id],
                }),
            ];

            await organizationPeriod.save();

            // act
            await migratePrices();
            const g1 = await Group.getByID(group1.id);

            // test group 1

            // check prices (should be equal to old prices)
            expect(g1!.settings.prices).toHaveLength(1);
            expect(g1!.settings.prices[0].price.price).toBe(30);
            expect(g1!.settings.prices[0].price.reducedPrice).toBe(20);

            // check bundle discounts (each price should have 1 bundle discount for family members in same category)
            expect(g1!.settings.prices[0].bundleDiscounts.size).toBe(1);

            // custom discount for bundle discount of the first price should be null because the discounts are not different than the discounts for the bundle discount that is configured in the settings of the organization (which are the discounts for oldPrices1)
            expect([...g1!.settings.prices[0].bundleDiscounts.values()]).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({ customDiscounts: null }),
                ]),
            );

            // test group 2
            const g2 = await Group.getByID(group2.id);

            // check prices (should be equal to old prices)
            expect(g2!.settings.prices).toHaveLength(1);
            expect(g2!.settings.prices[0].price.price).toBe(30);
            expect(g2!.settings.prices[0].price.reducedPrice).toBe(20);

            // check bundle discounts (each price should have 1 bundle discount for family members in same category)
            expect(g2!.settings.prices[0].bundleDiscounts.size).toBe(1);

            // custom discount for bundle discount of the second price should not be null because the discounts are different than the discounts for the bundle discount that is configured in the settings of the organization (which are the discounts for oldPrices1)
            expect([...g2!.settings.prices[0].bundleDiscounts.values()]).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({ customDiscounts: expect.arrayContaining([
                        expect.objectContaining({
                            type: GroupPriceDiscountType.Fixed,
                            value: expect.objectContaining({
                                price: 5,
                                reducedPrice: 5,
                            }),
                        }),
                    ]) }),
                ]),
            );
        });
    });

    test('Groups that are in no category should not have bundle discounts from other groups that also do not have a category', async () => {
        // arrange
        const startDate = new Date(2025, 0, 1);
        const endDate = new Date(2025, 11, 31);
        const period = await new RegistrationPeriodFactory({ startDate, endDate }).create();
        const organization = await new OrganizationFactory({ period }).create();
        period.organizationId = organization.id;
        await period.save();
        const organizationPeriod = await new OrganizationRegistrationPeriodFactory({ organization, period }).create();

        const group1 = await new GroupFactory({ organization, period }).create();
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

        group1.settings.oldPrices = [oldPrices1];

        await group1.save();

        const group2 = await new GroupFactory({ organization, period }).create();
        group2.settings.prices = [];
        group2.settings.name = new TranslatedString('group2');

        // initial price with discount if same members in same category
        const oldPrices2 = OldGroupPrices.create({
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
        group2.settings.oldPrices = [oldPrices2];

        await group2.save();

        // add group 1 and to 2 to same category
        organizationPeriod.settings.categories = [
            GroupCategory.create({
                settings: GroupCategorySettings.create({ name: 'category1' }),
                // the groups are not in a category
                groupIds: [],
            }),
        ];

        await organizationPeriod.save();

        // act
        await migratePrices();
        const g1 = await Group.getByID(group1.id);

        // test group 1

        // check prices (should be equal to old prices)
        expect(g1!.settings.prices).toHaveLength(1);
        expect(g1!.settings.prices[0].price.price).toBe(30);
        expect(g1!.settings.prices[0].price.reducedPrice).toBe(20);

        // check bundle discounts (each price should have 1 bundle discount for family members in same category)
        expect(g1!.settings.prices[0].bundleDiscounts.size).toBe(1);

        // custom discount for bundle discount of the first price should be null because the discounts are not different than the discounts for the bundle discount that is configured in the settings of the organization (which are the discounts for oldPrices1)
        expect([...g1!.settings.prices[0].bundleDiscounts.values()]).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ customDiscounts: null }),
            ]),
        );

        // test group 2
        const g2 = await Group.getByID(group2.id);

        // check prices (should be equal to old prices)
        expect(g2!.settings.prices).toHaveLength(1);
        expect(g2!.settings.prices[0].price.price).toBe(30);
        expect(g2!.settings.prices[0].price.reducedPrice).toBe(20);

        // check bundle discounts (each price should have 1 bundle discount for family members in same category)
        expect(g2!.settings.prices[0].bundleDiscounts.size).toBe(1);

        // custom discount for bundle discount of the second price should be null because the group is not in a category and thus should not be linked to the bundle discount of the other group
        expect([...g2!.settings.prices[0].bundleDiscounts.values()]).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ customDiscounts: null }),
            ]),
        );

        // cleanup
        await group1.delete();
        await group2.delete();
        await organizationPeriod.delete();
        period.organizationId = null;
        await period.save();
        await organization.delete();
        await period.delete();
    });

    test('Groups that are archived should not have bundle discounts from other groups that also do not have a category', async () => {
        // arrange
        const startDate = new Date(2025, 0, 1);
        const endDate = new Date(2025, 11, 31);
        const period = await new RegistrationPeriodFactory({ startDate, endDate }).create();
        const organization = await new OrganizationFactory({ period }).create();
        period.organizationId = organization.id;
        await period.save();
        const organizationPeriod = await new OrganizationRegistrationPeriodFactory({ organization, period }).create();

        const group1 = await new GroupFactory({ organization, period }).create();
        // archived group
        group1.status = GroupStatus.Archived;
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

        group1.settings.oldPrices = [oldPrices1];

        await group1.save();

        const group2 = await new GroupFactory({ organization, period }).create();
        // archived group
        group2.status = GroupStatus.Archived;
        group2.settings.prices = [];
        group2.settings.name = new TranslatedString('group2');

        // initial price with discount if same members in same category
        const oldPrices2 = OldGroupPrices.create({
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
        group2.settings.oldPrices = [oldPrices2];

        await group2.save();

        // add group 1 and to 2 to same category
        organizationPeriod.settings.categories = [
            GroupCategory.create({
                settings: GroupCategorySettings.create({ name: 'category1' }),
                groupIds: [group1.id, group2.id],
            }),
        ];

        await organizationPeriod.save();

        // act
        await migratePrices();
        const g1 = await Group.getByID(group1.id);

        // test group 1

        // check prices (should be equal to old prices)
        expect(g1!.settings.prices).toHaveLength(1);
        expect(g1!.settings.prices[0].price.price).toBe(30);
        expect(g1!.settings.prices[0].price.reducedPrice).toBe(20);

        // check bundle discounts (each price should have 1 bundle discount for family members in same category)
        expect(g1!.settings.prices[0].bundleDiscounts.size).toBe(1);

        // custom discount for bundle discount of the first price should be null because the discounts are not different than the discounts for the bundle discount that is configured in the settings of the organization (which are the discounts for oldPrices1)
        expect([...g1!.settings.prices[0].bundleDiscounts.values()]).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ customDiscounts: null }),
            ]),
        );

        // test group 2
        const g2 = await Group.getByID(group2.id);

        // check prices (should be equal to old prices)
        expect(g2!.settings.prices).toHaveLength(1);
        expect(g2!.settings.prices[0].price.price).toBe(30);
        expect(g2!.settings.prices[0].price.reducedPrice).toBe(20);

        // check bundle discounts (each price should have 1 bundle discount for family members in same category)
        expect(g2!.settings.prices[0].bundleDiscounts.size).toBe(1);

        // custom discount for bundle discount of the second price should be null because the group is archived and thus should not be linked to the bundle discount of the other group, even if they are in the same category still
        expect([...g2!.settings.prices[0].bundleDiscounts.values()]).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ customDiscounts: null }),
            ]),
        );

        // cleanup
        await group1.delete();
        await group2.delete();
        await organizationPeriod.delete();
        period.organizationId = null;
        await period.save();
        await organization.delete();
        await period.delete();
    });

    describe('Bundle discount should be reused if multiple groups have the same discount and onlySameGroup is true', () => {
        let period: RegistrationPeriod;
        let organization: Organization;
        let organizationPeriod: OrganizationRegistrationPeriod;
        let group1: Group;
        let group2: Group;

        afterEach(async () => {
            if (group1) {
                await group1.delete();
            }

            if (group2) {
                await group2.delete();
            }

            if (organizationPeriod) {
                await organizationPeriod.delete();
            }

            if (period) {
                period.organizationId = null;
                await period.save();
            }

            if (organization) {
                await organization.delete();
            }

            if (period) {
                await period.delete();
            }
        });

        test('customDiscounts should be null if same discounts', async () => {
            // arrange
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
                onlySameGroup: true,
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

            group1.settings.oldPrices = [oldPrices1];

            await group1.save();

            group2 = await new GroupFactory({ organization, period }).create();
            group2.settings.prices = [];
            group2.settings.name = new TranslatedString('group2');

            // initial price with discount if family members in same category (same discount as oldPrices1)
            const oldPrices2 = OldGroupPrices.create({
                startDate: null,
                sameMemberOnlyDiscount: false,
                onlySameGroup: true,
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
            group2.settings.oldPrices = [oldPrices2];

            await group2.save();

            // add group 1 and to 2 to different category (should not make a difference)
            organizationPeriod.settings.categories = [
                GroupCategory.create({
                    settings: GroupCategorySettings.create({ name: 'category1' }),
                    groupIds: [group1.id],
                }),
                GroupCategory.create({
                    settings: GroupCategorySettings.create({ name: 'category2' }),
                    groupIds: [group2.id],
                }),
            ];

            await organizationPeriod.save();

            // act
            await migratePrices();
            const g1 = await Group.getByID(group1.id);

            // test group 1

            // check prices (should be equal to old prices)
            expect(g1!.settings.prices).toHaveLength(1);
            expect(g1!.settings.prices[0].price.price).toBe(30);
            expect(g1!.settings.prices[0].price.reducedPrice).toBe(20);

            // check bundle discounts (each price should have 1 bundle discount for family members in same category)
            expect(g1!.settings.prices[0].bundleDiscounts.size).toBe(1);

            // custom discount for bundle discount of the first price should be null because the discounts are not different than the discounts for the bundle discount that is configured in the settings of the organization (which are the discounts for oldPrices1)
            expect([...g1!.settings.prices[0].bundleDiscounts.values()]).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({ customDiscounts: null }),
                ]),
            );

            // test group 2
            const g2 = await Group.getByID(group2.id);

            // check prices (should be equal to old prices)
            expect(g2!.settings.prices).toHaveLength(1);
            expect(g2!.settings.prices[0].price.price).toBe(30);
            expect(g2!.settings.prices[0].price.reducedPrice).toBe(20);

            // check bundle discounts (each price should have 1 bundle discount for family members in same category)
            expect(g2!.settings.prices[0].bundleDiscounts.size).toBe(1);

            // custom discount for bundle discount of the second price should be null because the discounts are equal to the discounts for the bundle discount that is configured in the settings of the organization (which are the discounts for oldPrices1)
            expect([...g2!.settings.prices[0].bundleDiscounts.values()]).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({ customDiscounts: null }),
                ]),
            );
        });

        test('should set customDiscounts if different discounts', async () => {
            // arrange
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
                onlySameGroup: true,
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

            group1.settings.oldPrices = [oldPrices1];

            await group1.save();

            group2 = await new GroupFactory({ organization, period }).create();
            group2.settings.prices = [];
            group2.settings.name = new TranslatedString('group2');

            // initial price with discount if family members in same category (different discount as oldPrices1)
            const oldPrices2 = OldGroupPrices.create({
                startDate: null,
                sameMemberOnlyDiscount: false,
                onlySameGroup: true,
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
                        // only difference
                        price: 21,
                        reducedPrice: 10,
                    }),
                ],
            });
            group2.settings.oldPrices = [oldPrices2];

            await group2.save();

            // add group 1 and to 2 to different category (should not make a difference)
            organizationPeriod.settings.categories = [
                GroupCategory.create({
                    settings: GroupCategorySettings.create({ name: 'category1' }),
                    groupIds: [group1.id],
                }),
                GroupCategory.create({
                    settings: GroupCategorySettings.create({ name: 'category2' }),
                    groupIds: [group2.id],
                }),
            ];

            await organizationPeriod.save();

            // act
            await migratePrices();
            const g1 = await Group.getByID(group1.id);

            // test group 1

            // check prices (should be equal to old prices)
            expect(g1!.settings.prices).toHaveLength(1);
            expect(g1!.settings.prices[0].price.price).toBe(30);
            expect(g1!.settings.prices[0].price.reducedPrice).toBe(20);

            // check bundle discounts (each price should have 1 bundle discount for family members in same category)
            expect(g1!.settings.prices[0].bundleDiscounts.size).toBe(1);

            // custom discount for bundle discount of the first price should be null because the discounts are not different than the discounts for the bundle discount that is configured in the settings of the organization (which are the discounts for oldPrices1)
            expect([...g1!.settings.prices[0].bundleDiscounts.values()]).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({ customDiscounts: null }),
                ]),
            );

            // test group 2
            const g2 = await Group.getByID(group2.id);

            // check prices (should be equal to old prices)
            expect(g2!.settings.prices).toHaveLength(1);
            expect(g2!.settings.prices[0].price.price).toBe(30);
            expect(g2!.settings.prices[0].price.reducedPrice).toBe(20);

            // check bundle discounts (each price should have 1 bundle discount for family members in same category)
            expect(g2!.settings.prices[0].bundleDiscounts.size).toBe(1);

            // custom discount for bundle discount of the second price should not be null because the discounts are different than the discounts for the bundle discount that is configured in the settings of the organization (which are the discounts for oldPrices1)
            expect([...g2!.settings.prices[0].bundleDiscounts.values()]).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({ customDiscounts: expect.arrayContaining([
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
                                price: 9,
                                reducedPrice: 10,
                            }),
                        }),
                    ]) }),
                ]),
            );
        });

        test('customDiscounts should not be reused if sameMemberOnlyDiscount is different', async () => {
            // arrange
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
                onlySameGroup: true,
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

            group1.settings.oldPrices = [oldPrices1];

            await group1.save();

            group2 = await new GroupFactory({ organization, period }).create();
            group2.settings.prices = [];
            group2.settings.name = new TranslatedString('group2');

            // initial price with discount if family members in same category (same discount as oldPrices1)
            const oldPrices2 = OldGroupPrices.create({
                startDate: null,
                sameMemberOnlyDiscount: true,
                onlySameGroup: true,
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
            group2.settings.oldPrices = [oldPrices2];

            await group2.save();

            // add group 1 and to 2 to different category (should not make a difference)
            organizationPeriod.settings.categories = [
                GroupCategory.create({
                    settings: GroupCategorySettings.create({ name: 'category1' }),
                    groupIds: [group1.id],
                }),
                GroupCategory.create({
                    settings: GroupCategorySettings.create({ name: 'category2' }),
                    groupIds: [group2.id],
                }),
            ];

            await organizationPeriod.save();

            // act
            await migratePrices();
            const g1 = await Group.getByID(group1.id);

            // test group 1

            // check prices (should be equal to old prices)
            expect(g1!.settings.prices).toHaveLength(1);
            expect(g1!.settings.prices[0].price.price).toBe(30);
            expect(g1!.settings.prices[0].price.reducedPrice).toBe(20);

            // check bundle discounts (each price should have 1 bundle discount for family members in same category)
            expect(g1!.settings.prices[0].bundleDiscounts.size).toBe(1);

            // custom discount for bundle discount of the first price should be null because the discounts are not different than the discounts for the bundle discount that is configured in the settings of the organization (which are the discounts for oldPrices1)
            expect([...g1!.settings.prices[0].bundleDiscounts.values()]).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({ customDiscounts: null }),
                ]),
            );

            // test group 2
            const g2 = await Group.getByID(group2.id);

            // check prices (should be equal to old prices)
            expect(g2!.settings.prices).toHaveLength(1);
            expect(g2!.settings.prices[0].price.price).toBe(30);
            expect(g2!.settings.prices[0].price.reducedPrice).toBe(20);

            // check bundle discounts (each price should have 1 bundle discount for family members in same category)
            expect(g2!.settings.prices[0].bundleDiscounts.size).toBe(1);

            // custom discount for bundle discount of the second price should be null because the discounts are equal to the discounts for the bundle discount that is configured in the settings of the organization (which are the discounts for oldPrices1)
            expect([...g2!.settings.prices[0].bundleDiscounts.values()]).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({ customDiscounts: null }),
                ]),
            );

            // check organization registration period
            const orgPeriod = await OrganizationRegistrationPeriod.getByID(organizationPeriod.id);

            // the organization period should have 2 bundle discounts: 1 for family members in category 1 and 1 for same members in category 1
            expect(orgPeriod!.settings.bundleDiscounts).toHaveLength(2);

            expect(orgPeriod!.settings.bundleDiscounts).toEqual(
                expect.arrayContaining([
                    // bundle discount of oldPrices1 of group1
                    expect.objectContaining({
                        countWholeFamily: true,
                        countPerGroup: true,
                        // should contain the differences for oldPrices1
                        discounts: expect.arrayContaining([
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
                    // bundle discount of oldPrices2 of group 2
                    expect.objectContaining({
                        countWholeFamily: false,
                        countPerGroup: true,
                        // should contain the differences for oldPrices1
                        discounts: expect.arrayContaining([
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
    });
});
