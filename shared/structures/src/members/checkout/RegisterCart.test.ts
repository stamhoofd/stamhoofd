import { BundleDiscountGroupPriceSettings } from '../../BundleDiscountGroupPriceSettings.js';
import { Group } from '../../Group.js';
import { GroupPriceDiscount, GroupPriceDiscountType } from '../../GroupPriceDiscount.js';
import { GroupPrice, GroupSettings } from '../../GroupSettings.js';
import { Organization } from '../../Organization.js';
import { Platform } from '../../Platform.js';
import { ReduceablePrice } from '../../ReduceablePrice.js';
import { OrganizationRegistrationPeriod, RegistrationPeriod } from '../../RegistrationPeriod.js';
import { TranslatedString } from '../../TranslatedString.js';
import { BooleanStatus, MemberDetails } from '../MemberDetails.js';
import { PlatformFamily } from '../PlatformMember.js';
import { RegisterItem } from './RegisterItem.js';
import { MembersBlob, MemberWithRegistrationsBlob } from '../MemberWithRegistrationsBlob.js';

// Should be last because of circular dependencies
import { BundleDiscount } from '../../BundleDiscount.js';
import { Registration } from '../Registration.js';
import { AppliedRegistrationDiscount } from '../../AppliedRegistrationDiscount.js';
import { RegistrationWithPlatformMember } from './RegistrationWithPlatformMember.js';

// Helper functions to reduce code duplication
function createTestPeriod() {
    const period = RegistrationPeriod.create({});
    const organizationRegistrationPeriod = OrganizationRegistrationPeriod.create({
        period,
    });
    const organization = Organization.create({
        period: organizationRegistrationPeriod,
    });
    return { period, organizationRegistrationPeriod, organization };
}

function createTestGroups(organization: Organization, period: RegistrationPeriod, prices: number[] = [50_00, 40_00], names?: string[]) {
    return prices.map((price, index) => {
        return Group.create({
            organizationId: organization.id,
            periodId: period.id,
            settings: GroupSettings.create({
                name: names ? new TranslatedString(names[index]) : undefined,
                prices: [
                    GroupPrice.create({
                        price: ReduceablePrice.create({
                            price,
                        }),
                    }),
                ],
            }),
        });
    });
}

function createBundleDiscount({
    name = 'Bundle discount',
    countWholeFamily = true,
    countPerGroup = false,
    discounts = [
        { value: 10_00, type: GroupPriceDiscountType.Fixed },
        { value: 15_00, type: GroupPriceDiscountType.Fixed },
    ],
}: {
    name?: string;
    countWholeFamily?: boolean;
    countPerGroup?: boolean;
    discounts?: Array<{ value: number; type: GroupPriceDiscountType; reducedValue?: number }>;
} = {}) {
    return BundleDiscount.create({
        name: new TranslatedString(name),
        countWholeFamily,
        countPerGroup,
        discounts: discounts.map(d => GroupPriceDiscount.create({
            value: ReduceablePrice.create({
                price: d.value,
                reducedPrice: d.reducedValue ?? null,
            }),
            type: d.type,
        })),
    });
}

function createTestFamily(memberCount = 3) {
    const members = Array(memberCount).fill(null).map((_, i) => {
        const names = ['John', 'Jane', 'Jack'];
        return MemberWithRegistrationsBlob.create({
            details: MemberDetails.create({
                firstName: names[i] || `Member${i + 1}`,
                lastName: 'Doe',
            }),
        });
    });

    const blob = MembersBlob.create({
        members,
    });

    return PlatformFamily.create(blob, { platform: Platform.create({}) });
}

function setupDiscountTest({
    memberCount = 3,
    groupPrices = [50_00, 40_00],
    groupNames,
    bundleDiscount,
}: {
    memberCount?: number;
    groupPrices?: number[];
    groupNames?: string[];
    bundleDiscount?: BundleDiscount;
} = {}) {
    const { period, organizationRegistrationPeriod, organization } = createTestPeriod();
    const groups = createTestGroups(organization, period, groupPrices, groupNames);
    organizationRegistrationPeriod.groups = groups;

    const discount = bundleDiscount || createBundleDiscount();
    organizationRegistrationPeriod.settings.bundleDiscounts.push(discount);

    // Setup bundle discounts on all groups
    groups.forEach((group) => {
        group.settings.prices[0].bundleDiscounts.set(discount.id, BundleDiscountGroupPriceSettings.create({
            name: discount.name,
        }));
    });

    const family = createTestFamily(memberCount);

    return {
        period,
        organizationRegistrationPeriod,
        organization,
        groups,
        discount,
        family,
    };
}

function addHistoricRegistration(member: ReturnType<typeof createTestFamily>['members'][0], group: Group, organization: Organization) {
    const registration = Registration.create({
        group: group,
        groupPrice: group.settings.prices[0],
        memberId: member.id,
        organizationId: group.organizationId,
        registeredAt: new Date('2023-01-01'),
        startDate: new Date('2023-01-01'),
        price: group.settings.prices[0].price.price,
    });
    member.member.registrations.push(registration);
    member.family.insertOrganization(organization);
    return registration;
}

