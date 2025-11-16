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
import { GenericBalance } from '../../GenericBalance.js';

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

function createTestGroups(organization: Organization, period: RegistrationPeriod, prices: number[] = [50_0000, 40_0000], names?: string[]) {
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
        { value: 10_0000, type: GroupPriceDiscountType.Fixed },
        { value: 15_0000, type: GroupPriceDiscountType.Fixed },
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
    groupPrices = [50_0000, 40_0000],
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

function addHistoricRegistration(member: ReturnType<typeof createTestFamily>['members'][0], group: Group, organization: Organization, appliedDiscounts: Map<string, AppliedRegistrationDiscount> = new Map()) {
    const registration = Registration.create({
        group: group,
        groupPrice: group.settings.prices[0],
        memberId: member.id,
        organizationId: group.organizationId,
        registeredAt: new Date('2023-01-01'),
        startDate: new Date('2023-01-01'),
        price: group.settings.prices[0].price.price,
        balances: [
            GenericBalance.create({
                organizationId: organization.id,
                amountPaid: 0,
                amountOpen: group.settings.prices[0].price.price - [...appliedDiscounts.values()].reduce((acc, d) => acc + d.amount, 0),
                amountPending: 0,
            }),
        ],
        discounts: appliedDiscounts,
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
                        { value: 10_0000, type: GroupPriceDiscountType.Fixed },
                        { value: 15_0000, type: GroupPriceDiscountType.Fixed },
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
            expect(itemA.calculatedPrice).toEqual(50_0000);
            expect(itemA.calculatedRefund).toEqual(0);
            expect(itemA.calculatedPriceDueLater).toEqual(0);

            // Check price for items B and C
            expect(itemB.calculatedPrice).toEqual(40_0000);
            expect(itemB.calculatedRefund).toEqual(0);
            expect(itemB.calculatedPriceDueLater).toEqual(0);

            expect(itemC.calculatedPrice).toEqual(40_0000);
            expect(itemC.calculatedRefund).toEqual(0);
            expect(itemC.calculatedPriceDueLater).toEqual(0);

            // Check calculated discount is 10_0000 + 15_0000 = 25_0000
            expect(cart.bundleDiscounts).toHaveLength(1);
            expect(cart.bundleDiscounts[0].total).toEqual(25_0000);
            expect(cart.bundleDiscounts[0].totalAlreadyApplied).toEqual(0);
            expect(cart.bundleDiscounts[0].netTotal).toEqual(25_0000);

            expect(cart.price).toEqual(50_0000 + 40_0000 + 40_0000);
            expect(checkout.totalPrice).toEqual(50_0000 + 40_0000 + 40_0000 - 25_0000);

            expect(checkout.priceBreakown).toEqual([
                expect.objectContaining({
                    price: 130_0000,
                }),
                {
                    name: 'Bundle discount',
                    price: -25_0000,
                },
                expect.objectContaining({
                    price: 130_0000 - 25_0000,
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
            expect(itemA.calculatedPrice).toEqual(50_0000);
            expect(itemB.calculatedPrice).toEqual(40_0000);
            expect(itemC.calculatedPrice).toEqual(40_0000);

            // 15% will be applied to 50 euro (max), and 10% to one of the 40 euros
            // Check calculated discount is 50_0000 * 0.15 + 40_0000 * 0.10 = 7_5000 + 4_0000 = 11_5000
            expect(cart.bundleDiscounts).toHaveLength(1);
            expect(cart.bundleDiscounts[0].total).toEqual(11_5000);
            expect(cart.bundleDiscounts[0].netTotal).toEqual(11_5000);

            expect(cart.price).toEqual(50_0000 + 40_0000 + 40_0000);
            expect(checkout.totalPrice).toEqual(50_0000 + 40_0000 + 40_0000 - 11_5000);

            expect(checkout.priceBreakown).toEqual([
                expect.objectContaining({
                    price: 130_0000,
                }),
                {
                    name: 'Bundle discount',
                    price: -11_5000,
                },
                expect.objectContaining({
                    price: 130_0000 - 11_5000,
                }),
            ]);
        });

        test('Percentage discounts are rounded to 1 cent', () => {
            const { organization, groups, family } = setupDiscountTest({
                bundleDiscount: createBundleDiscount({
                    name: 'Bundle discount',
                    discounts: [
                        { value: 1_11, type: GroupPriceDiscountType.Percentage },
                        { value: 1_52, type: GroupPriceDiscountType.Percentage },
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
            expect(itemA.calculatedPrice).toEqual(50_0000);
            expect(itemB.calculatedPrice).toEqual(40_0000);
            expect(itemC.calculatedPrice).toEqual(40_0000);

            // 1,5% will be applied to 50 euro (max), and 1% to one of the 40 euros
            // Check calculated discount is 50_0000 * 0.0152 + 40_0000 * 0.0111 = 7500 + 4000 = 1_2040 normally, but not allowed, rounded to 1_2000
            expect(cart.bundleDiscounts).toHaveLength(1);
            expect(cart.bundleDiscounts[0].total).toEqual(1_2000);
            expect(cart.bundleDiscounts[0].netTotal).toEqual(1_2000);

            expect(cart.price).toEqual(50_0000 + 40_0000 + 40_0000);
            expect(checkout.totalPrice).toEqual(50_0000 + 40_0000 + 40_0000 - 1_2000);

            expect(checkout.priceBreakown).toEqual([
                expect.objectContaining({
                    price: 130_0000,
                }),
                {
                    name: 'Bundle discount',
                    price: -1_2000,
                },
                expect.objectContaining({
                    price: 130_0000 - 1_2000,
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
            expect(itemB.calculatedPrice).toEqual(40_0000);
            expect(itemC.calculatedPrice).toEqual(40_0000);

            // 15% will be applied to 50 euro (max), and 10% to one of the 40 euros
            // Check calculated discount is 50_0000 * 0.15 + 40_0000 * 0.10 = 7_5000 + 4_0000 = 11_5000
            expect(cart.bundleDiscounts).toHaveLength(1);
            expect(cart.bundleDiscounts[0].total).toEqual(11_5000);
            expect(cart.bundleDiscounts[0].netTotal).toEqual(11_5000);

            expect(cart.price).toEqual(40_0000 + 40_0000);
            expect(checkout.totalPrice).toEqual(40_0000 + 40_0000 - 11_5000);

            expect(checkout.priceBreakown).toEqual([
                expect.objectContaining({
                    price: 80_0000,
                }),
                {
                    name: 'Bundle discount',
                    price: -11_5000,
                },
                expect.objectContaining({
                    price: 80_0000 - 11_5000,
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
                groupPrices: [100_0000, 40_0000],
            });

            const [groupA, groupB] = groups;
            const [memberA, memberB] = family.members;

            const registrationA = addHistoricRegistration(memberA, groupA, organization);
            const registrationB = addHistoricRegistration(memberB, groupB, organization, new Map([
                [
                    discount.id,
                    AppliedRegistrationDiscount.create({
                        name: discount.name,
                        amount: 10_0000, // 10% discount on 100_0000 = 10_0000
                    }),
                ],
            ]));

            // If we delete registration B, the discount won't be visible in the cart because it is included in the registration
            const checkout = family.checkout;
            const cart = checkout.cart;
            cart.removeRegistration(
                new RegistrationWithPlatformMember({
                    registration: registrationB,
                    member: memberB,
                }),
            );

            cart.calculatePrices();

            expect(cart.bundleDiscounts).toHaveLength(0);

            expect(checkout.totalPrice).toEqual(-30_0000);
            expect(checkout.priceBreakown).toEqual([
                expect.objectContaining({
                    price: -40_0000 + 10_0000,
                }),
                expect.objectContaining({
                    price: -40_0000 + 10_0000,
                }),
            ]);

            // Now readd the registration
            cart.unremoveRegistration(
                new RegistrationWithPlatformMember({
                    registration: registrationB,
                    member: memberB,
                }));

            // Remove registration A, this should show the discount because it is a side effect of deleting the registration

            cart.removeRegistration(
                new RegistrationWithPlatformMember({
                    registration: registrationA,
                    member: memberA,
                }),
            );
            cart.calculatePrices();

            expect(cart.bundleDiscounts).toHaveLength(1);
            expect(cart.bundleDiscounts[0].total).toEqual(0);
            expect(cart.bundleDiscounts[0].totalAlreadyApplied).toEqual(10_0000); // The previous discount
            expect(cart.bundleDiscounts[0].netTotal).toEqual(-10_0000);
            expect(checkout.totalPrice).toEqual(-90_0000);
            expect(checkout.priceBreakown).toEqual([
                expect.objectContaining({
                    price: -100_0000, // Reeds aangerekend
                }),
                {
                    name: '766a39be-a4af-4a04-baf0-1f064d2fed16 (Multiple family members discount)',
                    price: 10_0000,
                },
                expect.objectContaining({
                    price: -90_0000,
                }),
            ]);
        });

        test('Deleting a registration with cancellation fees', () => {
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
                groupPrices: [100_0000, 40_0000],
            });

            const [groupA, groupB] = groups;
            const [memberA, memberB] = family.members;

            const registrationA = addHistoricRegistration(memberA, groupA, organization);
            const registrationB = addHistoricRegistration(memberB, groupB, organization, new Map([
                [
                    discount.id,
                    AppliedRegistrationDiscount.create({
                        name: discount.name,
                        amount: 10_0000, // 10% discount on 1_0000 = 10_00
                    }),
                ],
            ]));

            // If we delete registration B, the discount won't be visible in the cart because it is included in the registration
            const checkout = family.checkout;
            checkout.cancellationFeePercentage = 50_00;
            const cart = checkout.cart;
            cart.removeRegistration(
                new RegistrationWithPlatformMember({
                    registration: registrationB,
                    member: memberB,
                }),
            );

            cart.calculatePrices();

            expect(cart.bundleDiscounts).toHaveLength(0);

            expect(checkout.totalPrice).toEqual(-15_0000);
            expect(checkout.priceBreakown).toEqual([
                expect.objectContaining({
                    price: -40_0000 + 10_0000, // Already charged amount
                }),
                // Cancellation fee = 50% of the balance total, 30_0000 = 15_0000
                expect.objectContaining({
                    price: 15_0000,
                }),
                expect.objectContaining({
                    price: -15_0000,
                }),
            ]);

            // Now readd the registration
            cart.unremoveRegistration(
                new RegistrationWithPlatformMember({
                    registration: registrationB,
                    member: memberB,
                }));

            // Remove registration A, this should show the discount because it is a side effect of deleting the registration

            cart.removeRegistration(
                new RegistrationWithPlatformMember({
                    registration: registrationA,
                    member: memberA,
                }),
            );
            cart.calculatePrices();

            expect(cart.bundleDiscounts).toHaveLength(1);
            expect(cart.bundleDiscounts[0].total).toEqual(0);
            expect(cart.bundleDiscounts[0].totalAlreadyApplied).toEqual(10_0000); // The previous discount
            expect(cart.bundleDiscounts[0].netTotal).toEqual(-10_0000);
            expect(checkout.totalPrice).toEqual(-40_0000);
            expect(checkout.priceBreakown).toEqual([
                expect.objectContaining({
                    price: -100_0000, // Already charged for registration A that is being deleted
                }),
                // Cancellation fee = 50% of the balance total, 100_0000 = 50_0000
                expect.objectContaining({
                    price: 50_0000,
                }),
                {
                    // Side effect in registration B
                    name: '766a39be-a4af-4a04-baf0-1f064d2fed16 (Multiple family members discount)',
                    price: 10_0000,
                },
                expect.objectContaining({
                    price: -40_0000,
                }),
            ]);
        });

        test('Replacing a registration without discount also removes the attached discount in another registration if the new registration in not elegible', () => {
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
                groupPrices: [100_0000, 40_0000],
            });
            const [groupA, groupB] = groups;
            const [memberA, memberB] = family.members;
            const registrationA = addHistoricRegistration(memberA, groupA, organization);
            addHistoricRegistration(memberB, groupB, organization, new Map([
                [
                    discount.id,
                    AppliedRegistrationDiscount.create({
                        name: discount.name,
                        amount: 10_0000, // 10% discount on 100_0000 = 10_0000
                    }),
                ],
            ]));

            const groupCPrice = GroupPrice.create({
                price: ReduceablePrice.create({
                    price: 50_0000,
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
            expect(itemA.calculatedPrice).toEqual(50_0000);
            expect(itemA.calculatedRefund).toEqual(100_0000);
            expect(itemA.calculatedPriceDueLater).toEqual(0);

            // Check discount should be given back
            expect(cart.bundleDiscounts).toHaveLength(1);
            expect(cart.bundleDiscounts[0].total).toEqual(0);
            expect(cart.bundleDiscounts[0].totalAlreadyApplied).toEqual(10_0000); // The previous discount
            expect(cart.bundleDiscounts[0].netTotal).toEqual(-10_0000);

            expect(checkout.totalPrice).toEqual(50_0000 - 100_0000 + 10_0000);
            expect(checkout.priceBreakown).toEqual([
                expect.objectContaining({
                    // Subtotal (normal price)
                    price: 50_0000,
                }),
                expect.objectContaining({
                    // Refund for the previous registration
                    price: -100_0000,
                }),
                {
                    name: '766a39be-a4af-4a04-baf0-1f064d2fed16 (Multiple family members discount)',
                    price: 10_0000,
                },
                expect.objectContaining({
                    price: -50_0000 + 10_0000,
                }),
            ]);

            // Now, what if groupC does have a higher discount instead of no discount?
            groupCPrice.bundleDiscounts.set(discount.id, BundleDiscountGroupPriceSettings.create({
                name: discount.name,
                customDiscounts: [
                    // Custom discount for this price
                    GroupPriceDiscount.create({
                        value: ReduceablePrice.create({
                            price: 25_0000,
                        }),
                        type: GroupPriceDiscountType.Fixed,
                    }),
                ],
            }));

            // Recalculate
            cart.calculatePrices();

            // Check discount should be given back
            expect(cart.bundleDiscounts).toHaveLength(1);
            expect(cart.bundleDiscounts[0].total).toEqual(25_0000);
            expect(cart.bundleDiscounts[0].totalAlreadyApplied).toEqual(10_0000); // The previous discount
            expect(cart.bundleDiscounts[0].netTotal).toEqual(15_0000);

            expect(checkout.totalPrice).toEqual(50_0000 - 100_0000 - 15_0000);
            expect(checkout.priceBreakown).toEqual([
                expect.objectContaining({
                    // Subtotal (normal price)
                    price: 50_0000,
                }),
                expect.objectContaining({
                    // Refund for the previous registration
                    price: -100_0000,
                }),
                {
                    name: 'Multiple family members discount',
                    price: -15_0000,
                },
                expect.objectContaining({
                    price: -50_0000 - 15_0000,
                }),
            ]);
        });

        test('Replacing a registration with discount also removes the attached discount registration if the new registration in not elegible', () => {
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
                groupPrices: [100_0000, 40_0000],
            });
            const [groupA, groupB] = groups;
            const [memberA, memberB] = family.members;
            const registrationA = addHistoricRegistration(memberA, groupA, organization, new Map([
                [
                    discount.id,
                    AppliedRegistrationDiscount.create({
                        name: discount.name,
                        amount: 10_0000, // 10% discount on 100_0000 = 10_0000
                    }),
                ],
            ]));
            addHistoricRegistration(memberB, groupB, organization);

            const groupCPrice = GroupPrice.create({
                price: ReduceablePrice.create({
                    price: 50_0000,
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
            expect(itemA.calculatedPrice).toEqual(50_0000);
            expect(itemA.calculatedRefund).toEqual(90_0000);
            expect(itemA.calculatedPriceDueLater).toEqual(0);

            // No discounts anymore
            expect(cart.bundleDiscounts).toHaveLength(0);

            expect(checkout.totalPrice).toEqual(50_0000 - 90_0000);
            expect(checkout.priceBreakown).toEqual([
                expect.objectContaining({
                    // Subtotal (normal price)
                    price: 50_0000,
                }),
                expect.objectContaining({
                    // Refund for the previous registration, without the discount that was granted
                    price: -90_0000,
                }),
                expect.objectContaining({
                    price: 50_0000 - 90_0000,
                }),
            ]);

            // Now, what if groupC does have a higher discount instead of no discount?
            groupCPrice.bundleDiscounts.set(discount.id, BundleDiscountGroupPriceSettings.create({
                name: discount.name,
                customDiscounts: [
                    // Custom discount for this price
                    GroupPriceDiscount.create({
                        value: ReduceablePrice.create({
                            price: 25_0000,
                        }),
                        type: GroupPriceDiscountType.Fixed,
                    }),
                ],
            }));

            // Recalculate
            cart.calculatePrices();

            // Check discount should be given back
            expect(cart.bundleDiscounts).toHaveLength(1);
            expect(cart.bundleDiscounts[0].total).toEqual(25_0000);
            expect(cart.bundleDiscounts[0].totalAlreadyApplied).toEqual(0); // Not included here, because the registration will be removed including the applied discount
            expect(cart.bundleDiscounts[0].netTotal).toEqual(25_0000);

            expect(checkout.totalPrice).toEqual(50_0000 - 90_0000 - 25_0000);
            expect(checkout.priceBreakown).toEqual([
                expect.objectContaining({
                    // Subtotal (normal price)
                    price: 50_0000,
                }),
                expect.objectContaining({
                    // Refund for the previous registration
                    price: -90_0000,
                }),
                {
                    name: 'Multiple family members discount',
                    price: -25_0000,
                },
                expect.objectContaining({
                    price: 50_0000 - 90_0000 - 25_0000,
                }),
            ]);
        });

        test('The last discount is repeated', () => {
            // Create a family with 3 members. Add 3 items to the cart.
            // The bundle discount only defined one discount, but that should be repated for the second and third item

            const { organization, groups, family, discount } = setupDiscountTest({
                memberCount: 3,
                groupPrices: [50_0000, 40_0000],
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
            expect(itemA.calculatedPrice).toEqual(50_0000);
            expect(itemA.calculatedRefund).toEqual(0);
            expect(itemA.calculatedPriceDueLater).toEqual(0);

            expect(itemB.calculatedPrice).toEqual(40_0000);
            expect(itemB.calculatedRefund).toEqual(0);
            expect(itemB.calculatedPriceDueLater).toEqual(0);
            expect(itemC.calculatedPrice).toEqual(40_0000);
            expect(itemC.calculatedRefund).toEqual(0);
            expect(itemC.calculatedPriceDueLater).toEqual(0);

            // Check calculated discount is 50_0000 * 0.10 + 40_0000 * 0.10 = 5_0000 + 4_0000 = 9_0000
            expect(cart.bundleDiscounts).toHaveLength(1);
            expect(cart.bundleDiscounts[0].total).toEqual(9_0000);
            expect(cart.bundleDiscounts[0].totalAlreadyApplied).toEqual(0);
            expect(cart.bundleDiscounts[0].netTotal).toEqual(9_0000);

            expect(cart.price).toEqual(50_0000 + 40_0000 + 40_0000);
            expect(checkout.totalPrice).toEqual(50_0000 + 40_0000 + 40_0000 - 9_0000);
            expect(checkout.priceBreakown).toEqual([
                expect.objectContaining({
                    price: 130_0000,
                }),
                {
                    name: 'Bundle discount',
                    price: -9_0000,
                },
                expect.objectContaining({
                    price: 130_0000 - 9_0000,
                }),
            ]);
        });

        test('The highest possible discount is granted', () => {
            const { organization, groups, family, discount } = setupDiscountTest({
                memberCount: 3,
                groupPrices: [50_0000, 40_0000],
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
                            price: 20_0000,
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
            expect(itemA.calculatedPrice).toEqual(50_0000);
            expect(itemA.calculatedRefund).toEqual(0);
            expect(itemA.calculatedPriceDueLater).toEqual(0);

            expect(itemB.calculatedPrice).toEqual(40_0000);
            expect(itemB.calculatedRefund).toEqual(0);
            expect(itemB.calculatedPriceDueLater).toEqual(0);
            expect(itemC.calculatedPrice).toEqual(40_0000);
            expect(itemC.calculatedRefund).toEqual(0);
            expect(itemC.calculatedPriceDueLater).toEqual(0);

            // Check calculated discount is 50_0000 * 0.10 + 20_0000 fixed + 0 = 5_0000 + 20_0000 + 0 = 25_0000
            expect(cart.bundleDiscounts).toHaveLength(1);
            expect(cart.bundleDiscounts[0].total).toEqual(25_0000);
            expect(cart.bundleDiscounts[0].totalAlreadyApplied).toEqual(0);
            expect(cart.bundleDiscounts[0].netTotal).toEqual(25_0000);

            expect(cart.price).toEqual(50_0000 + 40_0000 + 40_0000);
            expect(checkout.totalPrice).toEqual(50_0000 + 40_0000 + 40_0000 - 25_0000);
            expect(checkout.priceBreakown).toEqual([
                expect.objectContaining({
                    price: 130_0000,
                }),
                {
                    name: 'Bundle discount',
                    price: -25_0000,
                },
                expect.objectContaining({
                    price: 130_0000 - 25_0000,
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
                groupPrices: [100_0000, 150_0000],
                groupNames: ['Camp A', 'Camp B'],
                bundleDiscount: createBundleDiscount({
                    name: 'All camp discount',
                    discounts: [
                        { value: 10_0000, type: GroupPriceDiscountType.Fixed },
                    ],
                }),
            });

            const [campA, campB] = groups;
            const [memberA, memberB, memberC, memberD, memberE] = family.members;

            const expensiveCampDiscount = createBundleDiscount({
                name: 'Expensive camp discount',
                discounts: [
                    { value: 5_0000, type: GroupPriceDiscountType.Fixed },
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
            const itemB = RegisterItem.defaultFor(memberB, campB, organization); // +10_0000 discount
            const itemC = RegisterItem.defaultFor(memberC, campB, organization); // +10_0000 discount and +5_0000 discount
            const itemD = RegisterItem.defaultFor(memberD, campA, organization); // +10_0000 discount
            const itemE = RegisterItem.defaultFor(memberE, campB, organization); // +10_0000 discount and +5_0000 discount

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
                    total: 10_0000 * 4,
                    netTotal: 10_0000 * 4,
                },
                {
                    name: 'Expensive camp discount',
                    total: 5_0000 * 2,
                    netTotal: 5_0000 * 2,
                },
            ]);

            expect(checkout.priceBreakown).toEqual([
                expect.objectContaining({
                    price: 100_0000 * 2 + 150_0000 * 3,
                }),
                {
                    name: 'All camp discount',
                    price: -10_0000 * 4,
                },
                {
                    name: 'Expensive camp discount',
                    price: -5_0000 * 2,
                },
                expect.objectContaining({
                    price: 100_0000 * 2 + 150_0000 * 3 - 10_0000 * 4 - 5_0000 * 2,
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
                groupPrices: [100_0000, 40_0000],
            });

            const [groupA, groupB] = groups;
            const [memberA, memberB] = family.members;

            const registrationA = addHistoricRegistration(memberA, groupA, organization);
            const registrationB = addHistoricRegistration(memberB, groupB, organization);

            registrationA.discounts.set(discount.id, AppliedRegistrationDiscount.create({
                name: discount.name,
                amount: 10_0000, // 10% discount on 100_0000 = 10_0000
            }));

            // Now create itemC
            const itemC = RegisterItem.defaultFor(memberA, groupB, organization);

            // Add to a single cart
            const checkout = family.checkout;
            const cart = checkout.cart;
            cart.add(itemC);
            cart.calculatePrices();

            // Check price for items
            expect(itemC.calculatedPrice).toEqual(40_0000);
            expect(itemC.calculatedRefund).toEqual(0);
            expect(itemC.calculatedPriceDueLater).toEqual(0);

            // Check calculated discount is 100_0000 * 0.15 + 40_0000 * 0.10 = 15_0000 + 4_0000 = 19_0000
            expect(cart.bundleDiscounts).toHaveLength(1);
            expect(cart.bundleDiscounts[0].total).toEqual(19_0000);
            expect(cart.bundleDiscounts[0].totalAlreadyApplied).toEqual(10_0000); // The previous discount
            expect(cart.bundleDiscounts[0].netTotal).toEqual(9_0000);

            expect(cart.price).toEqual(40_0000);
            expect(checkout.totalPrice).toEqual(40_0000 - 9_0000);
            expect(checkout.priceBreakown).toEqual([
                expect.objectContaining({
                    price: 40_0000,
                }),
                {
                    name: 'Multiple family members discount',
                    price: -9_0000,
                },
                expect.objectContaining({
                    price: 40_0000 - 9_0000,
                }),
            ]);
        });

        test('The repeating behaviour can be stopped by setting the last discount to zero', () => {
            // Create a family with 3 members. Add 3 items to the cart.
            // The bundle discount only defined one discount, but that should be repated for the second and third item

            const { organization, groups, family, discount } = setupDiscountTest({
                memberCount: 3,
                groupPrices: [50_0000, 40_0000],
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
            expect(itemA.calculatedPrice).toEqual(50_0000);
            expect(itemA.calculatedRefund).toEqual(0);
            expect(itemA.calculatedPriceDueLater).toEqual(0);

            expect(itemB.calculatedPrice).toEqual(40_0000);
            expect(itemB.calculatedRefund).toEqual(0);
            expect(itemB.calculatedPriceDueLater).toEqual(0);
            expect(itemC.calculatedPrice).toEqual(40_0000);
            expect(itemC.calculatedRefund).toEqual(0);
            expect(itemC.calculatedPriceDueLater).toEqual(0);

            // Check calculated discount is 50_0000 * 0.10 = 5_0000
            expect(cart.bundleDiscounts).toHaveLength(1);
            expect(cart.bundleDiscounts[0].total).toEqual(5_0000);
            expect(cart.bundleDiscounts[0].totalAlreadyApplied).toEqual(0);
            expect(cart.bundleDiscounts[0].netTotal).toEqual(5_0000);

            expect(cart.price).toEqual(50_0000 + 40_0000 + 40_0000);
            expect(checkout.totalPrice).toEqual(50_0000 + 40_0000 + 40_0000 - 5_0000);
            expect(checkout.priceBreakown).toEqual([
                expect.objectContaining({
                    price: 130_0000,
                }),
                {
                    name: 'Bundle discount',
                    price: -5_0000,
                },
                expect.objectContaining({
                    price: 130_0000 - 5_0000,
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
                groupPrices: [50_0000, 40_0000],
                groupNames: ['Group A', 'Group B'],
                bundleDiscount: createBundleDiscount({
                    name: 'Bundle discount',
                    discounts: [
                        { value: 5_00, type: GroupPriceDiscountType.Percentage, reducedValue: 50_00 },
                        { value: 10_00, type: GroupPriceDiscountType.Percentage, reducedValue: 1_0000 },
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
            expect(itemA.calculatedPrice).toEqual(50_0000);
            expect(itemB.calculatedPrice).toEqual(40_0000);
            expect(itemC.calculatedPrice).toEqual(40_0000);

            // Check calculated discount is 40_0000 * 1 + 50_0000 * 5% = 40_0000 + 2_5000 = 42_5000
            expect(cart.bundleDiscounts).toHaveLength(1);
            expect(cart.bundleDiscounts[0].total).toEqual(42_5000);
            expect(cart.bundleDiscounts[0].totalAlreadyApplied).toEqual(0);
            expect(cart.bundleDiscounts[0].netTotal).toEqual(42_5000);
            expect(cart.price).toEqual(50_0000 + 40_0000 + 40_0000);

            expect(checkout.totalPrice).toEqual(50_0000 + 40_0000 + 40_0000 - 42_5000);

            expect(checkout.priceBreakown).toEqual([
                expect.objectContaining({
                    price: 130_0000,
                }),
                {
                    name: 'Bundle discount',
                    price: -42_5000,
                },
                expect.objectContaining({
                    price: 130_0000 - 42_5000,
                }),
            ]);

            // Remove requires financial support, then recalculate
            memberC.member.details.requiresFinancialSupport = BooleanStatus.create({ value: false });

            cart.calculatePrices();

            // 10% on 50_0000 + 5% on 40_0000 = 5_0000 + 2_0000 = 7_0000
            expect(checkout.priceBreakown).toEqual([
                expect.objectContaining({
                    price: 130_0000,
                }),
                {
                    name: 'Bundle discount',
                    price: -7_0000,
                },
                expect.objectContaining({
                    price: 130_0000 - 7_0000,
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
            expect(itemA.calculatedPrice).toEqual(50_0000);
            expect(itemB.calculatedPrice).toEqual(40_0000);
            expect(itemC.calculatedPrice).toEqual(50_0000);

            // Check calculated discount is 50_0000 * 0.10 = 5_0000
            expect(cart.bundleDiscounts.map(c => c.netTotal)).toHaveLength(1);
            expect(cart.bundleDiscounts[0].total).toEqual(5_0000);
            expect(cart.bundleDiscounts[0].netTotal).toEqual(5_0000);

            expect(cart.price).toEqual(50_0000 + 40_0000 + 50_0000);
            expect(checkout.totalPrice).toEqual(50_0000 + 40_0000 + 50_0000 - 5_0000);

            expect(checkout.priceBreakown).toEqual([
                expect.objectContaining({
                    price: 50_0000 + 40_0000 + 50_0000,
                }),
                {
                    name: 'Multiple lessons discount (John)',
                    price: -5_0000,
                },
                expect.objectContaining({
                    price: 50_0000 + 40_0000 + 50_0000 - 5_0000,
                }),
            ]);

            // Add a historic registration for member B, so it also gets a discount
            addHistoricRegistration(memberB, groupB, organization);
            cart.calculatePrices();

            expect(checkout.priceBreakown).toEqual([
                expect.objectContaining({
                    price: 50_0000 + 40_0000 + 50_0000, // no change
                }),
                {
                    name: 'Multiple lessons discount (John)',
                    price: -5_0000,
                },
                {
                    name: 'Multiple lessons discount (Jane)',
                    price: -5_0000,
                },
                expect.objectContaining({
                    price: 50_0000 + 40_0000 + 50_0000 - 5_0000 - 5_0000,
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
            expect(checkout.totalPrice).toEqual(50_0000 + 40_0000);

            // Now register one member for group B as well
            const itemC = RegisterItem.defaultFor(memberA, groupB, organization);
            cart.add(itemC);
            cart.calculatePrices();

            // Now we should get a discount
            expect(cart.bundleDiscounts).toHaveLength(1);
            expect(cart.bundleDiscounts[0].total).toEqual(4_0000); // 10% of 40_0000 (not 50_0000)
            expect(cart.bundleDiscounts[0].netTotal).toEqual(4_0000);

            expect(cart.price).toEqual(50_0000 + 40_0000 + 40_0000);
            expect(checkout.totalPrice).toEqual(50_0000 + 40_0000 + 40_0000 - 4_0000);

            expect(checkout.priceBreakown).toEqual([
                expect.objectContaining({
                    price: 50_0000 + 40_0000 + 40_0000,
                }),
                {
                    name: 'Multiple family members discount (Group B)',
                    price: -4_0000,
                },
                expect.objectContaining({
                    price: 50_0000 + 40_0000 + 40_0000 - 4_0000,
                }),
            ]);

            // Change calculation to count across groups
            discount.countPerGroup = false;
            cart.calculatePrices();

            // Now we should get a discount for both groups
            expect(checkout.priceBreakown).toEqual([
                expect.objectContaining({
                    price: 50_0000 + 40_0000 + 40_0000,
                }),
                {
                    name: 'Multiple family members discount',
                    price: -9_0000,
                },
                expect.objectContaining({
                    price: 50_0000 + 40_0000 + 40_0000 - 9_0000,
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
            expect(itemA.calculatedPrice).toEqual(50_0000);
            expect(itemB.calculatedPrice).toEqual(40_0000);
            expect(itemC.calculatedPrice).toEqual(50_0000);

            // Check calculated discount - should only apply to member A (who has multiple registrations)
            expect(cart.bundleDiscounts).toHaveLength(1);
            expect(cart.bundleDiscounts[0].total).toEqual(5_0000); // 10% of 50_0000 (we always apply discounts to highest price first)
            expect(cart.bundleDiscounts[0].netTotal).toEqual(5_0000);

            expect(cart.price).toEqual(50_0000 + 40_0000 + 50_0000);
            expect(checkout.totalPrice).toEqual(50_0000 + 40_0000 + 50_0000 - 5_0000);

            expect(checkout.priceBreakown).toEqual([
                expect.objectContaining({
                    price: 50_0000 + 40_0000 + 50_0000,
                }),
                {
                    name: 'Multiple lessons discount (John)',
                    price: -5_0000,
                },
                expect.objectContaining({
                    price: 50_0000 + 40_0000 + 50_0000 - 5_0000,
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
                    price: 50_0000 + 40_0000 + 50_0000,
                }),
                {
                    name: 'Multiple lessons discount (Group A)',
                    price: -5_0000, // 10% of the second 50_0000
                },
                expect.objectContaining({
                    price: 50_0000 + 40_0000 + 50_0000 - 5_0000,
                }),
            ]);
        });

        test('Past discounts are only altered if a related registration is added or removed', () => {
            // Create two historic registrations that didn't get an existing discount (= error)
            // now, add a new registration to the cart that is not applicable to the discount - the old discount should not be altered

            const { organization, groups, family, period, discount } = setupDiscountTest({
                memberCount: 2,
                groupPrices: [50_0000, 40_0000],
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
            const [groupC] = createTestGroups(organization, period, [30_0000], ['Group C']);
            const itemC = RegisterItem.defaultFor(memberA, groupC, organization);

            // Add to a single cart
            const checkout = family.checkout;
            const cart = checkout.cart;
            cart.add(itemC);
            cart.calculatePrices();
            expect(itemC.calculatedPrice).toEqual(30_0000);

            expect(cart.bundleDiscounts).toHaveLength(0);
            expect(checkout.totalPrice).toEqual(30_0000);
            expect(checkout.priceBreakown).toEqual([
                expect.objectContaining({
                    price: 30_0000,
                }),
            ]);

            // Now also register memberB for group A and add it to the cart
            const itemD = RegisterItem.defaultFor(memberB, groupA, organization);
            cart.add(itemD);

            cart.calculatePrices();
            // Check price for items
            expect(itemD.calculatedPrice).toEqual(50_0000);
            expect(itemC.calculatedPrice).toEqual(30_0000);

            // Check calculated discount: should also take old registrations into account
            // 50_0000 * 10% + 50_0000 * 10% = 5_0000 + 5_0000 = 10_0000
            expect(cart.bundleDiscounts).toHaveLength(1);
            expect(cart.bundleDiscounts[0].total).toEqual(10_0000);
            expect(cart.bundleDiscounts[0].totalAlreadyApplied).toEqual(0);
            expect(cart.bundleDiscounts[0].netTotal).toEqual(10_0000);
            expect(cart.price).toEqual(50_0000 + 30_0000);
            expect(checkout.totalPrice).toEqual(50_0000 + 30_0000 - 10_0000);
            expect(checkout.priceBreakown).toEqual([
                expect.objectContaining({
                    price: 50_0000 + 30_0000,
                }),
                {
                    name: 'Multiple family members discount',
                    price: -10_0000,
                },
                expect.objectContaining({
                    price: 50_0000 + 30_0000 - 10_0000,
                }),
            ]);
        });

        test('Fixed discounts are limited to the group price', () => {
            const { organization, groups, family, discount } = setupDiscountTest({
                memberCount: 2,
                groupNames: ['Group A', 'Group B'],
                bundleDiscount: createBundleDiscount({
                    name: 'Multiple family members discount',
                    countWholeFamily: true,
                    countPerGroup: false,
                    discounts: [
                        { value: 1000_0000, type: GroupPriceDiscountType.Fixed },
                    ],
                }),
            });
            const [groupA, groupB] = groups;
            const [memberA, memberB] = family.members;

            const itemA = RegisterItem.defaultFor(memberA, groupA, organization);
            const itemB = RegisterItem.defaultFor(memberB, groupB, organization);

            // Add to a single cart
            const checkout = family.checkout;
            const cart = checkout.cart;
            cart.add(itemA);
            cart.add(itemB);
            cart.calculatePrices();

            expect(cart.bundleDiscounts).toHaveLength(1);
            expect(cart.bundleDiscounts[0].total).toEqual(50_0000);
            expect(cart.bundleDiscounts[0].totalAlreadyApplied).toEqual(0);
            expect(cart.bundleDiscounts[0].netTotal).toEqual(50_0000);
            expect(cart.price).toEqual(50_0000 + 40_0000);
            expect(checkout.totalPrice).toEqual(40_0000);

            expect(checkout.priceBreakown).toEqual([
                expect.objectContaining({
                    price: 50_0000 + 40_0000,
                }),
                {
                    name: 'Multiple family members discount',
                    price: -50_0000,
                },
                expect.objectContaining({
                    price: 40_0000,
                }),
            ]);
        });

        test.todo('Can handle bundle discounts for a future period');
        test.todo('Families should be calculated correctly for admins');
        test.todo('The price per item can never be negative');
    });
});
