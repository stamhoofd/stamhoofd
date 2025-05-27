import { Request } from '@simonbackx/simple-endpoints';
import { BalanceItem, GroupFactory, MemberFactory, Organization, OrganizationFactory, OrganizationRegistrationPeriodFactory, Registration, RegistrationPeriod, RegistrationPeriodFactory, Token, UserFactory } from '@stamhoofd/models';
import { AppliedRegistrationDiscount, BalanceItemStatus, BalanceItemType, GroupPriceDiscountType, IDRegisterCart, IDRegisterCheckout, IDRegisterItem, PaymentMethod, PermissionLevel, Permissions, Version } from '@stamhoofd/structures';
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

    async function initData({ permissionLevel = defaultPermissionLevel }: { permissionLevel?: PermissionLevel } = {}) {
        const { organization, organizationRegistrationPeriod } = await initOrganization(period);

        const user = await new UserFactory({
            organization,
            permissions: permissionLevel !== PermissionLevel.None
                ? Permissions.create({
                    level: permissionLevel,
                })
                : null,
        })
            .create();

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

    describe('With historic registrations', () => {
        test('Case: Replacing a historic registration causes a change in a different registration\'s discounts', async () => {
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

            const group3 = await new GroupFactory({
                organization,
                price: 40_00, // Higher price
                bundleDiscount,
            }).create();
            const groupPrice3 = group3.settings.prices[0];

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

            await assertBalances({
                user,
                balances: [
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
                ],
            });

            // Now reaplce registration 2 with group 3, which is more expensive and should give more discount
            const checkout3 = IDRegisterCheckout.create({
                cart: IDRegisterCart.create({
                    items: [
                        IDRegisterItem.create({
                            options: [],
                            groupPrice: groupPrice3,
                            groupId: group3.id,
                            organizationId: organization.id,
                            memberId: member.id,
                            replaceRegistrationIds: [registration2.id],
                        }),
                    ],
                }),
                administrationFee: 0,
                freeContribution: 0,
                paymentMethod: PaymentMethod.PointOfSale,
                asOrganizationId: organization.id,
                totalPrice: 40_00 - 15_00 + 5_00 - 8_00, // group 3 - group 2 + reverted discount - new discount
            });

            const response3 = await post(checkout3, organization, token);
            expect(response3.body.registrations.length).toBe(1);
            const registration3 = response3.body.registrations[0];
            expect(registration3.registeredAt).not.toBeNull();
            expect(registration3.discounts).toMatchMap(new Map([
                [bundleDiscount.id, AppliedRegistrationDiscount.create({
                    name: bundleDiscount.name,
                    amount: 8_00,
                })],
            ]));

            const updatedRegistration2 = (await Registration.getByID(registration2.id))!;
            await updatedRegistration1.refresh();

            // Check discount has been removed in registration 1
            expect(updatedRegistration2.discounts).toMatchMap(new Map());
            expect(updatedRegistration1.discounts).toMatchMap(new Map());

            // Check balances: no deletions happened, only additions or status changes
            await assertBalances({
                user,
                balances: [
                    {
                        type: BalanceItemType.Registration,
                        registrationId: registration1.id,
                        amount: 1,
                        unitPrice: 25_00,
                        status: BalanceItemStatus.Due,
                        priceOpen: 0,
                        pricePending: 25_00,
                    },
                    {
                        type: BalanceItemType.RegistrationBundleDiscount,
                        registrationId: registration1.id,
                        amount: 1,
                        unitPrice: -5_00,
                        status: BalanceItemStatus.Due,
                        priceOpen: 0,
                        pricePending: -5_00,
                    },
                    {
                        type: BalanceItemType.Registration,
                        registrationId: registration2.id,
                        amount: 1,
                        unitPrice: 15_00,
                        status: BalanceItemStatus.Canceled,
                        priceOpen: -15_00,
                        pricePending: 15_00,
                    },
                    {
                        type: BalanceItemType.Registration,
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
                        registrationId: registration3.id,
                        amount: 1,
                        unitPrice: -8_00,
                        status: BalanceItemStatus.Due,
                        priceOpen: -8_00,

                        // Not pending because created by admin
                        pricePending: 0,
                    },
                ],
            });
        }, 10_000);

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
            await assertBalances({
                user,
                balances: [
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
                ],
            });

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

            await assertBalances({
                user,
                balances: expectedBalances,
            });

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
            await assertBalances({
                user,
                balances: [
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
                ],
            });

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

            await assertBalances({
                user,
                balances: expectedBalances,
            });

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

            await assertBalances({
                user,
                balances: [
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
                ],
            });

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

            await assertBalances({
                user,
                balances: expectedBalances,
            });
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