describe('Unit.RegisterCart', () => {
    describe('Bundle Discounts', () => {
        it('A fixed discount is granted for the second and third registration in a bundle', () => {
            const { organization, groups, family } = setupDiscountTest({
                bundleDiscount: createBundleDiscount({
                    name: 'Bundle discount',
                    discounts: [
                        { value: 10_00, type: GroupPriceDiscountType.Fixed },
                        { value: 15_00, type: GroupPriceDiscountType.Fixed },
                    ],
                }),
            });
            const [groupA, groupB] = groups;
            const [memberA, memberB, memberC] = family.members;

            const itemA = RegisterItem.defaultFor(memberA, groupA, organization);
            const itemB = RegisterItem.defaultFor(memberB, groupB, organization);
            const itemC = RegisterItem.defaultFor(memberC, groupB, organization);

            // Add to a single cart
            const checkout = family.checkout;
            const cart = checkout.cart;
            cart.add(itemA);
            cart.add(itemB);
            cart.add(itemC);

            cart.calculatePrices();

            // Check price for item A is 50.00
            expect(itemA.calculatedPrice).toEqual(50_00);
            expect(itemA.calculatedRefund).toEqual(0);
            expect(itemA.calculatedPriceDueLater).toEqual(0);

            // Check price for items B and C
            expect(itemB.calculatedPrice).toEqual(40_00);
            expect(itemB.calculatedRefund).toEqual(0);
            expect(itemB.calculatedPriceDueLater).toEqual(0);

            expect(itemC.calculatedPrice).toEqual(40_00);
            expect(itemC.calculatedRefund).toEqual(0);
            expect(itemC.calculatedPriceDueLater).toEqual(0);

            // Check calculated discount is 10_00 + 15_00 = 25_00
            expect(cart.bundleDiscounts).toHaveLength(1);
            expect(cart.bundleDiscounts[0].total).toEqual(25_00);
            expect(cart.bundleDiscounts[0].totalAlreadyApplied).toEqual(0);
            expect(cart.bundleDiscounts[0].netTotal).toEqual(25_00);

            expect(cart.price).toEqual(50_00 + 40_00 + 40_00);
            expect(checkout.totalPrice).toEqual(50_00 + 40_00 + 40_00 - 25_00);

            expect(checkout.priceBreakown).toEqual([
                expect.objectContaining({
                    price: 130_00,
                }),
                {
                    name: 'Bundle discount',
                    price: -25_00,
                },
                expect.objectContaining({
                    price: 130_00 - 25_00,
                }),
            ]);
        });

        test('A percentage discount is granted for the second and third registration in a bundle', () => {
            const { organization, groups, family } = setupDiscountTest({
                bundleDiscount: createBundleDiscount({
                    name: 'Bundle discount',
                    discounts: [
                        { value: 10_00, type: GroupPriceDiscountType.Percentage },
                        { value: 15_00, type: GroupPriceDiscountType.Percentage },
                    ],
                }),
            });
            const [groupA, groupB] = groups;
            const [memberA, memberB, memberC] = family.members;

            const itemA = RegisterItem.defaultFor(memberA, groupA, organization);
            const itemB = RegisterItem.defaultFor(memberB, groupB, organization);
            const itemC = RegisterItem.defaultFor(memberC, groupB, organization);

            // Add to a single cart
            const checkout = family.checkout;
            const cart = checkout.cart;
            cart.add(itemA);
            cart.add(itemB);
            cart.add(itemC);

            cart.calculatePrices();

            // Check price for items
            expect(itemA.calculatedPrice).toEqual(50_00);
            expect(itemB.calculatedPrice).toEqual(40_00);
            expect(itemC.calculatedPrice).toEqual(40_00);

            // 15% will be applied to 50 euro (max), and 10% to one of the 40 euros
            // Check calculated discount is 50_00 * 0.15 + 40_00 * 0.10 = 7_50 + 4_00 = 11_50
            expect(cart.bundleDiscounts).toHaveLength(1);
            expect(cart.bundleDiscounts[0].total).toEqual(11_50);
            expect(cart.bundleDiscounts[0].netTotal).toEqual(11_50);

            expect(cart.price).toEqual(50_00 + 40_00 + 40_00);
            expect(checkout.totalPrice).toEqual(50_00 + 40_00 + 40_00 - 11_50);

            expect(checkout.priceBreakown).toEqual([
                expect.objectContaining({
                    price: 130_00,
                }),
                {
                    name: 'Bundle discount',
                    price: -11_50,
                },
                expect.objectContaining({
                    price: 130_00 - 11_50,
                }),
            ]);
        });

        test('Historic registrations are included in the calculation', () => {
            const { organization, groups, family } = setupDiscountTest({
                bundleDiscount: createBundleDiscount({
                    name: 'Bundle discount',
                    discounts: [
                        { value: 10_00, type: GroupPriceDiscountType.Percentage },
                        { value: 15_00, type: GroupPriceDiscountType.Percentage },
                    ],
                }),
            });
            const [groupA, groupB] = groups;
            const [memberA, memberB, memberC] = family.members;

            // Member A is already registered for group A in the past
            addHistoricRegistration(memberA, groupA, organization);

            const itemB = RegisterItem.defaultFor(memberB, groupB, organization);
            const itemC = RegisterItem.defaultFor(memberC, groupB, organization);

            // Add to a single cart
            const checkout = family.checkout;
            const cart = checkout.cart;
            cart.add(itemB);
            cart.add(itemC);

            cart.calculatePrices();

            // Check price for items
            expect(itemB.calculatedPrice).toEqual(40_00);
            expect(itemC.calculatedPrice).toEqual(40_00);

            // 15% will be applied to 50 euro (max), and 10% to one of the 40 euros
            // Check calculated discount is 50_00 * 0.15 + 40_00 * 0.10 = 7_50 + 4_00 = 11_50
            expect(cart.bundleDiscounts).toHaveLength(1);
            expect(cart.bundleDiscounts[0].total).toEqual(11_50);
            expect(cart.bundleDiscounts[0].netTotal).toEqual(11_50);

            expect(cart.price).toEqual(40_00 + 40_00);
            expect(checkout.totalPrice).toEqual(40_00 + 40_00 - 11_50);

            expect(checkout.priceBreakown).toEqual([
                expect.objectContaining({
                    price: 80_00,
                }),
                {
                    name: 'Bundle discount',
                    price: -11_50,
                },
                expect.objectContaining({
                    price: 80_00 - 11_50,
                }),
            ]);
        });

        test('Deleting a registration also removes the attached discount', () => {
            // We have two family members with existing registrations.
            // One of those registrations received a discount earlier.
            // But since we are adding a new registration in our cart, a more optimal discount
            // would be if that registration would get the newly higher discount instead
            // (because it is percentage based)

            const { organization, groups, family, discount } = setupDiscountTest({
                memberCount: 2,
                bundleDiscount: createBundleDiscount({
                    name: 'Multiple family members discount',
                    countWholeFamily: true,
                    countPerGroup: false,
                    discounts: [
                        { value: 10_00, type: GroupPriceDiscountType.Percentage },
                        { value: 15_00, type: GroupPriceDiscountType.Percentage },
                    ],
                }),
                groupPrices: [100_00, 40_00],
            });

            const [groupA, groupB] = groups;
            const [memberA, memberB] = family.members;

            const registrationA = addHistoricRegistration(memberA, groupA, organization);
            const registrationB = addHistoricRegistration(memberB, groupB, organization);

            registrationA.discounts.set(discount.id, AppliedRegistrationDiscount.create({
                name: discount.name,
                amount: 10_00, // 10% discount on 100_00 = 10_00
            }));

            // If we delete registration B, the discount should be taken into account
            const checkout = family.checkout;
            const cart = checkout.cart;
            cart.removeRegistration(
                new RegistrationWithPlatformMember({
                    registration: registrationB,
                    member: memberB,
                }),
            );

            cart.calculatePrices();

            expect(cart.bundleDiscounts).toHaveLength(1);
            expect(cart.bundleDiscounts[0].total).toEqual(0);
            expect(cart.bundleDiscounts[0].totalAlreadyApplied).toEqual(10_00); // The previous discount
            expect(cart.bundleDiscounts[0].netTotal).toEqual(-10_00);

            expect(checkout.totalPrice).toEqual(-30_00);
            expect(checkout.priceBreakown).toEqual([
                expect.objectContaining({
                    price: 0, // Cart total
                }),
                expect.objectContaining({
                    price: -40_00, // Cart refund
                }),
                {
                    name: 'Multiple family members discount',
                    price: 10_00,
                },
                expect.objectContaining({
                    price: -40_00 + 10_00,
                }),
            ]);

            // Now readd the registration
            cart.unremoveRegistration(
                new RegistrationWithPlatformMember({
                    registration: registrationB,
                    member: memberB,
                }));

            // Remove registration A, this should give the same result

            cart.removeRegistration(
                new RegistrationWithPlatformMember({
                    registration: registrationA,
                    member: memberA,
                }),
            );
            cart.calculatePrices();

            expect(cart.bundleDiscounts).toHaveLength(1);
            expect(cart.bundleDiscounts[0].total).toEqual(0);
            expect(cart.bundleDiscounts[0].totalAlreadyApplied).toEqual(10_00); // The previous discount
            expect(cart.bundleDiscounts[0].netTotal).toEqual(-10_00);
            expect(checkout.totalPrice).toEqual(-90_00);
            expect(checkout.priceBreakown).toEqual([
                expect.objectContaining({
                    price: 0, // Cart total
                }),
                expect.objectContaining({
                    price: -100_00, // Cart refund
                }),
                {
                    name: 'Multiple family members discount',
                    price: 10_00,
                },
                expect.objectContaining({
                    price: -90_00,
                }),
            ]);
        });

        test('Replacing a registration also removes the attached discount', () => {
            // Create a family with two members, each with a registration
            // Add a discount to one of the registrations (like it should have been calculated at the time)
            // Next, move one of the registrations to a different group that does not have the discount
            // The previously given discount should be added as an extra price on the cart as an adjustment for the discount that should have been given

            const { organization, groups, family, discount } = setupDiscountTest({
                memberCount: 2,
                bundleDiscount: createBundleDiscount({
                    name: 'Multiple family members discount',
                    countWholeFamily: true,
                    countPerGroup: false,
                    discounts: [
                        { value: 10_00, type: GroupPriceDiscountType.Percentage },
                        { value: 15_00, type: GroupPriceDiscountType.Percentage },
                    ],
                }),
                groupPrices: [100_00, 40_00],
            });
            const [groupA, groupB] = groups;
            const [memberA, memberB] = family.members;
            const registrationA = addHistoricRegistration(memberA, groupA, organization);
            addHistoricRegistration(memberB, groupB, organization);
            registrationA.discounts.set(discount.id, AppliedRegistrationDiscount.create({
                name: discount.name,
                amount: 10_00, // 10% discount on 100_00 = 10_00
            }));

            const groupCPrice = GroupPrice.create({
                price: ReduceablePrice.create({
                    price: 50_00,
                }),
            });
            const groupC = Group.create({
                organizationId: organization.id,
                periodId: organization.period.id,
                settings: GroupSettings.create({
                    name: new TranslatedString('Group C'),
                    prices: [
                        groupCPrice,
                    ],
                }),
            });

            const checkout = family.checkout;
            const cart = checkout.cart;

            const itemA = RegisterItem.defaultFor(memberA, groupC, organization);
            itemA.replaceRegistrations = [
                new RegistrationWithPlatformMember({
                    registration: registrationA,
                    member: memberA,
                }),
            ];
            cart.add(itemA);
            cart.calculatePrices();

            // Check price for items
            expect(itemA.calculatedPrice).toEqual(50_00);
            expect(itemA.calculatedRefund).toEqual(100_00);
            expect(itemA.calculatedPriceDueLater).toEqual(0);

            // Check discount should be given back
            expect(cart.bundleDiscounts).toHaveLength(1);
            expect(cart.bundleDiscounts[0].total).toEqual(0);
            expect(cart.bundleDiscounts[0].totalAlreadyApplied).toEqual(10_00); // The previous discount
            expect(cart.bundleDiscounts[0].netTotal).toEqual(-10_00);

            expect(checkout.totalPrice).toEqual(50_00 - 100_00 + 10_00);
            expect(checkout.priceBreakown).toEqual([
                expect.objectContaining({
                    // Subtotal (normal price)
                    price: 50_00,
                }),
                expect.objectContaining({
                    // Refund for the previous registration
                    price: -100_00,
                }),
                {
                    name: 'Multiple family members discount',
                    price: 10_00,
                },
                expect.objectContaining({
                    price: -50_00 + 10_00,
                }),
            ]);

            // Now, what if groupC does have a higher discount instead of no discount?
            groupCPrice.bundleDiscounts.set(discount.id, BundleDiscountGroupPriceSettings.create({
                name: discount.name,
                customDiscounts: [
                    // Custom discount for this price
                    GroupPriceDiscount.create({
                        value: ReduceablePrice.create({
                            price: 25_00,
                        }),
                        type: GroupPriceDiscountType.Fixed,
                    }),
                ],
            }));

            // Recalculate
            cart.calculatePrices();

            // Check discount should be given back
            expect(cart.bundleDiscounts).toHaveLength(1);
            expect(cart.bundleDiscounts[0].total).toEqual(25_00);
            expect(cart.bundleDiscounts[0].totalAlreadyApplied).toEqual(10_00); // The previous discount
            expect(cart.bundleDiscounts[0].netTotal).toEqual(15_00);

            expect(checkout.totalPrice).toEqual(50_00 - 100_00 - 15_00);
            expect(checkout.priceBreakown).toEqual([
                expect.objectContaining({
                    // Subtotal (normal price)
                    price: 50_00,
                }),
                expect.objectContaining({
                    // Refund for the previous registration
                    price: -100_00,
                }),
                {
                    name: 'Multiple family members discount',
                    price: -15_00,
                },
                expect.objectContaining({
                    price: -50_00 - 15_00,
                }),
            ]);
        });

        test('The last discount is repeated', () => {
            // Create a family with 3 members. Add 3 items to the cart.
            // The bundle discount only defined one discount, but that should be repated for the second and third item

            const { organization, groups, family, discount } = setupDiscountTest({
                memberCount: 3,
                groupPrices: [50_00, 40_00],
                groupNames: ['Group A', 'Group B'],
                bundleDiscount: createBundleDiscount({
                    name: 'Bundle discount',
                    discounts: [
                        { value: 10_00, type: GroupPriceDiscountType.Percentage },
                    ],
                }),
            });
            const [groupA, groupB] = groups;
            const [memberA, memberB, memberC] = family.members;
            const itemA = RegisterItem.defaultFor(memberA, groupA, organization);
            const itemB = RegisterItem.defaultFor(memberB, groupB, organization);
            const itemC = RegisterItem.defaultFor(memberC, groupB, organization);

            // Add to a single cart
            const checkout = family.checkout;
            const cart = checkout.cart;
            cart.add(itemA);
            cart.add(itemB);
            cart.add(itemC);
            cart.calculatePrices();
            // Check price for items
            expect(itemA.calculatedPrice).toEqual(50_00);
            expect(itemA.calculatedRefund).toEqual(0);
            expect(itemA.calculatedPriceDueLater).toEqual(0);

            expect(itemB.calculatedPrice).toEqual(40_00);
            expect(itemB.calculatedRefund).toEqual(0);
            expect(itemB.calculatedPriceDueLater).toEqual(0);
            expect(itemC.calculatedPrice).toEqual(40_00);
            expect(itemC.calculatedRefund).toEqual(0);
            expect(itemC.calculatedPriceDueLater).toEqual(0);

            // Check calculated discount is 50_00 * 0.10 + 40_00 * 0.10 = 5_00 + 4_00 = 9_00
            expect(cart.bundleDiscounts).toHaveLength(1);
            expect(cart.bundleDiscounts[0].total).toEqual(9_00);
            expect(cart.bundleDiscounts[0].totalAlreadyApplied).toEqual(0);
            expect(cart.bundleDiscounts[0].netTotal).toEqual(9_00);

            expect(cart.price).toEqual(50_00 + 40_00 + 40_00);
            expect(checkout.totalPrice).toEqual(50_00 + 40_00 + 40_00 - 9_00);
            expect(checkout.priceBreakown).toEqual([
                expect.objectContaining({
                    price: 130_00,
                }),
                {
                    name: 'Bundle discount',
                    price: -9_00,
                },
                expect.objectContaining({
                    price: 130_00 - 9_00,
                }),
            ]);
        });

        test('The highest possible discount is granted', () => {
            const { organization, groups, family, discount } = setupDiscountTest({
                memberCount: 3,
                groupPrices: [50_00, 40_00],
                groupNames: ['Group A', 'Group B'],
                bundleDiscount: createBundleDiscount({
                    name: 'Bundle discount',
                    discounts: [
                        { value: 10_00, type: GroupPriceDiscountType.Percentage },
                    ],
                }),
            });

            const [groupA, groupB] = groups;
            const [memberA, memberB, memberC] = family.members;
            const itemA = RegisterItem.defaultFor(memberA, groupA, organization);
            const itemB = RegisterItem.defaultFor(memberB, groupB, organization);
            const itemC = RegisterItem.defaultFor(memberC, groupB, organization);

            // Change group B to give 20 euro for the second item, and 0 for the third item
            groupB.settings.prices[0].bundleDiscounts.set(discount.id, BundleDiscountGroupPriceSettings.create({
                name: discount.name,
                customDiscounts: [
                    GroupPriceDiscount.create({
                        value: ReduceablePrice.create({
                            price: 20_00,
                        }),
                        type: GroupPriceDiscountType.Fixed,
                    }),
                    GroupPriceDiscount.create({
                        value: ReduceablePrice.create({
                            price: 0,
                        }),
                        type: GroupPriceDiscountType.Fixed,
                    }),
                ],
            }));

            // Add to a single cart
            const checkout = family.checkout;
            const cart = checkout.cart;
            cart.add(itemA);
            cart.add(itemB);
            cart.add(itemC);
            cart.calculatePrices();
            // Check price for items
            expect(itemA.calculatedPrice).toEqual(50_00);
            expect(itemA.calculatedRefund).toEqual(0);
            expect(itemA.calculatedPriceDueLater).toEqual(0);

            expect(itemB.calculatedPrice).toEqual(40_00);
            expect(itemB.calculatedRefund).toEqual(0);
            expect(itemB.calculatedPriceDueLater).toEqual(0);
            expect(itemC.calculatedPrice).toEqual(40_00);
            expect(itemC.calculatedRefund).toEqual(0);
            expect(itemC.calculatedPriceDueLater).toEqual(0);

            // Check calculated discount is 50_00 * 0.10 + 20_00 fixed + 0 = 5_00 + 20_00 + 0 = 25_00
            expect(cart.bundleDiscounts).toHaveLength(1);
            expect(cart.bundleDiscounts[0].total).toEqual(25_00);
            expect(cart.bundleDiscounts[0].totalAlreadyApplied).toEqual(0);
            expect(cart.bundleDiscounts[0].netTotal).toEqual(25_00);

            expect(cart.price).toEqual(50_00 + 40_00 + 40_00);
            expect(checkout.totalPrice).toEqual(50_00 + 40_00 + 40_00 - 25_00);
            expect(checkout.priceBreakown).toEqual([
                expect.objectContaining({
                    price: 130_00,
                }),
                {
                    name: 'Bundle discount',
                    price: -25_00,
                },
                expect.objectContaining({
                    price: 130_00 - 25_00,
                }),
            ]);
        });

        test('Multiple bundles can be combined', () => {
            // Situation: Camp A costs 100 euro
            // Camp B costs 150 euro
            // Camp A and/or campB gives a discount of 10, 20, 30... (all camp discount)
            // On top of that there is an extra discount if you combine multiple expensive camps (camp B) of 5 euro, 10 ...

            const { organization, groups, family, organizationRegistrationPeriod } = setupDiscountTest({
                memberCount: 5,
                groupPrices: [100_00, 150_00],
                groupNames: ['Camp A', 'Camp B'],
                bundleDiscount: createBundleDiscount({
                    name: 'All camp discount',
                    discounts: [
                        { value: 10_00, type: GroupPriceDiscountType.Fixed },
                    ],
                }),
            });

            const [campA, campB] = groups;
            const [memberA, memberB, memberC, memberD, memberE] = family.members;

            const expensiveCampDiscount = createBundleDiscount({
                name: 'Expensive camp discount',
                discounts: [
                    { value: 5_00, type: GroupPriceDiscountType.Fixed },
                ],
            });

            // Add discount to organizationRegistrationPeriod
            organizationRegistrationPeriod.settings.bundleDiscounts.push(expensiveCampDiscount);

            // Add camp B to the expensive camp discount
            campB.settings.prices[0].bundleDiscounts.set(expensiveCampDiscount.id, BundleDiscountGroupPriceSettings.create({
                name: expensiveCampDiscount.name,
            }));

            // Add to a single cart
            const checkout = family.checkout;
            const cart = checkout.cart;

            const itemA = RegisterItem.defaultFor(memberA, campA, organization);
            const itemB = RegisterItem.defaultFor(memberB, campB, organization); // +10_00 discount
            const itemC = RegisterItem.defaultFor(memberC, campB, organization); // +10_00 discount and +5_00 discount
            const itemD = RegisterItem.defaultFor(memberD, campA, organization); // +10_00 discount
            const itemE = RegisterItem.defaultFor(memberE, campB, organization); // +10_00 discount and +5_00 discount

            cart.add(itemA);
            cart.add(itemB);
            cart.add(itemC);
            cart.add(itemD);
            cart.add(itemE);

            cart.calculatePrices();

            expect(cart.bundleDiscounts).toHaveLength(2);
            expect(cart.bundleDiscounts.map((d) => {
                return {
                    name: d.name,
                    total: d.total,
                    netTotal: d.netTotal,
                };
            })).toEqual([
                {
                    name: 'All camp discount',
                    total: 10_00 * 4,
                    netTotal: 10_00 * 4,
                },
                {
                    name: 'Expensive camp discount',
                    total: 5_00 * 2,
                    netTotal: 5_00 * 2,
                },
            ]);

            expect(checkout.priceBreakown).toEqual([
                expect.objectContaining({
                    price: 100_00 * 2 + 150_00 * 3,
                }),
                {
                    name: 'All camp discount',
                    price: -10_00 * 4,
                },
                {
                    name: 'Expensive camp discount',
                    price: -5_00 * 2,
                },
                expect.objectContaining({
                    price: 100_00 * 2 + 150_00 * 3 - 10_00 * 4 - 5_00 * 2,
                }),
            ]);
        });

        test('Previous discounts can be altered if a better optimum is found later', () => {
            // We have two family members with existing registrations.
            // One of those registrations received a discount earlier.
            // But since we are adding a new registration in our cart, a more optimal discount
            // would be if that registration would get the newly higher discount instead
            // (because it is percentage based)

            const { organization, groups, family, discount } = setupDiscountTest({
                memberCount: 2,
                bundleDiscount: createBundleDiscount({
                    name: 'Multiple family members discount',
                    countWholeFamily: true,
                    countPerGroup: false,
                    discounts: [
                        { value: 10_00, type: GroupPriceDiscountType.Percentage },
                        { value: 15_00, type: GroupPriceDiscountType.Percentage },
                    ],
                }),
                groupPrices: [100_00, 40_00],
            });

            const [groupA, groupB] = groups;
            const [memberA, memberB] = family.members;

            const registrationA = addHistoricRegistration(memberA, groupA, organization);
            const registrationB = addHistoricRegistration(memberB, groupB, organization);

            registrationA.discounts.set(discount.id, AppliedRegistrationDiscount.create({
                name: discount.name,
                amount: 10_00, // 10% discount on 100_00 = 10_00
            }));

            // Now create itemC
            const itemC = RegisterItem.defaultFor(memberA, groupB, organization);

            // Add to a single cart
            const checkout = family.checkout;
            const cart = checkout.cart;
            cart.add(itemC);
            cart.calculatePrices();

            // Check price for items
            expect(itemC.calculatedPrice).toEqual(40_00);
            expect(itemC.calculatedRefund).toEqual(0);
            expect(itemC.calculatedPriceDueLater).toEqual(0);

            // Check calculated discount is 100_00 * 0.15 + 40_00 * 0.10 = 15_00 + 4_00 = 19_00
            expect(cart.bundleDiscounts).toHaveLength(1);
            expect(cart.bundleDiscounts[0].total).toEqual(19_00);
            expect(cart.bundleDiscounts[0].totalAlreadyApplied).toEqual(10_00); // The previous discount
            expect(cart.bundleDiscounts[0].netTotal).toEqual(9_00);

            expect(cart.price).toEqual(40_00);
            expect(checkout.totalPrice).toEqual(40_00 - 9_00);
            expect(checkout.priceBreakown).toEqual([
                expect.objectContaining({
                    price: 40_00,
                }),
                {
                    name: 'Multiple family members discount',
                    price: -9_00,
                },
                expect.objectContaining({
                    price: 40_00 - 9_00,
                }),
            ]);
        });

        test('The repeating behaviour can be stopped by setting the last discount to zero', () => {
            // Create a family with 3 members. Add 3 items to the cart.
            // The bundle discount only defined one discount, but that should be repated for the second and third item

            const { organization, groups, family, discount } = setupDiscountTest({
                memberCount: 3,
                groupPrices: [50_00, 40_00],
                groupNames: ['Group A', 'Group B'],
                bundleDiscount: createBundleDiscount({
                    name: 'Bundle discount',
                    discounts: [
                        { value: 10_00, type: GroupPriceDiscountType.Percentage },
                        { value: 0, type: GroupPriceDiscountType.Percentage }, // This should stop the repeating behaviour
                    ],
                }),
            });
            const [groupA, groupB] = groups;
            const [memberA, memberB, memberC] = family.members;
            const itemA = RegisterItem.defaultFor(memberA, groupA, organization);
            const itemB = RegisterItem.defaultFor(memberB, groupB, organization);
            const itemC = RegisterItem.defaultFor(memberC, groupB, organization);

            // Add to a single cart
            const checkout = family.checkout;
            const cart = checkout.cart;
            cart.add(itemA);
            cart.add(itemB);
            cart.add(itemC);
            cart.calculatePrices();
            // Check price for items
            expect(itemA.calculatedPrice).toEqual(50_00);
            expect(itemA.calculatedRefund).toEqual(0);
            expect(itemA.calculatedPriceDueLater).toEqual(0);

            expect(itemB.calculatedPrice).toEqual(40_00);
            expect(itemB.calculatedRefund).toEqual(0);
            expect(itemB.calculatedPriceDueLater).toEqual(0);
            expect(itemC.calculatedPrice).toEqual(40_00);
            expect(itemC.calculatedRefund).toEqual(0);
            expect(itemC.calculatedPriceDueLater).toEqual(0);

            // Check calculated discount is 50_00 * 0.10 = 5_00
            expect(cart.bundleDiscounts).toHaveLength(1);
            expect(cart.bundleDiscounts[0].total).toEqual(5_00);
            expect(cart.bundleDiscounts[0].totalAlreadyApplied).toEqual(0);
            expect(cart.bundleDiscounts[0].netTotal).toEqual(5_00);

            expect(cart.price).toEqual(50_00 + 40_00 + 40_00);
            expect(checkout.totalPrice).toEqual(50_00 + 40_00 + 40_00 - 5_00);
            expect(checkout.priceBreakown).toEqual([
                expect.objectContaining({
                    price: 130_00,
                }),
                {
                    name: 'Bundle discount',
                    price: -5_00,
                },
                expect.objectContaining({
                    price: 130_00 - 5_00,
                }),
            ]);
        });

        test('Gives different discount for members with reduced price', () => {
            // Create familuy with 3 members.
            // One member has a reduced price.
            // The other two members have a normal price.
            // Create a 50%, 100% discount for the reduced price in a bundle discount (so it should be free in a family with 3 members)

            const { organization, groups, family } = setupDiscountTest({
                memberCount: 3,
                groupPrices: [50_00, 40_00],
                groupNames: ['Group A', 'Group B'],
                bundleDiscount: createBundleDiscount({
                    name: 'Bundle discount',
                    discounts: [
                        { value: 5_00, type: GroupPriceDiscountType.Percentage, reducedValue: 50_00 },
                        { value: 10_00, type: GroupPriceDiscountType.Percentage, reducedValue: 100_00 },
                    ],
                }),
            });

            const [groupA, groupB] = groups;
            const [memberA, memberB, memberC] = family.members;

            // Make sure the last member has a reduced price
            memberC.member.details.requiresFinancialSupport = BooleanStatus.create({ value: true });

            const itemA = RegisterItem.defaultFor(memberA, groupA, organization);
            const itemB = RegisterItem.defaultFor(memberB, groupB, organization);
            const itemC = RegisterItem.defaultFor(memberC, groupB, organization);

            // Add to a single cart
            const checkout = family.checkout;
            const cart = checkout.cart;
            cart.add(itemA);
            cart.add(itemB);
            cart.add(itemC);

            cart.calculatePrices();

            // Check price for items
            expect(itemA.calculatedPrice).toEqual(50_00);
            expect(itemB.calculatedPrice).toEqual(40_00);
            expect(itemC.calculatedPrice).toEqual(40_00);

            // Check calculated discount is 40_00 * 1 + 50_00 * 5% = 40_00 + 2_50 = 42_50
            expect(cart.bundleDiscounts).toHaveLength(1);
            expect(cart.bundleDiscounts[0].total).toEqual(42_50);
            expect(cart.bundleDiscounts[0].totalAlreadyApplied).toEqual(0);
            expect(cart.bundleDiscounts[0].netTotal).toEqual(42_50);
            expect(cart.price).toEqual(50_00 + 40_00 + 40_00);

            expect(checkout.totalPrice).toEqual(50_00 + 40_00 + 40_00 - 42_50);

            expect(checkout.priceBreakown).toEqual([
                expect.objectContaining({
                    price: 130_00,
                }),
                {
                    name: 'Bundle discount',
                    price: -42_50,
                },
                expect.objectContaining({
                    price: 130_00 - 42_50,
                }),
            ]);

            // Remove requires financial support, then recalculate
            memberC.member.details.requiresFinancialSupport = BooleanStatus.create({ value: false });

            cart.calculatePrices();

            // 10% on 50_00 + 5% on 40_00 = 5_00 + 2_00 = 7_00
            expect(checkout.priceBreakown).toEqual([
                expect.objectContaining({
                    price: 130_00,
                }),
                {
                    name: 'Bundle discount',
                    price: -7_00,
                },
                expect.objectContaining({
                    price: 130_00 - 7_00,
                }),
            ]);
        });

        test('Bundles without countWholeFamily only count per unique member', () => {
            // Register member A for both group A and group B
            // while member B is only registered for group A
            // Only member A should get the discount for either A or B (if the order matters)
            const { organization, groups, family } = setupDiscountTest({
                memberCount: 2,
                bundleDiscount: createBundleDiscount({
                    name: 'Multiple lessons discount',
                    countWholeFamily: false,
                    countPerGroup: false,
                    discounts: [
                        { value: 10_00, type: GroupPriceDiscountType.Percentage },
                    ],
                }),
            });
            const [groupA, groupB] = groups;
            const [memberA, memberB] = family.members;

            const itemA = RegisterItem.defaultFor(memberA, groupA, organization);
            const itemB = RegisterItem.defaultFor(memberA, groupB, organization);
            const itemC = RegisterItem.defaultFor(memberB, groupA, organization);

            // Add to a single cart
            const checkout = family.checkout;
            const cart = checkout.cart;
            cart.add(itemA);
            cart.add(itemB);
            cart.add(itemC);
            cart.calculatePrices();

            // Check price for items
            expect(itemA.calculatedPrice).toEqual(50_00);
            expect(itemB.calculatedPrice).toEqual(40_00);
            expect(itemC.calculatedPrice).toEqual(50_00);

            // Check calculated discount is 50_00 * 0.10 = 5_00
            expect(cart.bundleDiscounts.map(c => c.netTotal)).toHaveLength(1);
            expect(cart.bundleDiscounts[0].total).toEqual(5_00);
            expect(cart.bundleDiscounts[0].netTotal).toEqual(5_00);

            expect(cart.price).toEqual(50_00 + 40_00 + 50_00);
            expect(checkout.totalPrice).toEqual(50_00 + 40_00 + 50_00 - 5_00);

            expect(checkout.priceBreakown).toEqual([
                expect.objectContaining({
                    price: 50_00 + 40_00 + 50_00,
                }),
                {
                    name: 'Multiple lessons discount (John)',
                    price: -5_00,
                },
                expect.objectContaining({
                    price: 50_00 + 40_00 + 50_00 - 5_00,
                }),
            ]);

            // Add a historic registration for member B, so it also gets a discount
            addHistoricRegistration(memberB, groupB, organization);
            cart.calculatePrices();

            expect(checkout.priceBreakown).toEqual([
                expect.objectContaining({
                    price: 50_00 + 40_00 + 50_00, // no change
                }),
                {
                    name: 'Multiple lessons discount (John)',
                    price: -5_00,
                },
                {
                    name: 'Multiple lessons discount (Jane)',
                    price: -5_00,
                },
                expect.objectContaining({
                    price: 50_00 + 40_00 + 50_00 - 5_00 - 5_00,
                }),
            ]);
        });

        test('Bundles with countPerGroup only count per unique group', () => {
            const { organization, groups, family, discount } = setupDiscountTest({
                memberCount: 2,
                groupNames: ['Group A', 'Group B'],
                bundleDiscount: createBundleDiscount({
                    name: 'Multiple family members discount',
                    countWholeFamily: true,
                    countPerGroup: true,
                    discounts: [
                        { value: 10_00, type: GroupPriceDiscountType.Percentage },
                    ],
                }),
            });
            const [groupA, groupB] = groups;
            const [memberA, memberB] = family.members;

            // Both members register for the different groups, does not give the discount
            const itemA = RegisterItem.defaultFor(memberA, groupA, organization);
            const itemB = RegisterItem.defaultFor(memberB, groupB, organization);

            // Add to a single cart
            const checkout = family.checkout;
            const cart = checkout.cart;
            cart.add(itemA);
            cart.add(itemB);
            cart.calculatePrices();

            // No discount should be applied yet (need at least 2 different groups)
            expect(cart.bundleDiscounts).toHaveLength(0);
            expect(checkout.totalPrice).toEqual(50_00 + 40_00);

            // Now register one member for group B as well
            const itemC = RegisterItem.defaultFor(memberA, groupB, organization);
            cart.add(itemC);
            cart.calculatePrices();

            // Now we should get a discount
            expect(cart.bundleDiscounts).toHaveLength(1);
            expect(cart.bundleDiscounts[0].total).toEqual(4_00); // 10% of 40_00 (not 50_00)
            expect(cart.bundleDiscounts[0].netTotal).toEqual(4_00);

            expect(cart.price).toEqual(50_00 + 40_00 + 40_00);
            expect(checkout.totalPrice).toEqual(50_00 + 40_00 + 40_00 - 4_00);

            expect(checkout.priceBreakown).toEqual([
                expect.objectContaining({
                    price: 50_00 + 40_00 + 40_00,
                }),
                {
                    name: 'Multiple family members discount (Group B)',
                    price: -4_00,
                },
                expect.objectContaining({
                    price: 50_00 + 40_00 + 40_00 - 4_00,
                }),
            ]);

            // Change calculation to count across groups
            discount.countPerGroup = false;
            cart.calculatePrices();

            // Now we should get a discount for both groups
            expect(checkout.priceBreakown).toEqual([
                expect.objectContaining({
                    price: 50_00 + 40_00 + 40_00,
                }),
                {
                    name: 'Multiple family members discount',
                    price: -9_00,
                },
                expect.objectContaining({
                    price: 50_00 + 40_00 + 40_00 - 9_00,
                }),
            ]);
        });

        test('countPerGroup = true is ignored if countWholeFamily is false', () => {
            const { organization, groups, family, discount } = setupDiscountTest({
                memberCount: 2,
                groupNames: ['Group A', 'Group B'],
                bundleDiscount: createBundleDiscount({
                    name: 'Multiple lessons discount',
                    countWholeFamily: false, // This means only count per unique member
                    countPerGroup: true, // This should be ignored since countWholeFamily is false
                    discounts: [
                        { value: 10_00, type: GroupPriceDiscountType.Percentage },
                    ],
                }),
            });
            const [groupA, groupB] = groups;
            const [memberA, memberB] = family.members;

            // Register member A for both group A and B
            // Register member B for group A
            const itemA = RegisterItem.defaultFor(memberA, groupA, organization);
            const itemB = RegisterItem.defaultFor(memberA, groupB, organization);
            const itemC = RegisterItem.defaultFor(memberB, groupA, organization);

            // Add to a single cart
            const checkout = family.checkout;
            const cart = checkout.cart;
            cart.add(itemA);
            cart.add(itemB);
            cart.add(itemC);
            cart.calculatePrices();

            // Check price for items
            expect(itemA.calculatedPrice).toEqual(50_00);
            expect(itemB.calculatedPrice).toEqual(40_00);
            expect(itemC.calculatedPrice).toEqual(50_00);

            // Check calculated discount - should only apply to member A (who has multiple registrations)
            expect(cart.bundleDiscounts).toHaveLength(1);
            expect(cart.bundleDiscounts[0].total).toEqual(5_00); // 10% of 50_00 (we always apply discounts to highest price first)
            expect(cart.bundleDiscounts[0].netTotal).toEqual(5_00);

            expect(cart.price).toEqual(50_00 + 40_00 + 50_00);
            expect(checkout.totalPrice).toEqual(50_00 + 40_00 + 50_00 - 5_00);

            expect(checkout.priceBreakown).toEqual([
                expect.objectContaining({
                    price: 50_00 + 40_00 + 50_00,
                }),
                {
                    name: 'Multiple lessons discount (John)',
                    price: -5_00,
                },
                expect.objectContaining({
                    price: 50_00 + 40_00 + 50_00 - 5_00,
                }),
            ]);

            // Now explicitly turn on countPerGroup and set countWholeFamily to true
            // to verify it behaves differently (proving that countPerGroup was indeed ignored before)
            discount.countWholeFamily = true;
            discount.countPerGroup = true;
            cart.calculatePrices();

            // Now we should get a discount for group A (since two members are registered for it)
            expect(checkout.priceBreakown).toEqual([
                expect.objectContaining({
                    price: 50_00 + 40_00 + 50_00,
                }),
                {
                    name: 'Multiple lessons discount (Group A)',
                    price: -5_00, // 10% of the second 50_00
                },
                expect.objectContaining({
                    price: 50_00 + 40_00 + 50_00 - 5_00,
                }),
            ]);
        });

        test('Past discounts are only altered if a related registration is added or removed', () => {
            // Create two historic registrations that didn't get an existing discount (= error)
            // now, add a new registration to the cart that is not applicable to the discount - the old discount should not be altered

            const { organization, groups, family, period, discount } = setupDiscountTest({
                memberCount: 2,
                groupPrices: [50_00, 40_00],
                groupNames: ['Group A', 'Group B'],
                bundleDiscount: createBundleDiscount({
                    name: 'Multiple family members discount',
                    countWholeFamily: true,
                    countPerGroup: false,
                    discounts: [
                        { value: 10_00, type: GroupPriceDiscountType.Percentage },
                    ],
                }),
            });

            const [groupA, groupB] = groups;
            const [memberA, memberB] = family.members;

            const registrationA = addHistoricRegistration(memberA, groupA, organization);
            const registrationB = addHistoricRegistration(memberB, groupB, organization);

            // Create a new group that is not applicable to the discount
            const [groupC] = createTestGroups(organization, period, [30_00], ['Group C']);
            const itemC = RegisterItem.defaultFor(memberA, groupC, organization);

            // Add to a single cart
            const checkout = family.checkout;
            const cart = checkout.cart;
            cart.add(itemC);
            cart.calculatePrices();
            expect(itemC.calculatedPrice).toEqual(30_00);

            expect(cart.bundleDiscounts).toHaveLength(0);
            expect(checkout.totalPrice).toEqual(30_00);
            expect(checkout.priceBreakown).toEqual([
                expect.objectContaining({
                    price: 30_00,
                }),
            ]);

            // Now also register memberB for group A and add it to the cart
            const itemD = RegisterItem.defaultFor(memberB, groupA, organization);
            cart.add(itemD);

            cart.calculatePrices();
            // Check price for items
            expect(itemD.calculatedPrice).toEqual(50_00);
            expect(itemC.calculatedPrice).toEqual(30_00);

            // Check calculated discount: should also take old registrations into account
            // 50_00 * 10% + 50_00 * 10% = 5_00 + 5_00 = 10_00
            expect(cart.bundleDiscounts).toHaveLength(1);
            expect(cart.bundleDiscounts[0].total).toEqual(10_00);
            expect(cart.bundleDiscounts[0].totalAlreadyApplied).toEqual(0);
            expect(cart.bundleDiscounts[0].netTotal).toEqual(10_00);
            expect(cart.price).toEqual(50_00 + 30_00);
            expect(checkout.totalPrice).toEqual(50_00 + 30_00 - 10_00);
            expect(checkout.priceBreakown).toEqual([
                expect.objectContaining({
                    price: 50_00 + 30_00,
                }),
                {
                    name: 'Multiple family members discount',
                    price: -10_00,
                },
                expect.objectContaining({
                    price: 50_00 + 30_00 - 10_00,
                }),
            ]);
        });

        test.todo('Can handle bundle discounts for a future period');
        test.todo('Families should be calculated correctly for admins');
        test.todo('The price per item can never be negative');
    });
});
