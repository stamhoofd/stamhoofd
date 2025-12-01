import { Request } from '@simonbackx/simple-endpoints';
import { BalanceItem, BalanceItemFactory, GroupFactory, MemberFactory, Organization, OrganizationFactory, OrganizationRegistrationPeriodFactory, Registration, RegistrationFactory, RegistrationPeriod, RegistrationPeriodFactory, Token, UserFactory } from '@stamhoofd/models';
import { AccessRight, AppliedRegistrationDiscount, BalanceItemRelation, BalanceItemRelationType, BalanceItemStatus, BalanceItemType, BooleanStatus, GroupPriceDiscount, GroupPriceDiscountType, IDRegisterCart, IDRegisterCheckout, IDRegisterItem, PaymentMethod, PermissionLevel, Permissions, PermissionsResourceType, ReduceablePrice, ResourcePermissions } from '@stamhoofd/structures';
import { STExpect, TestUtils } from '@stamhoofd/test-utils';
import { RegisterMembersEndpoint } from '../../src/endpoints/global/registration/RegisterMembersEndpoint';
import { assertBalances } from '../assertions/assertBalances';
import { testServer } from '../helpers/TestServer';
import { initBundleDiscount } from '../init/initBundleDiscount';
import { initStripe } from '../init/initStripe';
import { initAdmin } from '../init/initAdmin';
import { BalanceItemService } from '../../src/services/BalanceItemService';
import { initPermissionRole } from '../init';

const baseUrl = `/members/register`;

