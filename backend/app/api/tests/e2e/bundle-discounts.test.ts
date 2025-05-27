import { Request } from '@simonbackx/simple-endpoints';
import { BalanceItem, BalanceItemFactory, GroupFactory, MemberFactory, Organization, OrganizationFactory, OrganizationRegistrationPeriodFactory, Registration, RegistrationFactory, RegistrationPeriod, RegistrationPeriodFactory, Token, UserFactory } from '@stamhoofd/models';
import { AppliedRegistrationDiscount, BalanceItemRelation, BalanceItemRelationType, BalanceItemStatus, BalanceItemType, GroupPriceDiscountType, IDRegisterCart, IDRegisterCheckout, IDRegisterItem, PaymentMethod, PermissionLevel, Permissions } from '@stamhoofd/structures';
import { TestUtils } from '@stamhoofd/test-utils';
import { RegisterMembersEndpoint } from '../../src/endpoints/global/registration/RegisterMembersEndpoint';
import { assertBalances } from '../assertions/assertBalances';
import { testServer } from '../helpers/TestServer';
import { initBundleDiscount } from '../init/initBundleDiscount';
import { initStripe } from '../init/initStripe';

const baseUrl = `/members/register`;

describe('E2E.Bundle Discounts', () => {
    const endpoint = new RegisterMembersEndpoint();
    let period: RegistrationPeriod;
    const defaultPermissionLevel = PermissionLevel.Full;
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

    const initOrganization = async (registrationPeriod: RegistrationPeriod = period) => {
        const organization = await new OrganizationFactory({ period: registrationPeriod })
            .create();

        const organizationRegistrationPeriod = await new OrganizationRegistrationPeriodFactory({ organization, period: registrationPeriod }).create();

        return { organization, organizationRegistrationPeriod };
    };

    async function initData() {
        const { organization, organizationRegistrationPeriod } = await initOrganization(period);

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

    async function initAdmin({ organization }: { organization: Organization }) {
        const admin = await new UserFactory({
            organization,
            permissions: Permissions.create({
                level: PermissionLevel.Full,
            }),
        }).create();

        const adminToken = await Token.createToken(admin);
        return { admin, adminToken };
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
                price: 25_00,
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
                totalPrice: 25_00,
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
                    price: 25_00,
                    status: BalanceItemStatus.Due,
                    priceOpen: 0,
                    pricePending: 25_00,
                },
            ]);
        });

        test.todo('Unrelated registrations do not get counted for bundle discounts');

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
                price: 25_00,
                bundleDiscount,
            })
                .create();

            const groupPrice = group.settings.prices[0];

            const group2 = await new GroupFactory({
                organization,
                price: 15_00, // Lower price so discount is applied preferably on the first group
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
                totalPrice: 15_00 - 5_00, // 20% discount on first group
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
                    amount: 5_00,
                })],
            ]));

            await assertBalances({ user }, [
                {
                    type: BalanceItemType.Registration,
                    registrationId: registration1.id,
                    amount: 1,
                    price: 25_00,
                    status: BalanceItemStatus.Due,
                    priceOpen: 0,
                    pricePending: 25_00,
                },
                {
                    type: BalanceItemType.RegistrationBundleDiscount,
                    registrationId: registration1.id,
                    amount: 1,
                    price: -5_00,
                    status: BalanceItemStatus.Due,
                    priceOpen: 0,
                    pricePending: -5_00,
                },
                {
                    type: BalanceItemType.Registration,
                    registrationId: registration2.id,
                    amount: 1,
                    price: 15_00,
                    status: BalanceItemStatus.Due,
                    priceOpen: 0,
                    pricePending: 15_00,
                },
            ]);
        }, 10_000);

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
                price: 25_00,
                bundleDiscount,
            })
                .create();

            const groupPrice = group.settings.prices[0];

            const group2 = await new GroupFactory({
                organization,
                price: 35_00, // Higher price so discount is applied preferably here
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
                totalPrice: 25_00,
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
                totalPrice: 35_00 - 7_00, // 20% discount on 35_00 = 7_00
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
                        amount: 7_00,
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
                    price: 25_00,
                    status: BalanceItemStatus.Due,
                    priceOpen: 0,
                    pricePending: 25_00,
                },
                {
                    type: BalanceItemType.RegistrationBundleDiscount,
                    registrationId: registration2.id,
                    amount: 1,
                    price: -7_00,
                    status: BalanceItemStatus.Due,
                    priceOpen: 0,
                    pricePending: -7_00,
                },
                {
                    type: BalanceItemType.Registration,
                    registrationId: registration2.id,
                    amount: 1,
                    price: 35_00,
                    status: BalanceItemStatus.Due,
                    priceOpen: 0,
                    pricePending: 35_00,
                },
            ]);
        }, 10_000);

        test.todo('A failed payment cancels the registration and bundle discount');

        test.todo('When a bundle discount is altered, new registrations autocorrect if they are eleigible for the discount');
        test.todo('When a bundle discount is altered, new registrations do not autocorrect if they are not eleigible for the discount');

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
                    price: 25_00,
                    bundleDiscount,
                }).create(),
                await new GroupFactory({
                    organization,
                    price: 15_00,
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
                totalPrice: 25_00 + 15_00 - 5_00, // 20% discount on highest price (25_00 * 0.2 = 5_00)
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
                            amount: 5_00,
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
                    price: 25_00,
                    status: BalanceItemStatus.Due,
                    priceOpen: 0,
                    pricePending: 25_00,
                },
                {
                    type: BalanceItemType.RegistrationBundleDiscount,
                    registrationId: expect.any(String),
                    amount: 1,
                    price: -5_00,
                    status: BalanceItemStatus.Due,
                    priceOpen: 0,
                    pricePending: -5_00,
                },
                {
                    type: BalanceItemType.Registration,
                    registrationId: expect.any(String),
                    amount: 1,
                    price: 15_00,
                    status: BalanceItemStatus.Due,
                    priceOpen: 0,
                    pricePending: 15_00,
                },
            ]);
        }, 10_000);
    });

    describe('Changing registrations as admin', () => {
        /**
         * If you replace a registration, it is possible that a bundle discount of a different registration is not optimal anymore and
         * a more optimal discount can be applied. In that case, the bundle discount can be moved from the unaltered registration to the newly created registration.
         */
        test('Replacing a registration can move the bundle discount of an unaltered registration', async () => {
            const { organizationRegistrationPeriod, organization, member, user } = await initData();
            const { adminToken } = await initAdmin({ organization });

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
                    price: 25_00,
                    bundleDiscount,
                }).create(),
                await new GroupFactory({
                    organization,
                    price: 15_00,
                    bundleDiscount,
                }).create(),
                await new GroupFactory({
                    organization,
                    price: 40_00,
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
                unitPrice: 25_00,
                status: BalanceItemStatus.Due,
            }).create();

            // Create applied discount
            await new BalanceItemFactory({
                memberId: member.id,
                organizationId: organization.id,
                registrationId: registration1.id,
                type: BalanceItemType.RegistrationBundleDiscount,
                amount: 1,
                unitPrice: -5_00,
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
                unitPrice: 15_00,
                status: BalanceItemStatus.Due,
            }).create();

            await registration1.refresh();
            expect(registration1).toMatchObject({
                groupId: groups[0].id,
                registeredAt: expect.any(Date),
                discounts: new Map([
                    [bundleDiscount.id, AppliedRegistrationDiscount.create({
                        name: bundleDiscount.name,
                        amount: 5_00,
                    })],
                ]),
            });

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
                totalPrice: 40_00 - 15_00 + 5_00 - 8_00, // group 3 - group 2 + reverted discount - new discount
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
                        amount: 8_00,
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
                    unitPrice: 25_00,
                    status: BalanceItemStatus.Due,
                    priceOpen: 25_00,
                    pricePending: 0,
                },
                {
                    type: BalanceItemType.RegistrationBundleDiscount,
                    registrationId: registration1.id,
                    amount: 1,
                    unitPrice: -5_00,
                    status: BalanceItemStatus.Due,
                    pricePending: 0,
                    priceOpen: -5_00,
                },
                {
                    type: BalanceItemType.Registration,
                    registrationId: registration2.id,
                    amount: 1,
                    unitPrice: 15_00,
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
                    unitPrice: 40_00,
                    status: BalanceItemStatus.Due,
                    priceOpen: 40_00,

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
                    unitPrice: 5_00,
                    status: BalanceItemStatus.Due,
                    priceOpen: 5_00,

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
                    unitPrice: -8_00,
                    status: BalanceItemStatus.Due,
                    priceOpen: -8_00,

                    // Not pending because created by admin
                    pricePending: 0,
                },
            ]);
        });
    });

    describe('With historic registrations', () => {
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
                price: 25_00,
                stock: 500,
                bundleDiscount,
            })
                .create();
            const groupPrice = group.settings.prices[0];

            const group2 = await new GroupFactory({
                organization,
                price: 15_00, // Lower price so discount is applied preferably on the first group
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
                    unitPrice: 25_00,
                    status: BalanceItemStatus.Hidden,
                    priceOpen: -25_00, // hidden, so no payment expected yet
                    pricePending: 25_00,
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
                    unitPrice: 25_00,
                    status: BalanceItemStatus.Due,
                    priceOpen: 0,
                    pricePaid: 25_00,
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
                totalPrice: 15_00 - 5_00, // 20% discount on first group
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
                    unitPrice: 15_00,
                    status: BalanceItemStatus.Hidden, // Pending
                    priceOpen: -15_00, // hidden, so no payment expected yet
                    pricePending: 15_00,
                    pricePaid: 0,
                },
                {
                    type: BalanceItemType.RegistrationBundleDiscount,
                    registrationId: registration1.id,
                    amount: 1,
                    unitPrice: -5_00,
                    status: BalanceItemStatus.Hidden, // Pending
                    priceOpen: 5_00,
                    pricePending: -5_00,
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
                    unitPrice: 15_00,
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
                    unitPrice: -5_00,
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
                    unitPrice: 15_00,
                    status: BalanceItemStatus.Hidden, // Pending
                    priceOpen: -15_00, // hidden, so no payment expected yet
                    pricePending: 15_00,
                    pricePaid: 0,
                    paidAt: null,
                },
                {
                    type: BalanceItemType.RegistrationBundleDiscount,
                    registrationId: registration1.id,
                    amount: 1,
                    unitPrice: -5_00,
                    status: BalanceItemStatus.Hidden, // Pending
                    priceOpen: 5_00,
                    pricePending: -5_00,
                    pricePaid: 0,
                    paidAt: null,
                },
            ]);

            // Success the payment
            await stripeMocker.succeedPayment(stripeMocker.getLastIntent());

            // Check registration 3 became valid
            const updatedRegistration3 = (await Registration.getByID(registration3.id))!;
            expect(updatedRegistration3).toBeDefined();
            expect(updatedRegistration3.registeredAt).not.toBeNull();

            // Check registration 1 now has the discounts saved
            await updatedRegistration1.refresh();
            expect(updatedRegistration1.discounts).toMatchMap(new Map([
                [bundleDiscount.id, AppliedRegistrationDiscount.create({
                    name: bundleDiscount.name,
                    amount: 5_00,
                })],
            ]));

            // Only price pending and open has changed now
            expectedBalances.push(
                {
                    type: BalanceItemType.Registration,
                    registrationId: registration3.id,
                    amount: 1,
                    unitPrice: 15_00,
                    status: BalanceItemStatus.Due,
                    priceOpen: 0,
                    pricePending: 0,
                    pricePaid: 15_00,
                    paidAt: expect.any(Date),
                },
                {
                    type: BalanceItemType.RegistrationBundleDiscount,
                    registrationId: registration1.id,
                    amount: 1,
                    unitPrice: -5_00,
                    status: BalanceItemStatus.Due,
                    priceOpen: 0,
                    pricePending: 0,
                    pricePaid: -5_00,
                    paidAt: expect.any(Date),
                },
            );

            await assertBalances({ user }, expectedBalances);
        }, 20_000);

        test.todo('Best discount applied on new registration');
    });

    describe('Deleting a registration', () => {
        test.todo('With cancellation fee: Causes bundle discount on other historic registration to be recalculated');
        test.todo('With cancellation fee: Causes bundle discount on deleted registration to be recalculated');

        test.todo('Without cancellation fee: Causes bundle discount on other historic registration to be recalculated');
        test.todo('Without cancellation fee: Causes bundle discount on deleted registration to be recalculated');
    });
});