describe('E2E.Bundle Discounts', () => {
    const endpoint = new RegisterMembersEndpoint();
    let period: RegistrationPeriod;
    const post = async (body: IDRegisterCheckout, organization: Organization, token: Token) => {
        const request = Request.post({
            path: baseUrl,
            host: organization.getApiHost(),
            body,
            headers: {
                authorization: 'Bearer ' + token.accessToken,
            },
        });
        return await testServer.test(endpoint, request);
    };

    beforeAll(async () => {
        const previousPeriod = await new RegistrationPeriodFactory({
            startDate: new Date(2022, 0, 1),
            endDate: new Date(2022, 11, 31),
        }).create();

        period = await new RegistrationPeriodFactory({
            startDate: new Date(2023, 0, 1),
            endDate: new Date(2030, 11, 31),
            previousPeriodId: previousPeriod.id,
        }).create();
    });

    beforeEach(async () => {
        TestUtils.setEnvironment('userMode', 'platform');
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    async function initData() {
        const organization = await new OrganizationFactory({ period })
            .create();

        const organizationRegistrationPeriod = await new OrganizationRegistrationPeriodFactory({ organization, period }).create();

        const user = await new UserFactory({
            organization,
            permissions: null,
        }).create();

        const token = await Token.createToken(user);

        const member = await new MemberFactory({ organization, user })
            .create();

        return {
            organization,
            organizationRegistrationPeriod,
            user,
            token,
            member,
        };
    }

    describe('Registering as member', () => {
        test('PointOfSale: The first registration has no discount applied', async () => {
            const { organizationRegistrationPeriod, organization, member, token, user } = await initData();
            const bundleDiscount = await initBundleDiscount({
                organizationRegistrationPeriod,
                discount: {
                    discounts: [
                        { value: 20_00, type: GroupPriceDiscountType.Percentage },
                    ],
                },
            });

            const group = await new GroupFactory({
                organization,
                price: 25_0000,
                bundleDiscount,
            })
                .create();

            const groupPrice = group.settings.prices[0];

            // First register the member for group 1. No discount should be applied yet
            const checkout1 = IDRegisterCheckout.create({
                cart: IDRegisterCart.create({
                    items: [
                        IDRegisterItem.create({
                            groupPrice,
                            groupId: group.id,
                            organizationId: organization.id,
                            memberId: member.id,
                        }),
                    ],
                }),
                paymentMethod: PaymentMethod.PointOfSale,
                totalPrice: 25_0000,
            });

            const response1 = await post(checkout1, organization, token);
            expect(response1.body.registrations).toEqual([
                expect.objectContaining({
                    registeredAt: expect.any(Date),
                    discounts: new Map(),
                }),
            ]);

            await assertBalances({ user }, [
                {
                    type: BalanceItemType.Registration,
                    amount: 1,
                    price: 25_0000,
                    status: BalanceItemStatus.Due,
                    priceOpen: 0,
                    pricePending: 25_0000,
                },
            ]);
        });

        test('Unrelated registrations do not get counted for bundle discounts', async () => {
            const { organizationRegistrationPeriod, organization, member, token, user } = await initData();
            const bundleDiscount = await initBundleDiscount({
                organizationRegistrationPeriod,
                discount: {
                    discounts: [
                        { value: 20_00, type: GroupPriceDiscountType.Percentage },
                    ],
                },
            });

            const group = await new GroupFactory({
                organization,
                price: 25_0000,
            }).create();

            const groupPrice = group.settings.prices[0];

            const group2 = await new GroupFactory({
                organization,
                price: 35_0000,
                bundleDiscount,
            }).create();

            const groupPrice2 = group2.settings.prices[0];

            // First register the member for group 1. No discount should be applied yet
            const checkout1 = IDRegisterCheckout.create({
                cart: IDRegisterCart.create({
                    items: [
                        IDRegisterItem.create({
                            groupPrice,
                            groupId: group.id,
                            organizationId: organization.id,
                            memberId: member.id,
                        }),
                    ],
                }),
                paymentMethod: PaymentMethod.PointOfSale,
                totalPrice: 25_0000,
            });

            const response1 = await post(checkout1, organization, token);
            expect(response1.body.registrations.length).toBe(1);
            const registration1 = response1.body.registrations[0];
            expect(registration1.registeredAt).not.toBeNull();
            expect(registration1.discounts).toMatchMap(new Map());

            const checkout2 = IDRegisterCheckout.create({
                cart: IDRegisterCart.create({
                    items: [
                        IDRegisterItem.create({
                            groupPrice: groupPrice2,
                            groupId: group2.id,
                            organizationId: organization.id,
                            memberId: member.id,
                        }),
                    ],
                }),
                paymentMethod: PaymentMethod.PointOfSale,
                totalPrice: 35_0000,
            });
            const response2 = await post(checkout2, organization, token);
            expect(response2.body.registrations.length).toBe(1);

            const registration2 = response2.body.registrations[0];
            expect(registration2.registeredAt).not.toBeNull();
            expect(registration2.discounts).toMatchMap(new Map());

            const updatedRegistration1 = (await Registration.getByID(registration1.id))!;
            expect(updatedRegistration1).toBeDefined();
            expect(updatedRegistration1.discounts).toMatchMap(new Map());

            await assertBalances({ user }, [
                {
                    type: BalanceItemType.Registration,
                    registrationId: registration1.id,
                    amount: 1,
                    price: 25_0000,
                    status: BalanceItemStatus.Due,
                    priceOpen: 0,
                    pricePending: 25_0000,
                },
                {
                    type: BalanceItemType.Registration,
                    registrationId: registration2.id,
                    amount: 1,
                    price: 35_0000,
                    status: BalanceItemStatus.Due,
                    priceOpen: 0,
                    pricePending: 35_0000,
                },
            ]);
        });

        test('PointOfSale: A bundle discount can be applied to a previous registration', async () => {
            const { organizationRegistrationPeriod, organization, member, token, user } = await initData();
            const bundleDiscount = await initBundleDiscount({
                organizationRegistrationPeriod,
                discount: {
                    discounts: [
                        { value: 20_00, type: GroupPriceDiscountType.Percentage },
                    ],
                },
            });

            const group = await new GroupFactory({
                organization,
                price: 25_0000,
                bundleDiscount,
            }).create();

            const groupPrice = group.settings.prices[0];

            const group2 = await new GroupFactory({
                organization,
                price: 15_0000, // Lower price so discount is applied preferably on the first group
                bundleDiscount,
            }).create();

            const groupPrice2 = group2.settings.prices[0];

            // First register the member for group 1. No discount should be applied yet
            const checkout1 = IDRegisterCheckout.create({
                cart: IDRegisterCart.create({
                    items: [
                        IDRegisterItem.create({
                            groupPrice,
                            groupId: group.id,
                            organizationId: organization.id,
                            memberId: member.id,
                        }),
                    ],
                }),
                paymentMethod: PaymentMethod.PointOfSale,
                totalPrice: groupPrice.price.price,
            });

            const response1 = await post(checkout1, organization, token);
            expect(response1.body.registrations.length).toBe(1);
            const registration1 = response1.body.registrations[0];
            expect(registration1.registeredAt).not.toBeNull();
            expect(registration1.discounts).toMatchMap(new Map());

            const checkout2 = IDRegisterCheckout.create({
                cart: IDRegisterCart.create({
                    items: [
                        IDRegisterItem.create({
                            groupPrice: groupPrice2,
                            groupId: group2.id,
                            organizationId: organization.id,
                            memberId: member.id,
                        }),
                    ],
                }),
                paymentMethod: PaymentMethod.PointOfSale,
                totalPrice: 15_0000 - 5_0000, // 20% discount on first group
            });
            const response2 = await post(checkout2, organization, token);
            expect(response2.body.registrations.length).toBe(1);

            const registration2 = response2.body.registrations[0];
            expect(registration2.registeredAt).not.toBeNull();
            expect(registration2.discounts).toMatchMap(new Map());

            // Get registration 1 again, it should now have the bundle discount applied
            const updatedRegistration1 = (await Registration.getByID(registration1.id))!;
            expect(updatedRegistration1).toBeDefined();
            expect(updatedRegistration1.discounts).toMatchMap(new Map([
                [bundleDiscount.id, AppliedRegistrationDiscount.create({
                    name: bundleDiscount.name,
                    amount: 5_0000,
                })],
            ]));

            await assertBalances({ user }, [
                {
                    type: BalanceItemType.Registration,
                    registrationId: registration1.id,
                    amount: 1,
                    price: 25_0000,
                    status: BalanceItemStatus.Due,
                    priceOpen: 0,
                    pricePending: 25_0000,
                },
                {
                    type: BalanceItemType.RegistrationBundleDiscount,
                    registrationId: registration1.id,
                    amount: 1,
                    price: -5_0000,
                    status: BalanceItemStatus.Due,
                    priceOpen: 0,
                    pricePending: -5_0000,
                },
                {
                    type: BalanceItemType.Registration,
                    registrationId: registration2.id,
                    amount: 1,
                    price: 15_0000,
                    status: BalanceItemStatus.Due,
                    priceOpen: 0,
                    pricePending: 15_0000,
                },
            ]);
        });

        test('PointOfSale: A bundle discount can be applied to an added registration', async () => {
            const { organizationRegistrationPeriod, organization, member, token, user } = await initData();
            const bundleDiscount = await initBundleDiscount({
                organizationRegistrationPeriod,
                discount: {
                    discounts: [
                        { value: 20_00, type: GroupPriceDiscountType.Percentage },
                    ],
                },
            });

            const group = await new GroupFactory({
                organization,
                price: 25_0000,
                bundleDiscount,
            })
                .create();

            const groupPrice = group.settings.prices[0];

            const group2 = await new GroupFactory({
                organization,
                price: 35_0000, // Higher price so discount is applied preferably here
                bundleDiscount,
            }).create();

            const groupPrice2 = group2.settings.prices[0];

            // First register the member for group 1. No discount should be applied yet
            const checkout1 = IDRegisterCheckout.create({
                cart: IDRegisterCart.create({
                    items: [
                        IDRegisterItem.create({
                            groupPrice,
                            groupId: group.id,
                            organizationId: organization.id,
                            memberId: member.id,
                        }),
                    ],
                }),
                paymentMethod: PaymentMethod.PointOfSale,
                totalPrice: 25_0000,
            });

            const response1 = await post(checkout1, organization, token);
            expect(response1.body.registrations.length).toBe(1);
            const registration1 = response1.body.registrations[0];
            expect(registration1.registeredAt).not.toBeNull();
            expect(registration1.discounts).toMatchMap(new Map());

            const checkout2 = IDRegisterCheckout.create({
                cart: IDRegisterCart.create({
                    items: [
                        IDRegisterItem.create({
                            groupPrice: groupPrice2,
                            groupId: group2.id,
                            organizationId: organization.id,
                            memberId: member.id,
                        }),
                    ],
                }),
                paymentMethod: PaymentMethod.PointOfSale,
                totalPrice: 35_0000 - 7_0000, // 20% discount on 35_00 = 7_00
            });
            const response2 = await post(checkout2, organization, token);
            expect(response2.body.registrations.length).toBe(1);

            const registration2 = response2.body.registrations[0];
            expect(registration2.registeredAt).not.toBeNull();
            expect(registration2.discounts).toMatchMap(new Map([
                [
                    bundleDiscount.id,
                    AppliedRegistrationDiscount.create({
                        name: bundleDiscount.name,
                        amount: 7_0000,
                    }),
                ],
            ]));

            // Get registration 1 again, it should now have the bundle discount applied
            const updatedRegistration1 = (await Registration.getByID(registration1.id))!;
            expect(updatedRegistration1).toBeDefined();
            expect(updatedRegistration1.discounts).toMatchMap(new Map());

            await assertBalances({ user }, [
                {
                    type: BalanceItemType.Registration,
                    registrationId: registration1.id,
                    amount: 1,
                    price: 25_0000,
                    status: BalanceItemStatus.Due,
                    priceOpen: 0,
                    pricePending: 25_0000,
                },
                {
                    type: BalanceItemType.RegistrationBundleDiscount,
                    registrationId: registration2.id,
                    amount: 1,
                    price: -7_0000,
                    status: BalanceItemStatus.Due,
                    priceOpen: 0,
                    pricePending: -7_0000,
                },
                {
                    type: BalanceItemType.Registration,
                    registrationId: registration2.id,
                    amount: 1,
                    price: 35_0000,
                    status: BalanceItemStatus.Due,
                    priceOpen: 0,
                    pricePending: 35_0000,
                },
            ]);
        });

        test('PointOfSale: A bundle discount can be applied to a new and previous registration at the same time', async () => {
            const { organizationRegistrationPeriod, organization, member, token, user } = await initData();
            const bundleDiscount = await initBundleDiscount({
                organizationRegistrationPeriod,
                discount: {
                    discounts: [
                        { value: 20_00, type: GroupPriceDiscountType.Percentage },
                        { value: 40_00, type: GroupPriceDiscountType.Percentage },
                    ],
                },
            });

            const groups = [
                await new GroupFactory({
                    organization,
                    price: 35_0000,
                    bundleDiscount,
                }).create(),
                await new GroupFactory({
                    organization,
                    price: 25_0000,
                    bundleDiscount,
                }).create(),
                await new GroupFactory({
                    organization,
                    price: 45_0000,
                    bundleDiscount,
                }).create(),
            ];

            // Create existing registration for group 1
            const registration1 = await new RegistrationFactory({
                organization,
                member,
                group: groups[0],
            }).create();

            // Create balance item for existing registration
            await new BalanceItemFactory({
                userId: user.id,
                memberId: member.id,
                organizationId: organization.id,
                registrationId: registration1.id,
                type: BalanceItemType.Registration,
                amount: 1,
                unitPrice: 35_0000,
                status: BalanceItemStatus.Due,
            }).create();

            // Now register the member for group 2 & 3 at the same time
            const checkout = IDRegisterCheckout.create({
                cart: IDRegisterCart.create({
                    items: [
                        IDRegisterItem.create({
                            options: [],
                            groupPrice: groups[1].settings.prices[0],
                            groupId: groups[1].id,
                            organizationId: organization.id,
                            memberId: member.id,
                        }),
                        IDRegisterItem.create({
                            options: [],
                            groupPrice: groups[2].settings.prices[0],
                            groupId: groups[2].id,
                            organizationId: organization.id,
                            memberId: member.id,
                        }),
                    ],
                }),
                administrationFee: 0,
                freeContribution: 0,
                paymentMethod: PaymentMethod.PointOfSale,
                totalPrice: 25_0000 + 45_0000 - 7_0000 - 18_0000, // 20% off 35_00 = 7_00, 40% off 45_00 = 18_00
            });
            const response = await post(checkout, organization, token);
            expect(response.body.registrations.length).toBe(2);
            const registration2 = response.body.registrations.find(r => r.groupId === groups[1].id)!;
            const registration3 = response.body.registrations.find(r => r.groupId === groups[2].id)!;

            expect(registration2).toMatchObject({
                registeredAt: expect.any(Date),
                discounts: new Map(),
            });

            expect(registration3).toMatchObject({
                registeredAt: expect.any(Date),
                discounts: new Map([
                    [
                        bundleDiscount.id,
                        AppliedRegistrationDiscount.create({
                            name: bundleDiscount.name,
                            amount: 18_0000,
                        }),
                    ],
                ]),
            });

            await assertBalances({ user }, [
                {
                    registrationId: registration1.id,
                    unitPrice: 35_0000,
                    amount: 1,
                    type: BalanceItemType.Registration,
                    priceOpen: 35_0000,
                },
                {
                    registrationId: registration2.id,
                    unitPrice: 25_0000,
                    amount: 1,
                    type: BalanceItemType.Registration,
                    pricePending: 25_0000,
                },
                {
                    registrationId: registration3.id,
                    unitPrice: 45_0000,
                    amount: 1,
                    type: BalanceItemType.Registration,
                    pricePending: 45_0000,
                },
                // Discounts
                {
                    registrationId: registration1.id,
                    unitPrice: -7_0000,
                    amount: 1,
                    type: BalanceItemType.RegistrationBundleDiscount,
                    pricePending: -7_0000,
                },
                {
                    registrationId: registration3.id,
                    unitPrice: -18_0000,
                    amount: 1,
                    type: BalanceItemType.RegistrationBundleDiscount,
                    pricePending: -18_0000,
                },
            ]);
        });

        /**
         * When we calculate the discounts, we calculate the discount based on the group price at the time of the registration.
         * This also mainly applies to corrections that happen later
         */
        test('Discounts are calculated based on the price at time of registration', async () => {
            const { organizationRegistrationPeriod, organization, member, token, user } = await initData();
            const bundleDiscount = await initBundleDiscount({
                organizationRegistrationPeriod,
                discount: {
                    discounts: [
                        { value: 20_00, type: GroupPriceDiscountType.Percentage },
                        { value: 40_00, type: GroupPriceDiscountType.Percentage },
                    ],
                },
            });

            const groups = [
                await new GroupFactory({
                    organization,
                    price: 35_0000,
                    bundleDiscount,
                }).create(),
                await new GroupFactory({
                    organization,
                    price: 25_0000,
                    bundleDiscount,
                }).create(),
            ];

            // Create existing registration for group 1
            const registration1 = await new RegistrationFactory({
                organization,
                member,
                group: groups[0],
                groupPrice: groups[0].settings.prices[0].patch({
                    price: ReduceablePrice.create({
                        price: 30_0000, // This has changed, the group normally 'costs' 35_00
                    }),
                }),
            }).create();

            // Create balance item for existing registration
            await new BalanceItemFactory({
                userId: user.id,
                memberId: member.id,
                organizationId: organization.id,
                registrationId: registration1.id,
                type: BalanceItemType.Registration,
                amount: 1,
                unitPrice: 30_0000, // This has changed, the group normally 'costs' 35_00
                status: BalanceItemStatus.Due,
            }).create();

            // Now register the member for group 2 & 3 at the same time
            const checkout = IDRegisterCheckout.create({
                cart: IDRegisterCart.create({
                    items: [
                        IDRegisterItem.create({
                            options: [],
                            groupPrice: groups[1].settings.prices[0],
                            groupId: groups[1].id,
                            organizationId: organization.id,
                            memberId: member.id,
                        }),
                    ],
                }),
                administrationFee: 0,
                freeContribution: 0,
                paymentMethod: PaymentMethod.PointOfSale,
                totalPrice: 25_0000 - 6_0000, // 20% of 30_00 = 6_00
            });
            const response = await post(checkout, organization, token);
            expect(response.body.registrations.length).toBe(1);
            const registration2 = response.body.registrations[0];

            expect(registration2).toMatchObject({
                registeredAt: expect.any(Date),
                discounts: new Map(),
            });

            await assertBalances({ user }, [
                {
                    registrationId: registration1.id,
                    unitPrice: 30_0000,
                    amount: 1,
                    type: BalanceItemType.Registration,
                    priceOpen: 30_0000,
                },
                {
                    registrationId: registration2.id,
                    unitPrice: 25_0000,
                    amount: 1,
                    type: BalanceItemType.Registration,
                    pricePending: 25_0000,
                },
                // Discounts
                {
                    registrationId: registration1.id,
                    unitPrice: -6_0000,
                    amount: 1,
                    type: BalanceItemType.RegistrationBundleDiscount,
                    pricePending: -6_0000,
                },
            ]);
        });

        /**
         * If you cancel a registration with 100% cancellation fee, we'll keep the balances items 'Due'.
         * This tests that we don't substract the discounts on those registration on new registrations.
         */
        test('A previous discount on a cancelled registration that has a 100% cancellation fee is not taken into account', async () => {
            const { organizationRegistrationPeriod, organization, member, token, user } = await initData();
            const bundleDiscount = await initBundleDiscount({
                organizationRegistrationPeriod,
                discount: {
                    discounts: [
                        { value: 20_00, type: GroupPriceDiscountType.Percentage },
                        { value: 100_00, type: GroupPriceDiscountType.Percentage },
                    ],
                },
            });

            const groups = [
                await new GroupFactory({
                    organization,
                    price: 25_0000,
                    bundleDiscount,
                }).create(),

                await new GroupFactory({
                    organization,
                    price: 15_0000,
                    bundleDiscount,
                }).create(),

                await new GroupFactory({
                    organization,
                    price: 35_0000,
                    bundleDiscount,
                }).create(),
            ];

            const registrations = [
                await new RegistrationFactory({
                    organization,
                    member,
                    group: groups[0],
                    deactivatedAt: new Date(), // had a discount in the past - but was cancelled
                }).create(),
                await new RegistrationFactory({
                    organization,
                    member,
                    group: groups[1],
                }).create(),
            ];

            // Create initial balances
            await new BalanceItemFactory({
                userId: user.id,
                memberId: member.id,
                organizationId: organization.id,
                registrationId: registrations[0].id,
                type: BalanceItemType.Registration,
                amount: 1,
                unitPrice: 25_0000,
                status: BalanceItemStatus.Due, // Still due, because we had a 100% cancellation fee
            }).create();

            // Create applied discount
            await new BalanceItemFactory({
                userId: user.id,
                memberId: member.id,
                organizationId: organization.id,
                registrationId: registrations[0].id,
                type: BalanceItemType.RegistrationBundleDiscount,
                amount: 1,
                unitPrice: -5_0000,
                status: BalanceItemStatus.Due, // Still due, because we had a 100% cancellation fee
                relations: new Map([
                    [
                        BalanceItemRelationType.Discount,
                        BalanceItemRelation.create({
                            // We need the ID of the discount saved here
                            id: bundleDiscount.id,
                            name: bundleDiscount.name,
                        }),
                    ],
                ]),
            }).create();

            await new BalanceItemFactory({
                userId: user.id,
                memberId: member.id,
                organizationId: organization.id,
                registrationId: registrations[1].id,
                type: BalanceItemType.Registration,
                amount: 1,
                unitPrice: 15_0000,
                status: BalanceItemStatus.Due,
            }).create();

            // Register for group 3
            const checkout = IDRegisterCheckout.create({
                cart: IDRegisterCart.create({
                    items: [
                        IDRegisterItem.create({
                            options: [],
                            groupPrice: groups[2].settings.prices[0],
                            groupId: groups[2].id,
                            organizationId: organization.id,
                            memberId: member.id,
                        }),
                    ],
                }),
                administrationFee: 0,
                freeContribution: 0,
                paymentMethod: PaymentMethod.PointOfSale,
                totalPrice: 35_0000 - 7_0000, // 20% of 35 = 7_00
            });
            const response = await post(checkout, organization, token);
            const registration3 = response.body.registrations[0];

            // Check did not reuse id
            expect(registration3.id).not.toEqual(registrations[0].id);

            expect(registration3).toMatchObject({
                registeredAt: expect.any(Date),
                discounts: new Map([
                    [bundleDiscount.id, AppliedRegistrationDiscount.create({
                        name: bundleDiscount.name,
                        amount: 7_0000,
                    })],
                ]),
            });

            // Check registration 1 still has the discount applied
            await registrations[0].refresh();
            expect(registrations[0].discounts).toMatchMap(new Map([
                [bundleDiscount.id, AppliedRegistrationDiscount.create({
                    name: bundleDiscount.name,
                    amount: 5_0000,
                })],
            ]));

            // Check balances as expected
            await assertBalances({ user }, [
                {
                    type: BalanceItemType.Registration,
                    registrationId: registrations[0].id,
                    amount: 1,
                    price: 25_0000,
                    status: BalanceItemStatus.Due,
                    priceOpen: 25_0000,
                    pricePending: 0,
                },
                {
                    type: BalanceItemType.RegistrationBundleDiscount,
                    registrationId: registrations[0].id,
                    amount: 1,
                    price: -5_0000,
                    status: BalanceItemStatus.Due,
                    priceOpen: -5_0000,
                    pricePending: 0,
                },
                {
                    type: BalanceItemType.Registration,
                    registrationId: registrations[1].id,
                    amount: 1,
                    price: 15_0000,
                    status: BalanceItemStatus.Due,
                    priceOpen: 15_0000,
                    pricePending: 0,
                },
                {
                    type: BalanceItemType.RegistrationBundleDiscount,
                    registrationId: registration3.id,
                    amount: 1,
                    price: -7_0000,
                    status: BalanceItemStatus.Due,
                    priceOpen: 0,
                    pricePending: -7_0000,
                },
                {
                    type: BalanceItemType.Registration,
                    registrationId: registration3.id,
                    amount: 1,
                    price: 35_0000,
                    status: BalanceItemStatus.Due,
                    priceOpen: 0,
                    pricePending: 35_0000,
                },
            ]);
        });

        test('A wrong discount on a previous registration is automatically corrected', async () => {
            const { organizationRegistrationPeriod, organization, member, token, user } = await initData();
            const bundleDiscount = await initBundleDiscount({
                organizationRegistrationPeriod,
                discount: {
                    discounts: [
                        { value: 20_00, type: GroupPriceDiscountType.Percentage },
                        { value: 100_00, type: GroupPriceDiscountType.Percentage },
                    ],
                },
            });

            const groups = [
                await new GroupFactory({
                    organization,
                    price: 25_0000,
                    bundleDiscount,
                }).create(),

                await new GroupFactory({
                    organization,
                    price: 35_0000,
                    bundleDiscount,
                }).create(),
            ];

            // Due to a fictive bug, we have a registration that already has a discount applied
            // The system should auto recover from this automatically by removing it on the next registration
            const registrations = [
                await new RegistrationFactory({
                    organization,
                    member,
                    group: groups[0],
                }).create(),
            ];

            // Create initial balances
            await new BalanceItemFactory({
                userId: user.id,
                memberId: member.id,
                organizationId: organization.id,
                registrationId: registrations[0].id,
                type: BalanceItemType.Registration,
                amount: 1,
                unitPrice: 25_0000,
                status: BalanceItemStatus.Due,
            }).create();

            // Create applied discount
            await new BalanceItemFactory({
                userId: user.id,
                memberId: member.id,
                organizationId: organization.id,
                registrationId: registrations[0].id,
                type: BalanceItemType.RegistrationBundleDiscount,
                amount: 1,
                unitPrice: -15_0000, // not correct, this is what we'll correct
                status: BalanceItemStatus.Due,
                relations: new Map([
                    [
                        BalanceItemRelationType.Discount,
                        BalanceItemRelation.create({
                            // We need the ID of the discount saved here
                            id: bundleDiscount.id,
                            name: bundleDiscount.name,
                        }),
                    ],
                ]),
            }).create();

            // Register for group 2
            const checkout = IDRegisterCheckout.create({
                cart: IDRegisterCart.create({
                    items: [
                        IDRegisterItem.create({
                            options: [],
                            groupPrice: groups[1].settings.prices[0],
                            groupId: groups[1].id,
                            organizationId: organization.id,
                            memberId: member.id,
                        }),
                    ],
                }),
                administrationFee: 0,
                freeContribution: 0,
                paymentMethod: PaymentMethod.PointOfSale,
                totalPrice: 35_0000 - 7_0000 + 15_0000, // - normal discount + wrong discount
            });
            const response = await post(checkout, organization, token);
            const registration2 = response.body.registrations[0];

            expect(registration2).toMatchObject({
                registeredAt: expect.any(Date),
                discounts: new Map([
                    [bundleDiscount.id, AppliedRegistrationDiscount.create({
                        name: bundleDiscount.name,
                        amount: 7_0000,
                    })],
                ]),
            });

            // Check registration 1 has removed the wrong discount
            await registrations[0].refresh();
            expect(registrations[0].discounts).toMatchMap(new Map());

            // Check balances as expected
            await assertBalances({ user }, [
                {
                    type: BalanceItemType.Registration,
                    registrationId: registrations[0].id,
                    amount: 1,
                    price: 25_0000,
                    status: BalanceItemStatus.Due,
                    priceOpen: 25_0000,
                    pricePending: 0,
                },
                {
                    type: BalanceItemType.RegistrationBundleDiscount,
                    registrationId: registrations[0].id,
                    amount: 1,
                    price: -15_0000,
                    status: BalanceItemStatus.Due,
                    priceOpen: -15_0000,
                    pricePending: 0,
                },
                {
                    type: BalanceItemType.RegistrationBundleDiscount,
                    registrationId: registration2.id,
                    amount: 1,
                    price: -7_0000,
                    status: BalanceItemStatus.Due,
                    priceOpen: 0,
                    pricePending: -7_0000,
                },
                {
                    type: BalanceItemType.Registration,
                    registrationId: registration2.id,
                    amount: 1,
                    price: 35_0000,
                    status: BalanceItemStatus.Due,
                    priceOpen: 0,
                    pricePending: 35_0000,
                },
                // Corrected discount:
                {
                    type: BalanceItemType.RegistrationBundleDiscount,
                    registrationId: registrations[0].id,
                    amount: 1,
                    price: 15_0000,
                    status: BalanceItemStatus.Due,
                    priceOpen: 0,
                    pricePending: 15_0000,
                },
            ]);
        });

        test('New registrations do not autocorrect if they are not eligible for the discount', async () => {
            const { organizationRegistrationPeriod, organization, member, token, user } = await initData();
            const bundleDiscount = await initBundleDiscount({
                organizationRegistrationPeriod,
                discount: {
                    discounts: [
                        { value: 20_00, type: GroupPriceDiscountType.Percentage },
                        { value: 100_00, type: GroupPriceDiscountType.Percentage },
                    ],
                },
            });

            const groups = [
                await new GroupFactory({
                    organization,
                    price: 25_0000,
                    bundleDiscount,
                }).create(),

                await new GroupFactory({
                    organization,
                    price: 35_0000,
                }).create(),
            ];

            // Due to a fictive bug, we have a registration that already has a discount applied
            // The system should auto recover from this automatically by removing it on the next registration
            const registrations = [
                await new RegistrationFactory({
                    organization,
                    member,
                    group: groups[0],
                }).create(),
            ];

            // Create initial balances
            await new BalanceItemFactory({
                userId: user.id,
                memberId: member.id,
                organizationId: organization.id,
                registrationId: registrations[0].id,
                type: BalanceItemType.Registration,
                amount: 1,
                unitPrice: 25_0000,
                status: BalanceItemStatus.Due,
            }).create();

            // Create applied discount
            await new BalanceItemFactory({
                userId: user.id,
                memberId: member.id,
                organizationId: organization.id,
                registrationId: registrations[0].id,
                type: BalanceItemType.RegistrationBundleDiscount,
                amount: 1,
                unitPrice: -15_0000, // not correct, this is what we'll correct
                status: BalanceItemStatus.Due,
                relations: new Map([
                    [
                        BalanceItemRelationType.Discount,
                        BalanceItemRelation.create({
                            // We need the ID of the discount saved here
                            id: bundleDiscount.id,
                            name: bundleDiscount.name,
                        }),
                    ],
                ]),
            }).create();

            // Register for group 2
            const checkout = IDRegisterCheckout.create({
                cart: IDRegisterCart.create({
                    items: [
                        IDRegisterItem.create({
                            options: [],
                            groupPrice: groups[1].settings.prices[0],
                            groupId: groups[1].id,
                            organizationId: organization.id,
                            memberId: member.id,
                        }),
                    ],
                }),
                administrationFee: 0,
                freeContribution: 0,
                paymentMethod: PaymentMethod.PointOfSale,
                totalPrice: 35_0000,
            });
            const response = await post(checkout, organization, token);
            const registration2 = response.body.registrations[0];

            expect(registration2).toMatchObject({
                registeredAt: expect.any(Date),
                discounts: new Map([]),
            });

            // Check registration 1 has NOT removed the wrong discount
            await registrations[0].refresh();
            expect(registrations[0].discounts).toMatchMap(new Map([
                [bundleDiscount.id, AppliedRegistrationDiscount.create({
                    name: bundleDiscount.name,
                    amount: 15_0000,
                })],
            ]));

            // Check balances as expected
            await assertBalances({ user }, [
                {
                    type: BalanceItemType.Registration,
                    registrationId: registrations[0].id,
                    amount: 1,
                    price: 25_0000,
                    status: BalanceItemStatus.Due,
                    priceOpen: 25_0000,
                    pricePending: 0,
                },
                {
                    type: BalanceItemType.RegistrationBundleDiscount,
                    registrationId: registrations[0].id,
                    amount: 1,
                    price: -15_0000,
                    status: BalanceItemStatus.Due,
                    priceOpen: -15_0000,
                    pricePending: 0,
                },
                {
                    type: BalanceItemType.Registration,
                    registrationId: registration2.id,
                    amount: 1,
                    price: 35_0000,
                    status: BalanceItemStatus.Due,
                    priceOpen: 0,
                    pricePending: 35_0000,
                },
            ]);
        });

        test('PointOfSale: A bundle discount is applied when registering for two groups at once', async () => {
            const { organizationRegistrationPeriod, organization, member, token, user } = await initData();
            const bundleDiscount = await initBundleDiscount({
                organizationRegistrationPeriod,
                discount: {
                    discounts: [
                        { value: 20_00, type: GroupPriceDiscountType.Percentage },
                    ],
                },
            });

            const groups = [
                await new GroupFactory({
                    organization,
                    price: 25_0000,
                    bundleDiscount,
                }).create(),
                await new GroupFactory({
                    organization,
                    price: 15_0000,
                    bundleDiscount,
                }).create(),
            ];

            // First register the member for group 1 & 2
            const checkout = IDRegisterCheckout.create({
                cart: IDRegisterCart.create({
                    items: [
                        IDRegisterItem.create({
                            options: [],
                            groupPrice: groups[0].settings.prices[0],
                            groupId: groups[0].id,
                            organizationId: organization.id,
                            memberId: member.id,
                        }),
                        IDRegisterItem.create({
                            options: [],
                            groupPrice: groups[1].settings.prices[0],
                            groupId: groups[1].id,
                            organizationId: organization.id,
                            memberId: member.id,
                        }),
                    ],
                }),
                administrationFee: 0,
                freeContribution: 0,
                paymentMethod: PaymentMethod.PointOfSale,
                totalPrice: 25_0000 + 15_0000 - 5_0000, // 20% discount on highest price (25_00 * 0.2 = 5_00)
            });

            const response1 = await post(checkout, organization, token);
            expect(response1.body.registrations.length).toBe(2);

            expect(response1.body.registrations).toIncludeAllMembers([
                expect.objectContaining({
                    registeredAt: expect.any(Date),
                    groupId: groups[0].id,
                    discounts: new Map([
                        [bundleDiscount.id, AppliedRegistrationDiscount.create({
                            name: bundleDiscount.name,
                            amount: 5_0000,
                        })],
                    ]),
                }),
                expect.objectContaining({
                    registeredAt: expect.any(Date),
                    groupId: groups[1].id,
                    discounts: new Map(),
                }),
            ]);

            await assertBalances({ user }, [
                {
                    type: BalanceItemType.Registration,
                    registrationId: expect.any(String),
                    amount: 1,
                    price: 25_0000,
                    status: BalanceItemStatus.Due,
                    priceOpen: 0,
                    pricePending: 25_0000,
                },
                {
                    type: BalanceItemType.RegistrationBundleDiscount,
                    registrationId: expect.any(String),
                    amount: 1,
                    price: -5_0000,
                    status: BalanceItemStatus.Due,
                    priceOpen: 0,
                    pricePending: -5_0000,
                },
                {
                    type: BalanceItemType.Registration,
                    registrationId: expect.any(String),
                    amount: 1,
                    price: 15_0000,
                    status: BalanceItemStatus.Due,
                    priceOpen: 0,
                    pricePending: 15_0000,
                },
            ]);
        });

        test('Apply a discount on a previous registration with online payment (2 tries)', async () => {
            const { organizationRegistrationPeriod, organization, member, token, user } = await initData();
            const { stripeMocker } = await initStripe({ organization });

            const bundleDiscount = await initBundleDiscount({
                organizationRegistrationPeriod,
                discount: {
                    discounts: [
                        { value: 20_00, type: GroupPriceDiscountType.Percentage },
                    ],
                },
            });

            const group = await new GroupFactory({
                organization,
                price: 25_0000,
                stock: 500,
                bundleDiscount,
            })
                .create();
            const groupPrice = group.settings.prices[0];

            const group2 = await new GroupFactory({
                organization,
                price: 15_0000, // Lower price so discount is applied preferably on the first group
                bundleDiscount,
            }).create();

            const groupPrice2 = group2.settings.prices[0];

            // First register the member for group 1. No discount should be applied yet
            const checkout1 = IDRegisterCheckout.create({
                cart: IDRegisterCart.create({
                    items: [
                        IDRegisterItem.create({
                            options: [],
                            groupPrice,
                            groupId: group.id,
                            organizationId: organization.id,
                            memberId: member.id,
                        }),
                    ],
                }),
                administrationFee: 0,
                freeContribution: 0,
                paymentMethod: PaymentMethod.Bancontact,
                totalPrice: groupPrice.price.price,
                redirectUrl: new URL('https://www.example.com/success'),
                cancelUrl: new URL('https://www.example.com/cancel'),
            });

            const response1 = await post(checkout1, organization, token);
            expect(response1.body.registrations.length).toBe(1);
            const registration1 = response1.body.registrations[0];
            expect(registration1.registeredAt).toBeNull();
            expect(registration1.discounts).toMatchMap(new Map());

            // Check state of balances
            await assertBalances({ user }, [
                {
                    type: BalanceItemType.Registration,
                    registrationId: registration1.id,
                    amount: 1,
                    unitPrice: 25_0000,
                    status: BalanceItemStatus.Hidden,
                    priceOpen: -25_0000, // hidden, so no payment expected yet
                    pricePending: 25_0000,
                    pricePaid: 0,
                },
            ]);

            await stripeMocker.succeedPayment(stripeMocker.getLastIntent());

            // Check registration became valid
            const updatedRegistration1 = (await Registration.getByID(registration1.id))!;
            expect(updatedRegistration1).toBeDefined();
            expect(updatedRegistration1.registeredAt).not.toBeNull();

            // Check state of balances
            const expectedBalances: Partial<BalanceItem>[] = [
                {
                    type: BalanceItemType.Registration,
                    registrationId: registration1.id,
                    amount: 1,
                    unitPrice: 25_0000,
                    status: BalanceItemStatus.Due,
                    priceOpen: 0,
                    pricePaid: 25_0000,
                    pricePending: 0,
                    paidAt: expect.any(Date),
                },
            ];

            await assertBalances({ user }, expectedBalances);

            const checkout2 = IDRegisterCheckout.create({
                cart: IDRegisterCart.create({
                    items: [
                        IDRegisterItem.create({
                            options: [],
                            groupPrice: groupPrice2,
                            groupId: group2.id,
                            organizationId: organization.id,
                            memberId: member.id,
                        }),
                    ],
                }),
                administrationFee: 0,
                freeContribution: 0,
                paymentMethod: PaymentMethod.Bancontact,
                totalPrice: 15_0000 - 5_0000, // 20% discount on first group
                redirectUrl: new URL('https://www.example.com/success'),
                cancelUrl: new URL('https://www.example.com/cancel'),
            });
            const response2 = await post(checkout2, organization, token);
            expect(response2.body.registrations.length).toBe(1);

            const registration2 = response2.body.registrations[0];
            expect(registration2.registeredAt).toBeNull(); // not yet valid
            expect(registration2.discounts).toMatchMap(new Map());

            // Get registration 1 again, it should not yet have any bundle discount applied
            await updatedRegistration1.refresh();
            expect(updatedRegistration1.discounts).toMatchMap(new Map());

            // Check state of balances
            await assertBalances({ user }, [
                ...expectedBalances,
                {
                    type: BalanceItemType.Registration,
                    registrationId: registration2.id,
                    amount: 1,
                    unitPrice: 15_0000,
                    status: BalanceItemStatus.Hidden, // Pending
                    priceOpen: -15_0000, // hidden, so no payment expected yet
                    pricePending: 15_0000,
                    pricePaid: 0,
                },
                {
                    type: BalanceItemType.RegistrationBundleDiscount,
                    registrationId: registration1.id,
                    amount: 1,
                    unitPrice: -5_0000,
                    status: BalanceItemStatus.Hidden, // Pending
                    priceOpen: 5_0000,
                    pricePending: -5_0000,
                    pricePaid: 0,
                },
            ]);

            // Fail the payment...
            await stripeMocker.failPayment(stripeMocker.getLastIntent());

            // Only price pending and open has changed now
            expectedBalances.push(
                {
                    type: BalanceItemType.Registration,
                    registrationId: registration2.id,
                    amount: 1,
                    unitPrice: 15_0000,
                    status: BalanceItemStatus.Hidden,
                    priceOpen: 0,
                    pricePending: 0,
                    pricePaid: 0,
                    paidAt: null,
                },
                {
                    type: BalanceItemType.RegistrationBundleDiscount,
                    registrationId: registration1.id,
                    amount: 1,
                    unitPrice: -5_0000,
                    status: BalanceItemStatus.Hidden,
                    priceOpen: 0,
                    pricePending: 0,
                    pricePaid: 0,
                    paidAt: null,
                },
            );

            await assertBalances({ user }, expectedBalances);

            // Try the payment again
            const response3 = await post(checkout2, organization, token);
            expect(response3.body.registrations.length).toBe(1);

            const registration3 = response3.body.registrations[0];
            expect(registration3.id).not.toEqual(registration2.id);
            expect(registration3.registeredAt).toBeNull(); // not yet valid
            expect(registration3.discounts).toMatchMap(new Map());

            // Get registration 1 again, it should not yet have any bundle discount applied
            await updatedRegistration1.refresh();
            expect(updatedRegistration1.discounts).toMatchMap(new Map());

            await assertBalances({ user }, [
                ...expectedBalances,
                {
                    type: BalanceItemType.Registration,
                    registrationId: registration3.id,
                    amount: 1,
                    unitPrice: 15_0000,
                    status: BalanceItemStatus.Hidden, // Pending
                    priceOpen: -15_0000, // hidden, so no payment expected yet
                    pricePending: 15_0000,
                    pricePaid: 0,
                    paidAt: null,
                },
                {
                    type: BalanceItemType.RegistrationBundleDiscount,
                    registrationId: registration1.id,
                    amount: 1,
                    unitPrice: -5_0000,
                    status: BalanceItemStatus.Hidden, // Pending
                    priceOpen: 5_0000,
                    pricePending: -5_0000,
                    pricePaid: 0,
                    paidAt: null,
                },
            ]);

            // Success the payment
            await stripeMocker.succeedPayment(stripeMocker.getLastIntent());
            await BalanceItemService.flushCaches(organization.id);

            // Check registration 3 became valid
            const updatedRegistration3 = (await Registration.getByID(registration3.id))!;
            expect(updatedRegistration3).toBeDefined();
            expect(updatedRegistration3.registeredAt).not.toBeNull();

            // Check registration 1 now has the discounts saved
            await updatedRegistration1.refresh();
            expect(updatedRegistration1.discounts).toMatchMap(new Map([
                [bundleDiscount.id, AppliedRegistrationDiscount.create({
                    name: bundleDiscount.name,
                    amount: 5_0000,
                })],
            ]));

            // Only price pending and open has changed now
            expectedBalances.push(
                {
                    type: BalanceItemType.Registration,
                    registrationId: registration3.id,
                    amount: 1,
                    unitPrice: 15_0000,
                    status: BalanceItemStatus.Due,
                    priceOpen: 0,
                    pricePending: 0,
                    pricePaid: 15_0000,
                    paidAt: expect.any(Date),
                },
                {
                    type: BalanceItemType.RegistrationBundleDiscount,
                    registrationId: registration1.id,
                    amount: 1,
                    unitPrice: -5_0000,
                    status: BalanceItemStatus.Due,
                    priceOpen: 0,
                    pricePending: 0,
                    pricePaid: -5_0000,
                    paidAt: expect.any(Date),
                },
            );

            await assertBalances({ user }, expectedBalances);
        });

        test('Multiple discounts can be applied to a single registration', async () => {
            const { organizationRegistrationPeriod, organization, member, token, user } = await initData();

            const bundleDiscounts = [
                await initBundleDiscount({
                    organizationRegistrationPeriod,
                    discount: {
                        discounts: [
                            { value: 20_00, type: GroupPriceDiscountType.Percentage },
                            { value: 40_00, type: GroupPriceDiscountType.Percentage },
                        ],
                    },
                }),
                await initBundleDiscount({
                    organizationRegistrationPeriod,
                    discount: {
                        discounts: [
                            { value: 5000, type: GroupPriceDiscountType.Fixed },
                            { value: 5_0000, type: GroupPriceDiscountType.Fixed },
                        ],
                    },
                }),
            ];

            const groups = [
                await new GroupFactory({
                    organization,
                    price: 35_0000,
                    bundleDiscounts,
                }).create(),
                await new GroupFactory({
                    organization,
                    price: 25_0000,
                    bundleDiscounts,
                }).create(),
                await new GroupFactory({
                    organization,
                    price: 45_0000,
                    bundleDiscounts,
                }).create(),
            ];

            // Create existing registration for group 1
            const registration1 = await new RegistrationFactory({
                organization,
                member,
                group: groups[0],
            }).create();

            // Create balance item for existing registration
            await new BalanceItemFactory({
                userId: user.id,
                memberId: member.id,
                organizationId: organization.id,
                registrationId: registration1.id,
                type: BalanceItemType.Registration,
                amount: 1,
                unitPrice: 35_0000,
                status: BalanceItemStatus.Due,
            }).create();

            // Now register the member for group 2 & 3 at the same time
            const checkout = IDRegisterCheckout.create({
                cart: IDRegisterCart.create({
                    items: [
                        IDRegisterItem.create({
                            groupPrice: groups[1].settings.prices[0],
                            groupId: groups[1].id,
                            organizationId: organization.id,
                            memberId: member.id,
                        }),
                        IDRegisterItem.create({
                            groupPrice: groups[2].settings.prices[0],
                            groupId: groups[2].id,
                            organizationId: organization.id,
                            memberId: member.id,
                        }),
                    ],
                }),
                paymentMethod: PaymentMethod.PointOfSale,
                totalPrice: 25_0000 + 45_0000 - 7_0000 - 18_0000 - 5000 - 5_0000,
            });
            const response = await post(checkout, organization, token);
            expect(response.body.registrations.length).toBe(2);
            const registration2 = response.body.registrations.find(r => r.groupId === groups[1].id)!;
            const registration3 = response.body.registrations.find(r => r.groupId === groups[2].id)!;

            expect(registration2).toMatchObject({
                registeredAt: expect.any(Date),
                discounts: new Map([
                    [
                        bundleDiscounts[1].id,
                        AppliedRegistrationDiscount.create({
                            name: bundleDiscounts[1].name,
                            amount: 5000,
                        }),
                    ],
                ]),
            });

            expect(registration3).toMatchObject({
                registeredAt: expect.any(Date),
                discounts: new Map([
                    [
                        bundleDiscounts[0].id,
                        AppliedRegistrationDiscount.create({
                            name: bundleDiscounts[0].name,
                            amount: 18_0000,
                        }),
                    ],
                    [
                        bundleDiscounts[1].id,
                        AppliedRegistrationDiscount.create({
                            name: bundleDiscounts[1].name,
                            amount: 5_0000,
                        }),
                    ],
                ]),
            });

            await assertBalances({ user }, [
                {
                    type: BalanceItemType.Registration,
                    registrationId: registration1.id,
                    amount: 1,
                    unitPrice: 35_0000,
                    status: BalanceItemStatus.Due,
                    priceOpen: 35_0000,
                    pricePending: 0,
                },
                {
                    type: BalanceItemType.Registration,
                    registrationId: registration2.id,
                    amount: 1,
                    unitPrice: 25_0000,
                    status: BalanceItemStatus.Due,
                    priceOpen: 0,
                    pricePending: 25_0000,
                },
                {
                    type: BalanceItemType.Registration,
                    registrationId: registration3.id,
                    amount: 1,
                    unitPrice: 45_0000,
                    status: BalanceItemStatus.Due,
                    priceOpen: 0,
                    pricePending: 45_0000,
                },

                // Discounts (4)
                {
                    type: BalanceItemType.RegistrationBundleDiscount,
                    registrationId: registration2.id,
                    amount: 1,
                    unitPrice: -5000,
                    status: BalanceItemStatus.Due,
                    priceOpen: 0,
                    pricePending: -5000,
                },
                {
                    type: BalanceItemType.RegistrationBundleDiscount,
                    registrationId: registration3.id,
                    amount: 1,
                    unitPrice: -18_0000,
                    status: BalanceItemStatus.Due,
                    priceOpen: 0,
                    pricePending: -18_0000,
                },
                {
                    type: BalanceItemType.RegistrationBundleDiscount,
                    registrationId: registration3.id,
                    amount: 1,
                    unitPrice: -5_0000,
                    status: BalanceItemStatus.Due,
                    priceOpen: 0,
                    pricePending: -5_0000,
                },
                {
                    type: BalanceItemType.RegistrationBundleDiscount,
                    registrationId: registration1.id,
                    amount: 1,
                    unitPrice: -7_0000,
                    status: BalanceItemStatus.Due,
                    priceOpen: 0,
                    pricePending: -7_0000,
                },
            ]);
        });

        // We run this test 5 times because it should be stable
        test.each([1, 2, 3, 4, 5])('If discounts are the same, they are not moved around after new registrations are added (%i th try)', async () => {
            const { organizationRegistrationPeriod, organization, member, token, user } = await initData();
            const bundleDiscount = await initBundleDiscount({
                organizationRegistrationPeriod,
                discount: {
                    discounts: [
                        { value: 20_00, type: GroupPriceDiscountType.Percentage },
                        { value: 20_00, type: GroupPriceDiscountType.Percentage },
                        { value: 20_00, type: GroupPriceDiscountType.Percentage },
                    ],
                },
            });

            const groups = [
                await new GroupFactory({
                    organization,
                    price: 25_0000, // 20% discount = 5_00
                    bundleDiscount,
                }).create(),
                await new GroupFactory({
                    organization,
                    price: 25_0000, // 20% discount = 5_00 (same as group 1)
                    bundleDiscount,
                }).create(),
                await new GroupFactory({
                    organization,
                    price: 25_0000, // 20% discount = 5_00 (same as groups 1 & 2)
                    bundleDiscount,
                }).create(),
            ];

            // Create existing registrations for group 1 & 2 with discounts already applied
            const registration1 = await new RegistrationFactory({
                organization,
                member,
                group: groups[0],
            }).create();

            const registration2 = await new RegistrationFactory({
                organization,
                member,
                group: groups[1],
            }).create();

            // Create balance items for existing registrations
            await new BalanceItemFactory({
                userId: user.id,
                memberId: member.id,
                organizationId: organization.id,
                registrationId: registration1.id,
                type: BalanceItemType.Registration,
                amount: 1,
                unitPrice: 25_0000,
                status: BalanceItemStatus.Due,
            }).create();

            await new BalanceItemFactory({
                userId: user.id,
                memberId: member.id,
                organizationId: organization.id,
                registrationId: registration1.id,
                type: BalanceItemType.RegistrationBundleDiscount,
                amount: 1,
                unitPrice: -5_0000,
                status: BalanceItemStatus.Due,
                relations: new Map([
                    [
                        BalanceItemRelationType.Discount,
                        BalanceItemRelation.create({
                            id: bundleDiscount.id,
                            name: bundleDiscount.name,
                        }),
                    ],
                ]),
            }).create();

            await new BalanceItemFactory({
                userId: user.id,
                memberId: member.id,
                organizationId: organization.id,
                registrationId: registration2.id,
                type: BalanceItemType.Registration,
                amount: 1,
                unitPrice: 25_0000,
                status: BalanceItemStatus.Due,
            }).create();

            // No discount on 2 ( = first)

            await BalanceItemService.flushCaches(organization.id);
            await registration1.refresh();
            await registration2.refresh();

            // Check this is what we expect
            expect(registration2.discounts).toMatchMap(new Map([]));
            expect(registration1.discounts).toMatchMap(new Map([
                [bundleDiscount.id, AppliedRegistrationDiscount.create({
                    name: bundleDiscount.name,
                    amount: 5_0000,
                })],
            ]));

            // Now register the member for group 3
            const checkout = IDRegisterCheckout.create({
                cart: IDRegisterCart.create({
                    items: [
                        IDRegisterItem.create({
                            groupPrice: groups[2].settings.prices[0],
                            groupId: groups[2].id,
                            organizationId: organization.id,
                            memberId: member.id,
                        }),
                    ],
                }),
                paymentMethod: PaymentMethod.PointOfSale,
                totalPrice: 25_0000 - 5_0000, // 20% discount on new registration
            });

            const response = await post(checkout, organization, token);
            expect(response.body.registrations.length).toBe(1);
            const registration3 = response.body.registrations[0];

            expect(registration3).toMatchObject({
                registeredAt: expect.any(Date),
                discounts: new Map([
                    [bundleDiscount.id, AppliedRegistrationDiscount.create({
                        name: bundleDiscount.name,
                        amount: 5_0000,
                    })],
                ]),
            });

            // Verify that existing registrations still have their original discounts
            await registration1.refresh();
            await registration2.refresh();

            expect(registration2.discounts).toMatchMap(new Map([]));
            expect(registration1.discounts).toMatchMap(new Map([
                [bundleDiscount.id, AppliedRegistrationDiscount.create({
                    name: bundleDiscount.name,
                    amount: 5_0000,
                })],
            ]));

            await assertBalances({ user }, [
                {
                    type: BalanceItemType.Registration,
                    registrationId: registration1.id,
                    amount: 1,
                    price: 25_0000,
                    status: BalanceItemStatus.Due,
                    priceOpen: 25_0000,
                    pricePending: 0,
                },
                {
                    type: BalanceItemType.RegistrationBundleDiscount,
                    registrationId: registration1.id,
                    amount: 1,
                    price: -5_0000,
                    status: BalanceItemStatus.Due,
                    priceOpen: -5_0000,
                    pricePending: 0,
                },
                {
                    type: BalanceItemType.Registration,
                    registrationId: registration2.id,
                    amount: 1,
                    price: 25_0000,
                    status: BalanceItemStatus.Due,
                    priceOpen: 25_0000,
                    pricePending: 0,
                },
                {
                    type: BalanceItemType.Registration,
                    registrationId: registration3.id,
                    amount: 1,
                    price: 25_0000,
                    status: BalanceItemStatus.Due,
                    priceOpen: 0,
                    pricePending: 25_0000,
                },
                {
                    type: BalanceItemType.RegistrationBundleDiscount,
                    registrationId: registration3.id,
                    amount: 1,
                    price: -5_0000,
                    status: BalanceItemStatus.Due,
                    priceOpen: 0,
                    pricePending: -5_0000,
                },
            ]);
        });

        test('Wrong discounts are not corrected for unrelated registrations', async () => {
            const { organizationRegistrationPeriod, organization, member, token, user } = await initData();
            const bundleDiscount = await initBundleDiscount({
                organizationRegistrationPeriod,
                discount: {
                    discounts: [
                        { value: 20_00, type: GroupPriceDiscountType.Percentage },
                    ],
                },
            });

            const groups = [
                await new GroupFactory({
                    organization,
                    price: 25_0000, // 20% discount = 5_00
                    bundleDiscount,
                }).create(),

                // Does not have discount:
                await new GroupFactory({
                    organization,
                    price: 25_0000,
                }).create(),
            ];

            // Create existing registrations for group 1
            const registration1 = await new RegistrationFactory({
                organization,
                member,
                group: groups[0],
            }).create();

            // Create balance items for existing registrations
            await new BalanceItemFactory({
                userId: user.id,
                memberId: member.id,
                organizationId: organization.id,
                registrationId: registration1.id,
                type: BalanceItemType.Registration,
                amount: 1,
                unitPrice: 25_0000,
                status: BalanceItemStatus.Due,
            }).create();

            // This registration should not have a discount applied
            // but for some reason it has
            // (e.g the discount was altered in some way)
            // we test that we won't touch this discount
            await new BalanceItemFactory({
                userId: user.id,
                memberId: member.id,
                organizationId: organization.id,
                registrationId: registration1.id,
                type: BalanceItemType.RegistrationBundleDiscount,
                amount: 1,
                unitPrice: -5_0000,
                status: BalanceItemStatus.Due,
                relations: new Map([
                    [
                        BalanceItemRelationType.Discount,
                        BalanceItemRelation.create({
                            id: bundleDiscount.id,
                            name: bundleDiscount.name,
                        }),
                    ],
                ]),
            }).create();

            // No discount on 2 ( = first)

            await BalanceItemService.flushCaches(organization.id);
            await registration1.refresh();

            // Check this is what we expect
            expect(registration1.discounts).toMatchMap(new Map([
                [bundleDiscount.id, AppliedRegistrationDiscount.create({
                    name: bundleDiscount.name,
                    amount: 5_0000,
                })],
            ]));

            // Now register the member for group 2
            const checkout = IDRegisterCheckout.create({
                cart: IDRegisterCart.create({
                    items: [
                        IDRegisterItem.create({
                            groupPrice: groups[1].settings.prices[0],
                            groupId: groups[1].id,
                            organizationId: organization.id,
                            memberId: member.id,
                        }),
                    ],
                }),
                paymentMethod: PaymentMethod.PointOfSale,
                totalPrice: 25_0000,
            });

            const response = await post(checkout, organization, token);
            expect(response.body.registrations.length).toBe(1);
            const registration2 = response.body.registrations[0];

            expect(registration2).toMatchObject({
                registeredAt: expect.any(Date),
                discounts: new Map([]),
            });

            // Verify that existing registrations still have their original discounts
            await registration1.refresh();
            expect(registration1.discounts).toMatchMap(new Map([
                [bundleDiscount.id, AppliedRegistrationDiscount.create({
                    name: bundleDiscount.name,
                    amount: 5_0000,
                })],
            ]));

            await assertBalances({ user }, [
                {
                    type: BalanceItemType.Registration,
                    registrationId: registration1.id,
                    amount: 1,
                    price: 25_0000,
                    status: BalanceItemStatus.Due,
                    priceOpen: 25_0000,
                    pricePending: 0,
                },
                {
                    type: BalanceItemType.RegistrationBundleDiscount,
                    registrationId: registration1.id,
                    amount: 1,
                    price: -5_0000,
                    status: BalanceItemStatus.Due,
                    priceOpen: -5_0000,
                    pricePending: 0,
                },
                {
                    type: BalanceItemType.Registration,
                    registrationId: registration2.id,
                    amount: 1,
                    price: 25_0000,
                    status: BalanceItemStatus.Due,
                    priceOpen: 0,
                    pricePending: 25_0000,
                },
            ]);
        });

        // We run this test 5 times because it should be stable
        test.each([1, 2, 3, 4, 5])('If discounts are the same, they are preferrably added to the new registration, not the existing registrations (%i th try)', async () => {
            const { organizationRegistrationPeriod, organization, member, token, user } = await initData();
            const bundleDiscount = await initBundleDiscount({
                organizationRegistrationPeriod,
                discount: {
                    discounts: [
                        { value: 20_00, type: GroupPriceDiscountType.Percentage },
                    ],
                },
            });

            const groups = [
                await new GroupFactory({
                    organization,
                    price: 25_0000, // 20% discount = 5_00
                    bundleDiscount,
                }).create(),
                await new GroupFactory({
                    organization,
                    price: 25_0000, // 20% discount = 5_00 (same as group 1)
                    bundleDiscount,
                }).create(),
            ];

            // Create existing registrations for group 1
            const registration1 = await new RegistrationFactory({
                organization,
                member,
                group: groups[0],
            }).create();

            // Create balance items for existing registrations
            await new BalanceItemFactory({
                userId: user.id,
                memberId: member.id,
                organizationId: organization.id,
                registrationId: registration1.id,
                type: BalanceItemType.Registration,
                amount: 1,
                unitPrice: 25_0000,
                status: BalanceItemStatus.Due,
            }).create();

            // No discount on 2 ( = first)
            await BalanceItemService.flushCaches(organization.id);
            await registration1.refresh();

            // Check this is what we expect
            expect(registration1.discounts).toMatchMap(new Map([]));

            // Now register the member for group 3
            const checkout = IDRegisterCheckout.create({
                cart: IDRegisterCart.create({
                    items: [
                        IDRegisterItem.create({
                            groupPrice: groups[1].settings.prices[0],
                            groupId: groups[1].id,
                            organizationId: organization.id,
                            memberId: member.id,
                        }),
                    ],
                }),
                paymentMethod: PaymentMethod.PointOfSale,
                totalPrice: 25_0000 - 5_0000, // 20% discount on new registration
            });

            const response = await post(checkout, organization, token);
            expect(response.body.registrations.length).toBe(1);
            const registration2 = response.body.registrations[0];

            expect(registration2).toMatchObject({
                registeredAt: expect.any(Date),
                discounts: new Map([
                    [bundleDiscount.id, AppliedRegistrationDiscount.create({
                        name: bundleDiscount.name,
                        amount: 5_0000,
                    })],
                ]),
            });

            // Verify that existing registrations still have their original discounts
            await registration1.refresh();
            expect(registration1.discounts).toMatchMap(new Map([]));

            await assertBalances({ user }, [
                {
                    type: BalanceItemType.Registration,
                    registrationId: registration1.id,
                    amount: 1,
                    price: 25_0000,
                    status: BalanceItemStatus.Due,
                    priceOpen: 25_0000,
                    pricePending: 0,
                },
                {
                    type: BalanceItemType.Registration,
                    registrationId: registration2.id,
                    amount: 1,
                    price: 25_0000,
                    status: BalanceItemStatus.Due,
                    priceOpen: 0,
                    pricePending: 25_0000,
                },
                {
                    type: BalanceItemType.RegistrationBundleDiscount,
                    registrationId: registration2.id,
                    amount: 1,
                    price: -5_0000,
                    status: BalanceItemStatus.Due,
                    priceOpen: 0,
                    pricePending: -5_0000,
                },
            ]);
        });

        test('Negative prices are not possible for combination of discounts', async () => {
            const { organizationRegistrationPeriod, organization, member, token, user } = await initData();
            const bundleDiscounts = [
                await initBundleDiscount({
                    organizationRegistrationPeriod,
                    discount: {
                        discounts: [
                            { value: 60_00, type: GroupPriceDiscountType.Percentage },
                            { value: 40_00, type: GroupPriceDiscountType.Percentage },
                        ],
                    },
                }),
                await initBundleDiscount({
                    organizationRegistrationPeriod,
                    discount: {
                        discounts: [
                            { value: 60_00, type: GroupPriceDiscountType.Percentage },
                            { value: 40_00, type: GroupPriceDiscountType.Percentage },
                        ],
                    },
                }),
            ];

            const groups = [
                await new GroupFactory({
                    organization,
                    price: 25_0000,
                    bundleDiscounts,
                }).create(),
                await new GroupFactory({
                    organization,
                    price: 35_0000, // Higher price so discount is applied preferably here
                    bundleDiscounts,
                }).create(),
            ];

            // Create existing registration for group 1
            const registration1 = await new RegistrationFactory({
                organization,
                member,
                group: groups[0],
            }).create();

            // Create balance item for existing registration
            await new BalanceItemFactory({
                userId: user.id,
                memberId: member.id,
                organizationId: organization.id,
                registrationId: registration1.id,
                type: BalanceItemType.Registration,
                amount: 1,
                unitPrice: 25_0000,
                status: BalanceItemStatus.Due,
            }).create();

            const checkout = IDRegisterCheckout.create({
                cart: IDRegisterCart.create({
                    items: [
                        IDRegisterItem.create({
                            groupPrice: groups[1].settings.prices[0],
                            groupId: groups[1].id,
                            organizationId: organization.id,
                            memberId: member.id,
                        }),
                    ],
                }),
                paymentMethod: PaymentMethod.PointOfSale,
                totalPrice: 35_0000 - 42_0000, // 120% discount on 35_00
            });
            await expect(post(checkout, organization, token)).rejects
                .toThrow(STExpect.simpleError({
                    code: 'negative_price',
                }));

            // The backend should have thrown the error early enough, so no balances should have been created
            await assertBalances({ user }, [
                {
                    type: BalanceItemType.Registration,
                    registrationId: registration1.id,
                    amount: 1,
                    unitPrice: 25_0000,
                    status: BalanceItemStatus.Due,
                    priceOpen: 25_0000,
                    pricePending: 0,
                },
            ]);
        });

        test('Reduced prices and discounts are used', async () => {
            const { organizationRegistrationPeriod, organization, member, token, user } = await initData();
            member.details.requiresFinancialSupport = BooleanStatus.create({ value: true });
            await member.save();

            const bundleDiscount = await initBundleDiscount({
                organizationRegistrationPeriod,
                discount: {
                    discounts: [
                        {
                            value: 20_00,
                            type: GroupPriceDiscountType.Percentage,
                            reducedValue: 10_00,
                        },
                    ],
                },
            });

            const groups = [
                await new GroupFactory({
                    organization,
                    price: 25_0000,
                    reducedPrice: 20_0000,
                    bundleDiscount,
                }).create(),
                await new GroupFactory({
                    organization,
                    price: 15_0000,
                    reducedPrice: 10_0000,
                    bundleDiscount,
                }).create(),
            ];

            // First register the member for group 1. No discount should be applied yet
            const registration1 = await new RegistrationFactory({
                organization,
                member,
                group: groups[0],
            }).create();

            await new BalanceItemFactory({
                userId: user.id,
                memberId: member.id,
                organizationId: organization.id,
                type: BalanceItemType.Registration,
                amount: 1,
                unitPrice: 20_0000, // Reduced price
                status: BalanceItemStatus.Due,
                registrationId: registration1.id,
            }).create();

            const checkout = IDRegisterCheckout.create({
                cart: IDRegisterCart.create({
                    items: [
                        IDRegisterItem.create({
                            groupPrice: groups[1].settings.prices[0],
                            groupId: groups[1].id,
                            organizationId: organization.id,
                            memberId: member.id,
                        }),
                    ],
                }),
                paymentMethod: PaymentMethod.PointOfSale,
                totalPrice: 10_0000 - 2_0000, // 10% discount on first group
            });

            const response2 = await post(checkout, organization, token);
            expect(response2.body.registrations.length).toBe(1);

            const registration2 = response2.body.registrations[0];
            expect(registration2.registeredAt).not.toBeNull();
            expect(registration2.discounts).toMatchMap(new Map());

            // Get registration 1 again, it should now have the bundle discount applied
            await registration1.refresh();
            expect(registration1.discounts).toMatchMap(new Map([
                [bundleDiscount.id, AppliedRegistrationDiscount.create({
                    name: bundleDiscount.name,
                    amount: 2_0000,
                })],
            ]));

            await assertBalances({ user }, [
                {
                    type: BalanceItemType.Registration,
                    registrationId: registration1.id,
                    amount: 1,
                    price: 20_0000,
                    status: BalanceItemStatus.Due,
                    priceOpen: 20_0000,
                    pricePending: 0,
                },
                {
                    type: BalanceItemType.RegistrationBundleDiscount,
                    registrationId: registration1.id,
                    amount: 1,
                    price: -2_0000,
                    status: BalanceItemStatus.Due,
                    priceOpen: 0,
                    pricePending: -2_0000,
                },
                {
                    type: BalanceItemType.Registration,
                    registrationId: registration2.id,
                    amount: 1,
                    price: 10_0000,
                    status: BalanceItemStatus.Due,
                    priceOpen: 0,
                    pricePending: 10_0000,
                },
            ]);
        });

        test('Custom discounts are used for certain groups', async () => {
            const { organizationRegistrationPeriod, organization, member, token, user } = await initData();
            member.details.requiresFinancialSupport = BooleanStatus.create({ value: true });
            await member.save();

            const bundleDiscount = await initBundleDiscount({
                organizationRegistrationPeriod,
                discount: {
                    discounts: [
                        {
                            value: 20_00,
                            type: GroupPriceDiscountType.Percentage,
                        },
                    ],
                },
            });

            const groups = [
                await new GroupFactory({
                    organization,
                    price: 25_0000,
                    bundleDiscount,
                }).create(),
                await new GroupFactory({
                    organization,
                    price: 15_0000,
                    bundleDiscounts: new Map([
                        [
                            bundleDiscount,
                            [
                                GroupPriceDiscount.create({
                                    value: ReduceablePrice.create({ price: 50_00 }),
                                    type: GroupPriceDiscountType.Percentage,
                                }),
                            ],
                        ],
                    ]),
                }).create(),
            ];

            // First register the member for group 1. No discount should be applied yet
            const registration1 = await new RegistrationFactory({
                organization,
                member,
                group: groups[0],
            }).create();

            await new BalanceItemFactory({
                userId: user.id,
                memberId: member.id,
                organizationId: organization.id,
                type: BalanceItemType.Registration,
                amount: 1,
                unitPrice: 25_0000,
                status: BalanceItemStatus.Due,
                registrationId: registration1.id,
            }).create();

            const checkout = IDRegisterCheckout.create({
                cart: IDRegisterCart.create({
                    items: [
                        IDRegisterItem.create({
                            groupPrice: groups[1].settings.prices[0],
                            groupId: groups[1].id,
                            organizationId: organization.id,
                            memberId: member.id,
                        }),
                    ],
                }),
                paymentMethod: PaymentMethod.PointOfSale,
                totalPrice: 15_0000 - 7_5000, // 50% discount on last group
            });

            const response2 = await post(checkout, organization, token);
            expect(response2.body.registrations.length).toBe(1);

            const registration2 = response2.body.registrations[0];
            expect(registration2.registeredAt).not.toBeNull();
            expect(registration2.discounts).toMatchMap(new Map([
                [bundleDiscount.id, AppliedRegistrationDiscount.create({
                    name: bundleDiscount.name,
                    amount: 7_5000,
                })],
            ]));

            // Get registration 1 again, it should now have the bundle discount applied
            await registration1.refresh();
            expect(registration1.discounts).toMatchMap(new Map());

            await assertBalances({ user }, [
                {
                    type: BalanceItemType.Registration,
                    registrationId: registration1.id,
                    amount: 1,
                    price: 25_0000,
                    status: BalanceItemStatus.Due,
                    priceOpen: 25_0000,
                    pricePending: 0,
                },
                {
                    type: BalanceItemType.RegistrationBundleDiscount,
                    registrationId: registration2.id,
                    amount: 1,
                    price: -7_5000,
                    status: BalanceItemStatus.Due,
                    priceOpen: 0,
                    pricePending: -7_5000,
                },
                {
                    type: BalanceItemType.Registration,
                    registrationId: registration2.id,
                    amount: 1,
                    price: 15_0000,
                    status: BalanceItemStatus.Due,
                    priceOpen: 0,
                    pricePending: 15_0000,
                },
            ]);
        });

        test('Discounts work across family members', async () => {
            const { organizationRegistrationPeriod, organization, member, token, user } = await initData();

            const otherMember = await new MemberFactory({
                organization,
                user,
            }).create();

            const bundleDiscount = await initBundleDiscount({
                organizationRegistrationPeriod,
                discount: {
                    countWholeFamily: true,
                    discounts: [
                        {
                            value: 20_00,
                            type: GroupPriceDiscountType.Percentage,
                        },
                    ],
                },
            });

            const groups = [
                await new GroupFactory({
                    organization,
                    price: 25_0000,
                    bundleDiscount,
                }).create(),
                await new GroupFactory({
                    organization,
                    price: 15_0000,
                    bundleDiscount,
                }).create(),
            ];

            // First register the otherMember for group 1. No discount should be applied yet
            const registration1 = await new RegistrationFactory({
                organization,
                member: otherMember,
                group: groups[0],
            }).create();

            await new BalanceItemFactory({
                userId: user.id,
                memberId: otherMember.id,
                organizationId: organization.id,
                type: BalanceItemType.Registration,
                amount: 1,
                unitPrice: 25_0000,
                status: BalanceItemStatus.Due,
                registrationId: registration1.id,
            }).create();

            const checkout = IDRegisterCheckout.create({
                cart: IDRegisterCart.create({
                    items: [
                        IDRegisterItem.create({
                            groupPrice: groups[1].settings.prices[0],
                            groupId: groups[1].id,
                            organizationId: organization.id,
                            memberId: member.id,
                        }),
                    ],
                }),
                paymentMethod: PaymentMethod.PointOfSale,
                totalPrice: 15_0000 - 5_0000, // 20% discount on first group
            });

            const response2 = await post(checkout, organization, token);
            expect(response2.body.registrations.length).toBe(1);

            const registration2 = response2.body.registrations[0];
            expect(registration2.registeredAt).not.toBeNull();
            expect(registration2.discounts).toMatchMap(new Map());

            // Get registration 1 again, it should now have the bundle discount applied
            await registration1.refresh();
            expect(registration1.discounts).toMatchMap(new Map([
                [bundleDiscount.id, AppliedRegistrationDiscount.create({
                    name: bundleDiscount.name,
                    amount: 5_0000,
                })],
            ]));

            await assertBalances({ user }, [
                {
                    type: BalanceItemType.Registration,
                    registrationId: registration1.id,
                    amount: 1,
                    price: 25_0000,
                    status: BalanceItemStatus.Due,
                    priceOpen: 25_0000,
                    pricePending: 0,
                },
                {
                    type: BalanceItemType.RegistrationBundleDiscount,
                    registrationId: registration1.id,
                    amount: 1,
                    price: -5_0000,
                    status: BalanceItemStatus.Due,
                    priceOpen: 0,
                    pricePending: -5_0000,
                },
                {
                    type: BalanceItemType.Registration,
                    registrationId: registration2.id,
                    amount: 1,
                    price: 15_0000,
                    status: BalanceItemStatus.Due,
                    priceOpen: 0,
                    pricePending: 15_0000,
                },
            ]);
        });

        test('Discounts can be disabled across family members', async () => {
            const { organizationRegistrationPeriod, organization, member, token, user } = await initData();

            const otherMember = await new MemberFactory({
                organization,
                user,
            }).create();

            const bundleDiscount = await initBundleDiscount({
                organizationRegistrationPeriod,
                discount: {
                    countWholeFamily: false,
                    discounts: [
                        {
                            value: 20_00,
                            type: GroupPriceDiscountType.Percentage,
                        },
                    ],
                },
            });

            const groups = [
                await new GroupFactory({
                    organization,
                    price: 25_0000,
                    bundleDiscount,
                }).create(),
                await new GroupFactory({
                    organization,
                    price: 15_0000,
                    bundleDiscount,
                }).create(),
            ];

            // First register the otherMember for group 1. No discount should be applied yet
            const registration1 = await new RegistrationFactory({
                organization,
                member: otherMember,
                group: groups[0],
            }).create();

            await new BalanceItemFactory({
                userId: user.id,
                memberId: otherMember.id,
                organizationId: organization.id,
                type: BalanceItemType.Registration,
                amount: 1,
                unitPrice: 25_0000,
                status: BalanceItemStatus.Due,
                registrationId: registration1.id,
            }).create();

            const checkout = IDRegisterCheckout.create({
                cart: IDRegisterCart.create({
                    items: [
                        IDRegisterItem.create({
                            groupPrice: groups[1].settings.prices[0],
                            groupId: groups[1].id,
                            organizationId: organization.id,
                            memberId: member.id,
                        }),
                    ],
                }),
                paymentMethod: PaymentMethod.PointOfSale,
                totalPrice: 15_0000,
            });

            const response2 = await post(checkout, organization, token);
            expect(response2.body.registrations.length).toBe(1);

            const registration2 = response2.body.registrations[0];
            expect(registration2.registeredAt).not.toBeNull();
            expect(registration2.discounts).toMatchMap(new Map());

            await registration1.refresh();
            expect(registration1.discounts).toMatchMap(new Map());

            await assertBalances({ user }, [
                {
                    type: BalanceItemType.Registration,
                    registrationId: registration1.id,
                    amount: 1,
                    price: 25_0000,
                    status: BalanceItemStatus.Due,
                    priceOpen: 25_0000,
                    pricePending: 0,
                },
                {
                    type: BalanceItemType.Registration,
                    registrationId: registration2.id,
                    amount: 1,
                    price: 15_0000,
                    status: BalanceItemStatus.Due,
                    priceOpen: 0,
                    pricePending: 15_0000,
                },
            ]);
        });
    });

    describe('Changing registrations as admin', () => {
        async function initDataWithRegistrations() {
            const { organizationRegistrationPeriod, organization, member, user } = await initData();

            const bundleDiscount = await initBundleDiscount({
                organizationRegistrationPeriod,
                discount: {
                    discounts: [
                        { value: 20_00, type: GroupPriceDiscountType.Percentage },
                    ],
                },
            });

            const groups = [
                await new GroupFactory({
                    organization,
                    price: 25_0000,
                    bundleDiscount,
                }).create(),
                await new GroupFactory({
                    organization,
                    price: 15_0000,
                    bundleDiscount,
                }).create(),
                await new GroupFactory({
                    organization,
                    price: 40_0000,
                    bundleDiscount,
                }).create(),
            ];

            // First register the member for group 1 & 2
            const registration1 = await new RegistrationFactory({
                organization,
                member,
                group: groups[0],
            }).create();

            const registration2 = await new RegistrationFactory({
                organization,
                member,
                group: groups[1],
            }).create();

            // Create initial balances
            await new BalanceItemFactory({
                memberId: member.id,
                organizationId: organization.id,
                registrationId: registration1.id,
                type: BalanceItemType.Registration,
                amount: 1,
                unitPrice: 25_0000,
                status: BalanceItemStatus.Due,
            }).create();

            // Create applied discount
            await new BalanceItemFactory({
                memberId: member.id,
                organizationId: organization.id,
                registrationId: registration1.id,
                type: BalanceItemType.RegistrationBundleDiscount,
                amount: 1,
                unitPrice: -5_0000,
                status: BalanceItemStatus.Due,
                relations: new Map([
                    [
                        BalanceItemRelationType.Discount,
                        BalanceItemRelation.create({
                            // We need the ID of the discount saved here
                            id: bundleDiscount.id,
                            name: bundleDiscount.name,
                        }),
                    ],
                ]),
            }).create();

            await new BalanceItemFactory({
                memberId: member.id,
                organizationId: organization.id,
                registrationId: registration2.id,
                type: BalanceItemType.Registration,
                amount: 1,
                unitPrice: 15_0000,
                status: BalanceItemStatus.Due,
            }).create();

            await BalanceItemService.flushCaches(organization.id);

            await registration1.refresh();
            expect(registration1).toMatchObject({
                groupId: groups[0].id,
                registeredAt: expect.any(Date),
                discounts: new Map([
                    [bundleDiscount.id, AppliedRegistrationDiscount.create({
                        name: bundleDiscount.name,
                        amount: 5_0000,
                    })],
                ]),
            });

            return {
                organization,
                user,
                groups,
                registration1,
                registration2,
                member,
                bundleDiscount,
            };
        }

        /**
         * If you replace a registration, it is possible that a bundle discount of a different registration is not optimal anymore and
         * a more optimal discount can be applied. In that case, the bundle discount can be moved from the unaltered registration to the newly created registration.
         */
        test('Replacing a registration can move the bundle discount of an unaltered registration', async () => {
            const { organization, bundleDiscount, groups, registration1, registration2, member } = await initDataWithRegistrations();
            const { adminToken } = await initAdmin({ organization });

            // Now replace registration 2 with group 3, which is more expensive and should give more discount
            const checkout = IDRegisterCheckout.create({
                cart: IDRegisterCart.create({
                    items: [
                        IDRegisterItem.create({
                            groupPrice: groups[2].settings.prices[0],
                            groupId: groups[2].id,
                            organizationId: organization.id,
                            memberId: member.id,
                            replaceRegistrationIds: [registration2.id],
                        }),
                    ],
                }),
                asOrganizationId: organization.id,
                totalPrice: 40_0000 - 15_0000 + 5_0000 - 8_0000, // group 3 - group 2 + reverted discount - new discount
            });

            const response = await post(checkout, organization, adminToken);
            expect(response.body.registrations.length).toBe(1);

            const registration3 = response.body.registrations[0];
            expect(registration3).toMatchObject({
                groupId: groups[2].id,
                registeredAt: expect.any(Date),
                discounts: new Map([
                    [bundleDiscount.id, AppliedRegistrationDiscount.create({
                        name: bundleDiscount.name,
                        amount: 8_0000,
                    })],
                ]),
            });

            await registration2.refresh();
            await registration1.refresh();

            // Check discount has been removed in registration 1
            expect(registration2.discounts).toMatchMap(new Map());
            expect(registration1.discounts).toMatchMap(new Map());

            // Check balances: no deletions happened, only additions or status changes
            await assertBalances({ member }, [
                {
                    type: BalanceItemType.Registration,
                    registrationId: registration1.id,
                    amount: 1,
                    unitPrice: 25_0000,
                    status: BalanceItemStatus.Due,
                    priceOpen: 25_0000,
                    pricePending: 0,
                },
                {
                    type: BalanceItemType.RegistrationBundleDiscount,
                    registrationId: registration1.id,
                    amount: 1,
                    unitPrice: -5_0000,
                    status: BalanceItemStatus.Due,
                    pricePending: 0,
                    priceTotal: -5_0000,

                    // Payment reallocation
                    pricePaid: -5_0000,
                    priceOpen: 0,
                },
                {
                    type: BalanceItemType.Registration,
                    registrationId: registration2.id,
                    amount: 1,
                    unitPrice: 15_0000,
                    status: BalanceItemStatus.Canceled,
                    pricePending: 0,
                    priceOpen: 0,
                },
                {
                    type: BalanceItemType.Registration,
                    userId: null,
                    memberId: member.id,
                    registrationId: registration3.id,
                    amount: 1,
                    unitPrice: 40_0000,
                    status: BalanceItemStatus.Due,
                    priceOpen: 40_0000,

                    // Not pending because created by admin
                    pricePending: 0,
                },
                // Revert first discount
                {
                    type: BalanceItemType.RegistrationBundleDiscount,
                    userId: null,
                    memberId: member.id,
                    registrationId: registration1.id,
                    amount: 1,
                    unitPrice: 5_0000,
                    status: BalanceItemStatus.Due,
                    priceTotal: 5_0000,

                    // Not pending because created by admin
                    pricePending: 0,

                    // Payment reallocation
                    pricePaid: 5_0000,
                    priceOpen: 0,
                },
                // Add new discount
                {
                    type: BalanceItemType.RegistrationBundleDiscount,
                    userId: null,
                    memberId: member.id,
                    registrationId: registration3.id,
                    amount: 1,
                    unitPrice: -8_0000,
                    status: BalanceItemStatus.Due,
                    priceOpen: -8_0000,

                    // Not pending because created by admin
                    pricePending: 0,
                },
            ]);
        });

        test('Replacing a registration with discount', async () => {
            const { organization, bundleDiscount, groups, registration1, registration2, member } = await initDataWithRegistrations();
            const { adminToken } = await initAdmin({ organization });

            // Now replace registration 2 with group 3, which is more expensive and should give more discount
            const checkout = IDRegisterCheckout.create({
                cart: IDRegisterCart.create({
                    items: [
                        IDRegisterItem.create({
                            groupPrice: groups[2].settings.prices[0],
                            groupId: groups[2].id,
                            organizationId: organization.id,
                            memberId: member.id,
                            replaceRegistrationIds: [registration1.id],
                        }),
                    ],
                }),
                asOrganizationId: organization.id,
                totalPrice: 40_0000 - 25_0000 + 5_0000 - 8_0000, // group 3 - group 1 + reverted discount - new discount
            });

            const response = await post(checkout, organization, adminToken);
            expect(response.body.registrations.length).toBe(1);

            const registration3 = response.body.registrations[0];
            expect(registration3).toMatchObject({
                groupId: groups[2].id,
                registeredAt: expect.any(Date),
                discounts: new Map([
                    [bundleDiscount.id, AppliedRegistrationDiscount.create({
                        name: bundleDiscount.name,
                        amount: 8_0000,
                    })],
                ]),
            });

            await registration2.refresh();
            await registration1.refresh();

            // Check discount has been removed in registration 1
            expect(registration2.discounts).toMatchMap(new Map());
            expect(registration1.discounts).toMatchMap(new Map());

            // Check balances
            await assertBalances({ member }, [
                {
                    type: BalanceItemType.Registration,
                    registrationId: registration1.id,
                    amount: 1,
                    unitPrice: 25_0000,
                    status: BalanceItemStatus.Canceled, // has been cancelled
                    priceOpen: 0,
                    pricePending: 0,
                },
                {
                    type: BalanceItemType.RegistrationBundleDiscount,
                    registrationId: registration1.id,
                    amount: 1,
                    unitPrice: -5_0000,
                    status: BalanceItemStatus.Canceled, // has been cancelled
                    pricePending: 0,
                    priceOpen: 0,
                },
                {
                    type: BalanceItemType.Registration,
                    registrationId: registration2.id,
                    amount: 1,
                    unitPrice: 15_0000,
                    status: BalanceItemStatus.Due,
                    pricePending: 0,
                    priceOpen: 15_0000,
                },
                {
                    type: BalanceItemType.Registration,
                    userId: null,
                    memberId: member.id,
                    registrationId: registration3.id,
                    amount: 1,
                    unitPrice: 40_0000,
                    status: BalanceItemStatus.Due,
                    priceOpen: 40_0000,

                    // Not pending because created by admin
                    pricePending: 0,
                },
                // Add new discount
                {
                    type: BalanceItemType.RegistrationBundleDiscount,
                    userId: null,
                    memberId: member.id,
                    registrationId: registration3.id,
                    amount: 1,
                    unitPrice: -8_0000,
                    status: BalanceItemStatus.Due,
                    priceOpen: -8_0000,

                    // Not pending because created by admin
                    pricePending: 0,
                },
            ]);
        });

        test('Deleting a registration with discount, without cancellation fee', async () => {
            const { organization, registration1, registration2, member } = await initDataWithRegistrations();
            const { adminToken } = await initAdmin({ organization });

            // Now delete registration 1, which has discount
            const checkout = IDRegisterCheckout.create({
                cart: IDRegisterCart.create({
                    deleteRegistrationIds: [registration1.id],
                }),
                asOrganizationId: organization.id,
                totalPrice: -25_0000 + 5_0000,
                cancellationFeePercentage: 0,
            });

            await post(checkout, organization, adminToken);
            await registration2.refresh();
            await registration1.refresh();

            // Check discount has been removed in registration 1
            expect(registration2.discounts).toMatchMap(new Map());
            expect(registration1.discounts).toMatchMap(new Map());
            expect(registration1.deactivatedAt).not.toBeNull(); // should be cancelled

            // Check balances
            await assertBalances({ member }, [
                {
                    type: BalanceItemType.Registration,
                    registrationId: registration1.id,
                    amount: 1,
                    unitPrice: 25_0000,
                    status: BalanceItemStatus.Canceled, // has been cancelled
                    priceOpen: 0,
                    pricePending: 0,
                },
                {
                    type: BalanceItemType.RegistrationBundleDiscount,
                    registrationId: registration1.id,
                    amount: 1,
                    unitPrice: -5_0000,
                    status: BalanceItemStatus.Canceled, // has been cancelled
                    pricePending: 0,
                    priceOpen: 0,
                },
                {
                    type: BalanceItemType.Registration,
                    registrationId: registration2.id,
                    amount: 1,
                    unitPrice: 15_0000,
                    status: BalanceItemStatus.Due,
                    pricePending: 0,
                    priceOpen: 15_0000,
                },
            ]);
        });

        test('Deleting a registration with discount, with cancellation fee', async () => {
            const { organization, bundleDiscount, registration1, registration2, member } = await initDataWithRegistrations();
            const { adminToken } = await initAdmin({ organization });

            // Now delete registration 1, which has discount
            const checkout = IDRegisterCheckout.create({
                cart: IDRegisterCart.create({
                    deleteRegistrationIds: [registration1.id],
                }),
                asOrganizationId: organization.id,
                totalPrice: 0, // no change in outstanding balance, because we charge a cancellation fee
                cancellationFeePercentage: 100_00,
            });

            await post(checkout, organization, adminToken);
            await registration2.refresh();
            await registration1.refresh();

            // Check discount has NOT been removed in registration 1
            expect(registration2.discounts).toMatchMap(new Map());
            expect(registration1.discounts).toMatchMap(new Map([
                [bundleDiscount.id, AppliedRegistrationDiscount.create({
                    name: bundleDiscount.name,
                    amount: 5_0000,
                })],
            ]));
            expect(registration1.deactivatedAt).not.toBeNull(); // should be cancelled

            // Check balances
            await assertBalances({ member }, [
                {
                    type: BalanceItemType.Registration,
                    registrationId: registration1.id,
                    amount: 1,
                    unitPrice: 25_0000,
                    status: BalanceItemStatus.Due, // NOT cancelled, because we charge a cancellation fee
                    priceOpen: 25_0000, // cancellation fee
                    pricePending: 0,
                },
                {
                    type: BalanceItemType.RegistrationBundleDiscount,
                    registrationId: registration1.id,
                    amount: 1,
                    unitPrice: -5_0000,
                    status: BalanceItemStatus.Due, // NOT cancelled, because we charge a cancellation fee
                    priceOpen: -5_0000,
                    pricePending: 0,
                },
                {
                    type: BalanceItemType.Registration,
                    registrationId: registration2.id,
                    amount: 1,
                    unitPrice: 15_0000,
                    status: BalanceItemStatus.Due,
                    pricePending: 0,
                    priceOpen: 15_0000,
                },
            ]);
        });

        test('Deleting a registration can alter a discount on a different registration, without cancellation fee', async () => {
            const { organization, registration1, registration2, member } = await initDataWithRegistrations();
            const { adminToken } = await initAdmin({ organization });

            // Now delete registration 2, which does not have a discount
            const checkout = IDRegisterCheckout.create({
                cart: IDRegisterCart.create({
                    deleteRegistrationIds: [registration2.id],
                }),
                asOrganizationId: organization.id,
                totalPrice: -15_0000 + 5_0000, // -15 back, but also lose discount on registration 1, so add 5
                cancellationFeePercentage: 0,
            });

            await post(checkout, organization, adminToken);
            await registration2.refresh();
            await registration1.refresh();

            // Check discount has been removed in registration 1
            expect(registration2.discounts).toMatchMap(new Map());
            expect(registration1.discounts).toMatchMap(new Map());

            // Registration 2 is canceled:
            expect(registration2.deactivatedAt).not.toBeNull();

            // Check balances
            await assertBalances({ member }, [
                {
                    type: BalanceItemType.Registration,
                    registrationId: registration1.id,
                    amount: 1,
                    unitPrice: 25_0000,
                    status: BalanceItemStatus.Due,
                    priceOpen: 25_0000,
                    pricePending: 0,
                },
                {
                    type: BalanceItemType.RegistrationBundleDiscount,
                    registrationId: registration1.id,
                    amount: 1,
                    unitPrice: -5_0000,
                    status: BalanceItemStatus.Due, // has NOT been cancelled
                    pricePending: 0,
                    priceTotal: -5_0000,

                    // Payment reallocation
                    priceOpen: 0,
                    pricePaid: -5_0000,
                },
                {
                    type: BalanceItemType.Registration,
                    registrationId: registration2.id,
                    amount: 1,
                    unitPrice: 15_0000,
                    status: BalanceItemStatus.Canceled,
                    pricePending: 0,
                    priceOpen: 0,
                },
                // A new bundle discount balance item has been created to offset the difference
                {
                    type: BalanceItemType.RegistrationBundleDiscount,
                    registrationId: registration1.id,
                    amount: 1,
                    unitPrice: 5_0000,
                    status: BalanceItemStatus.Due,
                    pricePending: 0,
                    priceTotal: 5_0000,

                    // Payment reallocation
                    priceOpen: 0,
                    pricePaid: 5_0000,
                },
            ]);
        });

        test('Deleting a registration can alter a discount on a different registration, with cancellation fee', async () => {
            const { organization, registration1, registration2, member } = await initDataWithRegistrations();
            const { adminToken } = await initAdmin({ organization });

            // Now delete registration 2, which does not have a discount
            const checkout = IDRegisterCheckout.create({
                cart: IDRegisterCart.create({
                    deleteRegistrationIds: [registration2.id],
                }),
                asOrganizationId: organization.id,
                totalPrice: 5_0000, // Positive 5 because we lose the discount on registration 1
                cancellationFeePercentage: 100_00, // we charge a cancellation fee
            });

            await post(checkout, organization, adminToken);
            await registration2.refresh();
            await registration1.refresh();

            // Check discount has been removed in registration 1
            expect(registration2.discounts).toMatchMap(new Map());
            expect(registration1.discounts).toMatchMap(new Map());

            // Registration 2 is canceled:
            expect(registration2.deactivatedAt).not.toBeNull();

            // Check balances
            await assertBalances({ member }, [
                {
                    type: BalanceItemType.Registration,
                    registrationId: registration1.id,
                    amount: 1,
                    unitPrice: 25_0000,
                    status: BalanceItemStatus.Due,
                    priceOpen: 25_0000,
                    pricePending: 0,
                },
                {
                    type: BalanceItemType.RegistrationBundleDiscount,
                    registrationId: registration1.id,
                    amount: 1,
                    unitPrice: -5_0000,
                    status: BalanceItemStatus.Due, // has NOT been cancelled
                    pricePending: 0,
                    priceTotal: -5_0000,

                    // Payment reallocation
                    priceOpen: 0,
                    pricePaid: -5_0000,
                },
                {
                    type: BalanceItemType.Registration,
                    registrationId: registration2.id,
                    amount: 1,
                    unitPrice: 15_0000,
                    status: BalanceItemStatus.Due, // still due because of cancellation fee
                    pricePending: 0,
                    priceOpen: 15_0000,
                },
                // A new bundle discount balance item has been created to offset the difference
                {
                    type: BalanceItemType.RegistrationBundleDiscount,
                    registrationId: registration1.id,
                    amount: 1,
                    unitPrice: 5_0000,
                    status: BalanceItemStatus.Due,
                    pricePending: 0,
                    priceTotal: 5_0000,

                    // Payment reallocation
                    priceOpen: 0,
                    pricePaid: 5_0000,
                },
            ]);
        });

        test('Discounts work across family members when admins register members', async () => {
            const { organizationRegistrationPeriod, organization, member, token, user } = await initData();
            const { adminToken } = await initAdmin({ organization });

            const otherMember = await new MemberFactory({
                organization,
                user,
            }).create();

            const bundleDiscount = await initBundleDiscount({
                organizationRegistrationPeriod,
                discount: {
                    countWholeFamily: true,
                    discounts: [
                        {
                            value: 20_00,
                            type: GroupPriceDiscountType.Percentage,
                        },
                    ],
                },
            });

            // Create an unrelated group and registration so admin has access to the member
            const randomGroup = await new GroupFactory({
                organization,
                price: 0,
            }).create();

            await new RegistrationFactory({
                organization,
                member: member,
                group: randomGroup,
            }).create();

            const groups = [
                await new GroupFactory({
                    organization,
                    price: 25_0000,
                    bundleDiscount,
                }).create(),
                await new GroupFactory({
                    organization,
                    price: 15_0000,
                    bundleDiscount,
                }).create(),
            ];

            // First register the otherMember for group 1. No discount should be applied yet
            const registration1 = await new RegistrationFactory({
                organization,
                member: otherMember,
                group: groups[0],
            }).create();

            await new BalanceItemFactory({
                userId: user.id,
                memberId: otherMember.id,
                organizationId: organization.id,
                type: BalanceItemType.Registration,
                amount: 1,
                unitPrice: 25_0000,
                status: BalanceItemStatus.Due,
                registrationId: registration1.id,
            }).create();

            const checkout = IDRegisterCheckout.create({
                cart: IDRegisterCart.create({
                    items: [
                        IDRegisterItem.create({
                            groupPrice: groups[1].settings.prices[0],
                            groupId: groups[1].id,
                            organizationId: organization.id,
                            memberId: member.id,
                        }),
                    ],
                }),
                totalPrice: 15_0000 - 5_0000, // 20% discount on first group
                asOrganizationId: organization.id,
            });

            const response2 = await post(checkout, organization, adminToken);
            expect(response2.body.registrations.length).toBe(1);

            const registration2 = response2.body.registrations[0];
            expect(registration2.registeredAt).not.toBeNull();
            expect(registration2.discounts).toMatchMap(new Map()); // note: not super reliable, as this is permission checked

            const registration2Model = (await Registration.getByID(registration2.id))!;
            expect(registration2).toBeDefined();
            expect(registration2Model.discounts).toMatchMap(new Map());

            // Get registration 1 again, it should now have the bundle discount applied
            await registration1.refresh();
            expect(registration1.discounts).toMatchMap(new Map([
                [bundleDiscount.id, AppliedRegistrationDiscount.create({
                    name: bundleDiscount.name,
                    amount: 5_0000,
                })],
            ]));

            await assertBalances({ member: otherMember }, [
                {
                    type: BalanceItemType.Registration,
                    registrationId: registration1.id,
                    amount: 1,
                    price: 25_0000,
                    status: BalanceItemStatus.Due,
                    priceOpen: 25_0000,
                    pricePending: 0,
                    userId: user.id,
                },
                {
                    type: BalanceItemType.RegistrationBundleDiscount,
                    registrationId: registration1.id,
                    amount: 1,
                    price: -5_0000,
                    status: BalanceItemStatus.Due,
                    priceOpen: -5_0000,
                    pricePending: 0,
                    userId: null,
                },
            ]);

            await assertBalances({ member }, [
                {
                    type: BalanceItemType.Registration,
                    registrationId: registration2.id,
                    amount: 1,
                    price: 15_0000,
                    status: BalanceItemStatus.Due,
                    priceOpen: 15_0000,
                    pricePending: 0,
                    userId: null,
                },
            ]);
        });

        test('Discounts work across family members when admins register members, even when the admin does not have access to the family members', async () => {
            const { organizationRegistrationPeriod, organization, member, token, user } = await initData();
            const bundleDiscount = await initBundleDiscount({
                organizationRegistrationPeriod,
                discount: {
                    countWholeFamily: true,
                    discounts: [
                        {
                            value: 20_00,
                            type: GroupPriceDiscountType.Percentage,
                        },
                    ],
                },
            });

            const groups = [
                await new GroupFactory({
                    organization,
                    price: 25_0000,
                    bundleDiscount,
                }).create(),
                await new GroupFactory({
                    organization,
                    price: 15_0000,
                    bundleDiscount,
                }).create(),
            ];

            // Create an unrelated group and registration so admin has access to the member
            const randomGroup = await new GroupFactory({
                organization,
                price: 0,
            }).create();

            await new RegistrationFactory({
                organization,
                member: member,
                group: randomGroup,
            }).create();

            // Make sure the user has financial access so we can check the responses
            const role = await initPermissionRole({
                organization,
                accessRights: [
                    AccessRight.MemberReadFinancialData,
                ],
            });

            const { adminToken } = await initAdmin({
                organization,
                permissions: Permissions.create({
                    level: PermissionLevel.None,
                    resources: new Map([[
                        PermissionsResourceType.Groups, new Map([
                            [
                                randomGroup.id, ResourcePermissions.create({
                                    level: PermissionLevel.Write,
                                }),
                            ], [
                                groups[1].id, ResourcePermissions.create({
                                    level: PermissionLevel.Write,
                                }),
                            ],
                            // No permission for group 0
                        ]),
                    ]]),
                    roles: [role],
                }),
            });

            const otherMember = await new MemberFactory({
                organization,
                user,
            }).create();

            // First register the otherMember for group 1. No discount should be applied yet
            const registration1 = await new RegistrationFactory({
                organization,
                member: otherMember,
                group: groups[0],
            }).create();

            await new BalanceItemFactory({
                userId: user.id,
                memberId: otherMember.id,
                organizationId: organization.id,
                type: BalanceItemType.Registration,
                amount: 1,
                unitPrice: 25_0000,
                status: BalanceItemStatus.Due,
                registrationId: registration1.id,
            }).create();

            const checkout = IDRegisterCheckout.create({
                cart: IDRegisterCart.create({
                    items: [
                        IDRegisterItem.create({
                            groupPrice: groups[1].settings.prices[0],
                            groupId: groups[1].id,
                            organizationId: organization.id,
                            memberId: member.id,
                        }),
                    ],
                }),
                totalPrice: 15_0000, // Admin does not know there should be discount
                asOrganizationId: organization.id,
            });

            const response2 = await post(checkout, organization, adminToken);
            expect(response2.body.registrations.length).toBe(1);

            const registration2 = response2.body.registrations[0];
            expect(registration2.registeredAt).not.toBeNull();
            expect(registration2.discounts).toMatchMap(new Map());

            const registration2Model = (await Registration.getByID(registration2.id))!;
            expect(registration2).toBeDefined();
            expect(registration2Model.discounts).toMatchMap(new Map());

            // Get registration 1 again, it should now have the bundle discount applied
            await registration1.refresh();
            expect(registration1.discounts).toMatchMap(new Map([
                [bundleDiscount.id, AppliedRegistrationDiscount.create({
                    name: bundleDiscount.name,
                    amount: 5_0000,
                })],
            ]));

            await assertBalances({ member: otherMember }, [
                {
                    type: BalanceItemType.Registration,
                    registrationId: registration1.id,
                    amount: 1,
                    price: 25_0000,
                    status: BalanceItemStatus.Due,
                    priceOpen: 25_0000,
                    pricePending: 0,
                    userId: user.id,
                },
                {
                    type: BalanceItemType.RegistrationBundleDiscount,
                    registrationId: registration1.id,
                    amount: 1,
                    price: -5_0000,
                    status: BalanceItemStatus.Due,
                    priceOpen: -5_0000,
                    pricePending: 0,
                    userId: null,
                },
            ]);

            await assertBalances({ member }, [
                {
                    type: BalanceItemType.Registration,
                    registrationId: registration2.id,
                    amount: 1,
                    price: 15_0000,
                    status: BalanceItemStatus.Due,
                    priceOpen: 15_0000,
                    pricePending: 0,
                    userId: null,
                },
            ]);
        });

        test('Discounts work across family members when admins register members, even when the admin does not have access to the family members nor financial access rights', async () => {
            const { organizationRegistrationPeriod, organization, member, token, user } = await initData();
            const bundleDiscount = await initBundleDiscount({
                organizationRegistrationPeriod,
                discount: {
                    countWholeFamily: true,
                    discounts: [
                        {
                            value: 20_00,
                            type: GroupPriceDiscountType.Percentage,
                        },
                    ],
                },
            });

            const groups = [
                await new GroupFactory({
                    organization,
                    price: 25_0000,
                    bundleDiscount,
                }).create(),
                await new GroupFactory({
                    organization,
                    price: 15_0000,
                    bundleDiscount,
                }).create(),
            ];

            // Create an unrelated group and registration so admin has access to the member
            const randomGroup = await new GroupFactory({
                organization,
                price: 0,
            }).create();

            await new RegistrationFactory({
                organization,
                member: member,
                group: randomGroup,
            }).create();

            const { adminToken } = await initAdmin({
                organization,
                permissions: Permissions.create({
                    level: PermissionLevel.None,
                    resources: new Map([[
                        PermissionsResourceType.Groups, new Map([
                            [
                                randomGroup.id, ResourcePermissions.create({
                                    level: PermissionLevel.Write,
                                }),
                            ], [
                                groups[1].id, ResourcePermissions.create({
                                    level: PermissionLevel.Write,
                                }),
                            ],
                            // No permission for group 0
                        ]),
                    ]]),
                }),
            });

            const otherMember = await new MemberFactory({
                organization,
                user,
            }).create();

            // First register the otherMember for group 1. No discount should be applied yet
            const registration1 = await new RegistrationFactory({
                organization,
                member: otherMember,
                group: groups[0],
            }).create();

            await new BalanceItemFactory({
                userId: user.id,
                memberId: otherMember.id,
                organizationId: organization.id,
                type: BalanceItemType.Registration,
                amount: 1,
                unitPrice: 25_0000,
                status: BalanceItemStatus.Due,
                registrationId: registration1.id,
            }).create();

            const checkout = IDRegisterCheckout.create({
                cart: IDRegisterCart.create({
                    items: [
                        IDRegisterItem.create({
                            groupPrice: groups[1].settings.prices[0],
                            groupId: groups[1].id,
                            organizationId: organization.id,
                            memberId: member.id,
                        }),
                    ],
                }),
                totalPrice: 15_0000, // Admin does not know there should be discount
                asOrganizationId: organization.id,
            });

            const response2 = await post(checkout, organization, adminToken);
            expect(response2.body.registrations.length).toBe(1);

            const registration2 = response2.body.registrations[0];
            expect(registration2.registeredAt).not.toBeNull();
            expect(registration2.discounts).toMatchMap(new Map());

            const registration2Model = (await Registration.getByID(registration2.id))!;
            expect(registration2).toBeDefined();
            expect(registration2Model.discounts).toMatchMap(new Map());

            // Get registration 1 again, it should now have the bundle discount applied
            await registration1.refresh();
            expect(registration1.discounts).toMatchMap(new Map([
                [bundleDiscount.id, AppliedRegistrationDiscount.create({
                    name: bundleDiscount.name,
                    amount: 5_0000,
                })],
            ]));

            await assertBalances({ member: otherMember }, [
                {
                    type: BalanceItemType.Registration,
                    registrationId: registration1.id,
                    amount: 1,
                    price: 25_0000,
                    status: BalanceItemStatus.Due,
                    priceOpen: 25_0000,
                    pricePending: 0,
                    userId: user.id,
                },
                {
                    type: BalanceItemType.RegistrationBundleDiscount,
                    registrationId: registration1.id,
                    amount: 1,
                    price: -5_0000,
                    status: BalanceItemStatus.Due,
                    priceOpen: -5_0000,
                    pricePending: 0,
                    userId: null,
                },
            ]);

            await assertBalances({ member }, [
                {
                    type: BalanceItemType.Registration,
                    registrationId: registration2.id,
                    amount: 1,
                    price: 15_0000,
                    status: BalanceItemStatus.Due,
                    priceOpen: 15_0000,
                    pricePending: 0,
                    userId: null,
                },
            ]);
        });

        // Test repeats 5 times because it should be stable
        // This tests real edge cases that were fixed
        test.each([1, 2, 3, 4, 5])('If discounts are the same, they are not moved when the one without discount is edited (%i th try)', async () => {
            const { organizationRegistrationPeriod, organization, member, token, user } = await initData();
            const { adminToken } = await initAdmin({ organization });

            const bundleDiscount = await initBundleDiscount({
                organizationRegistrationPeriod,
                discount: {
                    discounts: [
                        { value: 20_00, type: GroupPriceDiscountType.Percentage },
                        { value: 20_00, type: GroupPriceDiscountType.Percentage },
                        { value: 20_00, type: GroupPriceDiscountType.Percentage },
                    ],
                },
            });

            const groups = [
                await new GroupFactory({
                    organization,
                    price: 25_0000, // 20% discount = 5_00
                    bundleDiscount,
                }).create(),
                await new GroupFactory({
                    organization,
                    price: 25_0000, // 20% discount = 5_00 (same as group 1)
                    bundleDiscount,
                }).create(),
                await new GroupFactory({
                    organization,
                    price: 25_0000, // 20% discount = 5_00 (same as groups 1 & 2)
                    bundleDiscount,
                }).create(),
            ];

            // Create existing registrations for group 1 & 2 with discounts already applied
            const registration1 = await new RegistrationFactory({
                organization,
                member,
                group: groups[0],
            }).create();

            const registration2 = await new RegistrationFactory({
                organization,
                member,
                group: groups[1],
            }).create();

            const registration3 = await new RegistrationFactory({
                organization,
                member,
                group: groups[2],
            }).create();

            // Create balance items for existing registrations
            await new BalanceItemFactory({
                userId: user.id,
                memberId: member.id,
                organizationId: organization.id,
                registrationId: registration1.id,
                type: BalanceItemType.Registration,
                amount: 1,
                unitPrice: 25_0000,
                status: BalanceItemStatus.Due,
            }).create();

            await new BalanceItemFactory({
                userId: user.id,
                memberId: member.id,
                organizationId: organization.id,
                registrationId: registration1.id,
                type: BalanceItemType.RegistrationBundleDiscount,
                amount: 1,
                unitPrice: -5_0000,
                status: BalanceItemStatus.Due,
                relations: new Map([
                    [
                        BalanceItemRelationType.Discount,
                        BalanceItemRelation.create({
                            id: bundleDiscount.id,
                            name: bundleDiscount.name,
                        }),
                    ],
                ]),
            }).create();

            await new BalanceItemFactory({
                userId: user.id,
                memberId: member.id,
                organizationId: organization.id,
                registrationId: registration2.id,
                type: BalanceItemType.Registration,
                amount: 1,
                unitPrice: 25_0000,
                status: BalanceItemStatus.Due,
            }).create();

            // No discount on 2 ( = first)

            // Discount on third
            await new BalanceItemFactory({
                userId: user.id,
                memberId: member.id,
                organizationId: organization.id,
                registrationId: registration3.id,
                type: BalanceItemType.Registration,
                amount: 1,
                unitPrice: 25_0000,
                status: BalanceItemStatus.Due,
            }).create();

            await new BalanceItemFactory({
                userId: user.id,
                memberId: member.id,
                organizationId: organization.id,
                registrationId: registration3.id,
                type: BalanceItemType.RegistrationBundleDiscount,
                amount: 1,
                unitPrice: -5_0000,
                status: BalanceItemStatus.Due,
                relations: new Map([
                    [
                        BalanceItemRelationType.Discount,
                        BalanceItemRelation.create({
                            id: bundleDiscount.id,
                            name: bundleDiscount.name,
                        }),
                    ],
                ]),
            }).create();

            await BalanceItemService.flushCaches(organization.id);
            await registration1.refresh();
            await registration2.refresh();
            await registration3.refresh();

            // Check this is what we expect
            expect(registration2.discounts).toMatchMap(new Map([]));
            expect(registration1.discounts).toMatchMap(new Map([
                [bundleDiscount.id, AppliedRegistrationDiscount.create({
                    name: bundleDiscount.name,
                    amount: 5_0000,
                })],
            ]));
            expect(registration3.discounts).toMatchMap(new Map([
                [bundleDiscount.id, AppliedRegistrationDiscount.create({
                    name: bundleDiscount.name,
                    amount: 5_0000,
                })],
            ]));

            // Now alter the third registration (the one which didn't had a discount)
            const checkout = IDRegisterCheckout.create({
                cart: IDRegisterCart.create({
                    items: [
                        IDRegisterItem.create({
                            groupPrice: groups[1].settings.prices[0],
                            groupId: groups[1].id,
                            organizationId: organization.id,
                            memberId: member.id,
                            replaceRegistrationIds: [registration2.id],
                        }),
                    ],
                }),
                totalPrice: 0, // no balance change
                asOrganizationId: organization.id,
            });

            const response = await post(checkout, organization, adminToken);
            expect(response.body.registrations.length).toBe(1);
            const registration2Struct = response.body.registrations[0];

            expect(registration2Struct).toMatchObject({
                id: registration2.id,
                registeredAt: expect.any(Date),
                discounts: new Map([]),
            });

            // Verify that existing registrations still have their original discounts
            await registration1.refresh();
            await registration2.refresh();
            await registration3.refresh();

            expect(registration2.discounts).toMatchMap(new Map([]));
            expect(registration1.discounts).toMatchMap(new Map([
                [bundleDiscount.id, AppliedRegistrationDiscount.create({
                    name: bundleDiscount.name,
                    amount: 5_0000,
                })],
            ]));
            expect(registration3.discounts).toMatchMap(new Map([
                [bundleDiscount.id, AppliedRegistrationDiscount.create({
                    name: bundleDiscount.name,
                    amount: 5_0000,
                })],
            ]));
        });

        // Test repeats 5 times because it should be stable
        // This tests real edge cases that were fixed
        test.each([1, 2, 3, 4, 5])('If discounts are the same, they are not moved when the one with discount is edited (%i th try)', async () => {
            const { organizationRegistrationPeriod, organization, member, token, user } = await initData();
            const { adminToken } = await initAdmin({ organization });

            const bundleDiscount = await initBundleDiscount({
                organizationRegistrationPeriod,
                discount: {
                    discounts: [
                        { value: 20_00, type: GroupPriceDiscountType.Percentage },
                        { value: 20_00, type: GroupPriceDiscountType.Percentage },
                        { value: 20_00, type: GroupPriceDiscountType.Percentage },
                    ],
                },
            });

            const groups = [
                await new GroupFactory({
                    organization,
                    price: 25_0000, // 20% discount = 5_00
                    bundleDiscount,
                }).create(),
                await new GroupFactory({
                    organization,
                    price: 25_0000, // 20% discount = 5_00 (same as group 1)
                    bundleDiscount,
                }).create(),
                await new GroupFactory({
                    organization,
                    price: 25_0000, // 20% discount = 5_00 (same as groups 1 & 2)
                    bundleDiscount,
                }).create(),
            ];

            // Create existing registrations for group 1 & 2 with discounts already applied
            const registration1 = await new RegistrationFactory({
                organization,
                member,
                group: groups[0],
            }).create();

            const registration2 = await new RegistrationFactory({
                organization,
                member,
                group: groups[1],
            }).create();

            const registration3 = await new RegistrationFactory({
                organization,
                member,
                group: groups[2],
            }).create();

            // Create balance items for existing registrations
            await new BalanceItemFactory({
                userId: user.id,
                memberId: member.id,
                organizationId: organization.id,
                registrationId: registration1.id,
                type: BalanceItemType.Registration,
                amount: 1,
                unitPrice: 25_0000,
                status: BalanceItemStatus.Due,
            }).create();

            await new BalanceItemFactory({
                userId: user.id,
                memberId: member.id,
                organizationId: organization.id,
                registrationId: registration1.id,
                type: BalanceItemType.RegistrationBundleDiscount,
                amount: 1,
                unitPrice: -5_0000,
                status: BalanceItemStatus.Due,
                relations: new Map([
                    [
                        BalanceItemRelationType.Discount,
                        BalanceItemRelation.create({
                            id: bundleDiscount.id,
                            name: bundleDiscount.name,
                        }),
                    ],
                ]),
            }).create();

            await new BalanceItemFactory({
                userId: user.id,
                memberId: member.id,
                organizationId: organization.id,
                registrationId: registration2.id,
                type: BalanceItemType.Registration,
                amount: 1,
                unitPrice: 25_0000,
                status: BalanceItemStatus.Due,
            }).create();

            // No discount on 2 ( = first)

            // Discount on third
            await new BalanceItemFactory({
                userId: user.id,
                memberId: member.id,
                organizationId: organization.id,
                registrationId: registration3.id,
                type: BalanceItemType.Registration,
                amount: 1,
                unitPrice: 25_0000,
                status: BalanceItemStatus.Due,
            }).create();

            await new BalanceItemFactory({
                userId: user.id,
                memberId: member.id,
                organizationId: organization.id,
                registrationId: registration3.id,
                type: BalanceItemType.RegistrationBundleDiscount,
                amount: 1,
                unitPrice: -5_0000,
                status: BalanceItemStatus.Due,
                relations: new Map([
                    [
                        BalanceItemRelationType.Discount,
                        BalanceItemRelation.create({
                            id: bundleDiscount.id,
                            name: bundleDiscount.name,
                        }),
                    ],
                ]),
            }).create();

            await BalanceItemService.flushCaches(organization.id);
            await registration1.refresh();
            await registration2.refresh();
            await registration3.refresh();

            // Check this is what we expect
            expect(registration2.discounts).toMatchMap(new Map([]));
            expect(registration1.discounts).toMatchMap(new Map([
                [bundleDiscount.id, AppliedRegistrationDiscount.create({
                    name: bundleDiscount.name,
                    amount: 5_0000,
                })],
            ]));
            expect(registration3.discounts).toMatchMap(new Map([
                [bundleDiscount.id, AppliedRegistrationDiscount.create({
                    name: bundleDiscount.name,
                    amount: 5_0000,
                })],
            ]));

            // Now alter the third registration (the one which didn't had a discount)
            const checkout = IDRegisterCheckout.create({
                cart: IDRegisterCart.create({
                    items: [
                        IDRegisterItem.create({
                            groupPrice: groups[0].settings.prices[0],
                            groupId: groups[0].id,
                            organizationId: organization.id,
                            memberId: member.id,
                            replaceRegistrationIds: [registration1.id],
                        }),
                    ],
                }),
                totalPrice: 0, // no balance change
                asOrganizationId: organization.id,
            });

            const response = await post(checkout, organization, adminToken);
            expect(response.body.registrations.length).toBe(1);
            const registration1Struct = response.body.registrations[0];

            expect(registration1Struct).toMatchObject({
                id: registration1.id,
                registeredAt: expect.any(Date),
                discounts: new Map([
                    [bundleDiscount.id, AppliedRegistrationDiscount.create({
                        name: bundleDiscount.name,
                        amount: 5_0000,
                    })],
                ]),
            });

            // Verify that existing registrations still have their original discounts
            await registration1.refresh();
            await registration2.refresh();
            await registration3.refresh();

            expect(registration2.discounts).toMatchMap(new Map([]));
            expect(registration1.discounts).toMatchMap(new Map([
                [bundleDiscount.id, AppliedRegistrationDiscount.create({
                    name: bundleDiscount.name,
                    amount: 5_0000,
                })],
            ]));
            expect(registration3.discounts).toMatchMap(new Map([
                [bundleDiscount.id, AppliedRegistrationDiscount.create({
                    name: bundleDiscount.name,
                    amount: 5_0000,
                })],
            ]));
        });

        // Test repeats 5 times because it should be stable
        // This tests real edge cases that were fixed
        test.each([1, 2, 3, 4, 5])('If discounts are the same, they are not moved when the one with and one without discount are edited (%i th try)', async () => {
            const { organizationRegistrationPeriod, organization, member, token, user } = await initData();
            const { adminToken } = await initAdmin({ organization });

            const bundleDiscount = await initBundleDiscount({
                organizationRegistrationPeriod,
                discount: {
                    discounts: [
                        { value: 20_00, type: GroupPriceDiscountType.Percentage },
                        { value: 20_00, type: GroupPriceDiscountType.Percentage },
                        { value: 20_00, type: GroupPriceDiscountType.Percentage },
                    ],
                },
            });

            const groups = [
                await new GroupFactory({
                    organization,
                    price: 25_0000, // 20% discount = 5_00
                    bundleDiscount,
                }).create(),
                await new GroupFactory({
                    organization,
                    price: 25_0000, // 20% discount = 5_00 (same as group 1)
                    bundleDiscount,
                }).create(),
                await new GroupFactory({
                    organization,
                    price: 25_0000, // 20% discount = 5_00 (same as groups 1 & 2)
                    bundleDiscount,
                }).create(),
            ];

            // Create existing registrations for group 1 & 2 with discounts already applied
            const registration1 = await new RegistrationFactory({
                organization,
                member,
                group: groups[0],
            }).create();

            const registration2 = await new RegistrationFactory({
                organization,
                member,
                group: groups[1],
            }).create();

            const registration3 = await new RegistrationFactory({
                organization,
                member,
                group: groups[2],
            }).create();

            // Create balance items for existing registrations
            await new BalanceItemFactory({
                userId: user.id,
                memberId: member.id,
                organizationId: organization.id,
                registrationId: registration1.id,
                type: BalanceItemType.Registration,
                amount: 1,
                unitPrice: 25_0000,
                status: BalanceItemStatus.Due,
            }).create();

            await new BalanceItemFactory({
                userId: user.id,
                memberId: member.id,
                organizationId: organization.id,
                registrationId: registration1.id,
                type: BalanceItemType.RegistrationBundleDiscount,
                amount: 1,
                unitPrice: -5_0000,
                status: BalanceItemStatus.Due,
                relations: new Map([
                    [
                        BalanceItemRelationType.Discount,
                        BalanceItemRelation.create({
                            id: bundleDiscount.id,
                            name: bundleDiscount.name,
                        }),
                    ],
                ]),
            }).create();

            await new BalanceItemFactory({
                userId: user.id,
                memberId: member.id,
                organizationId: organization.id,
                registrationId: registration2.id,
                type: BalanceItemType.Registration,
                amount: 1,
                unitPrice: 25_0000,
                status: BalanceItemStatus.Due,
            }).create();

            // No discount on 2 ( = first)

            // Discount on third
            await new BalanceItemFactory({
                userId: user.id,
                memberId: member.id,
                organizationId: organization.id,
                registrationId: registration3.id,
                type: BalanceItemType.Registration,
                amount: 1,
                unitPrice: 25_0000,
                status: BalanceItemStatus.Due,
            }).create();

            await new BalanceItemFactory({
                userId: user.id,
                memberId: member.id,
                organizationId: organization.id,
                registrationId: registration3.id,
                type: BalanceItemType.RegistrationBundleDiscount,
                amount: 1,
                unitPrice: -5_0000,
                status: BalanceItemStatus.Due,
                relations: new Map([
                    [
                        BalanceItemRelationType.Discount,
                        BalanceItemRelation.create({
                            id: bundleDiscount.id,
                            name: bundleDiscount.name,
                        }),
                    ],
                ]),
            }).create();

            await BalanceItemService.flushCaches(organization.id);
            await registration1.refresh();
            await registration2.refresh();
            await registration3.refresh();

            // Check this is what we expect
            expect(registration2.discounts).toMatchMap(new Map([]));
            expect(registration1.discounts).toMatchMap(new Map([
                [bundleDiscount.id, AppliedRegistrationDiscount.create({
                    name: bundleDiscount.name,
                    amount: 5_0000,
                })],
            ]));
            expect(registration3.discounts).toMatchMap(new Map([
                [bundleDiscount.id, AppliedRegistrationDiscount.create({
                    name: bundleDiscount.name,
                    amount: 5_0000,
                })],
            ]));

            // Now alter the third registration (the one which didn't had a discount)
            const checkout = IDRegisterCheckout.create({
                cart: IDRegisterCart.create({
                    items: [
                        // Keep the one without last in the cart, since these normally get discount priority
                        IDRegisterItem.create({
                            groupPrice: groups[0].settings.prices[0],
                            groupId: groups[0].id,
                            organizationId: organization.id,
                            memberId: member.id,
                            replaceRegistrationIds: [registration1.id],
                        }),
                        IDRegisterItem.create({
                            groupPrice: groups[1].settings.prices[0],
                            groupId: groups[1].id,
                            organizationId: organization.id,
                            memberId: member.id,
                            replaceRegistrationIds: [registration2.id],
                        }),
                    ],
                }),
                totalPrice: 0, // no balance change
                asOrganizationId: organization.id,
            });

            const response = await post(checkout, organization, adminToken);
            expect(response.body.registrations.length).toBe(2);

            // Check array matches
            expect(response.body.registrations).toIncludeSameMembers([
                expect.objectContaining({
                    id: registration1.id,
                    registeredAt: expect.any(Date),
                    discounts: new Map([
                        [bundleDiscount.id, AppliedRegistrationDiscount.create({
                            name: bundleDiscount.name,
                            amount: 5_0000,
                        })],
                    ]),
                }),
                expect.objectContaining({
                    id: registration2.id,
                    registeredAt: expect.any(Date),
                    discounts: new Map([]),
                }),
            ]);

            // Verify that existing registrations still have their original discounts
            await registration1.refresh();
            await registration2.refresh();
            await registration3.refresh();

            expect(registration2.discounts).toMatchMap(new Map([]));
            expect(registration1.discounts).toMatchMap(new Map([
                [bundleDiscount.id, AppliedRegistrationDiscount.create({
                    name: bundleDiscount.name,
                    amount: 5_0000,
                })],
            ]));
            expect(registration3.discounts).toMatchMap(new Map([
                [bundleDiscount.id, AppliedRegistrationDiscount.create({
                    name: bundleDiscount.name,
                    amount: 5_0000,
                })],
            ]));
        });
    });
});
