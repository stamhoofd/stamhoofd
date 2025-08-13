import { Request } from '@simonbackx/simple-endpoints';
import { BalanceItemFactory, GroupFactory, MemberFactory, MemberWithRegistrations, Organization, OrganizationFactory, OrganizationRegistrationPeriod, Platform, RegistrationPeriod, RegistrationPeriodFactory, Token, UserFactory } from '@stamhoofd/models';
import { AdministrationFeeSettings, BalanceItemCartItem, BalanceItemRelation, BalanceItemRelationType, BalanceItemStatus, BalanceItemType, BooleanStatus, DefaultAgeGroup, FreeContributionSettings, GroupOption, GroupOptionMenu, IDRegisterCart, IDRegisterCheckout, IDRegisterItem, PaymentMethod, PermissionLevel, Permissions, PlatformMembershipType, PlatformMembershipTypeConfig, ReceivableBalanceType, ReduceablePrice, RegisterItemOption, TranslatedString, Version } from '@stamhoofd/structures';
import { v4 as uuidv4 } from 'uuid';
import { GetMemberFamilyEndpoint } from '../../src/endpoints/global/members/GetMemberFamilyEndpoint';
import { RegisterMembersEndpoint } from '../../src/endpoints/global/registration/RegisterMembersEndpoint';
import { GetMemberBalanceEndpoint } from '../../src/endpoints/organization/dashboard/payments/GetMemberBalanceEndpoint';
import { GetReceivableBalanceEndpoint } from '../../src/endpoints/organization/dashboard/receivable-balances/GetReceivableBalanceEndpoint';
import { PlatformMembershipService } from '../../src/services/PlatformMembershipService';
import { testServer } from '../helpers/TestServer';
import { TestUtils } from '@stamhoofd/test-utils';
import { BalanceItemService } from '../../src/services/BalanceItemService';
import { assertBalances } from '../assertions/assertBalances';

describe('E2E.Register', () => {
    const registerEndpoint = new RegisterMembersEndpoint();
    const receivableBalancesEndpoint = new GetReceivableBalanceEndpoint();
    const getMemberFamilyEndpoint = new GetMemberFamilyEndpoint();

    let period: RegistrationPeriod;

    const register = async (body: IDRegisterCheckout, organization: Organization, token: Token) => {
        const request = Request.buildJson('POST', `/v${Version}/members/register`, organization.getApiHost(), body);
        request.headers.authorization = 'Bearer ' + token.accessToken;
        return await testServer.test(registerEndpoint, request);
    };

    const getReceivableBalance = async (type: ReceivableBalanceType, id: string, organization: Organization, token: Token) => {
        await BalanceItemService.flushAll();
        const request = Request.buildJson('GET', `/v${Version}/receivable-balances/${type}/${id}`, organization.getApiHost());
        request.headers.authorization = 'Bearer ' + token.accessToken;
        return await testServer.test(receivableBalancesEndpoint, request);
    };

    const getMemberFamily = async (memberId: string, organization: Organization, token: Token) => {
        const request = Request.buildJson('GET', `/v${Version}/organization/members/${memberId}/family`, organization.getApiHost());
        request.headers.authorization = 'Bearer ' + token.accessToken;
        return await testServer.test(getMemberFamilyEndpoint, request);
    };

    beforeEach(async () => {
        // These tests should run in platform mode
        TestUtils.setEnvironment('userMode', 'platform');
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    beforeAll(async () => {
        const previousPeriod = await new RegistrationPeriodFactory({
            startDate: new Date(2022, 0, 1),
            endDate: new Date(2022, 11, 31),
        }).create();

        period = await new RegistrationPeriodFactory({
            startDate: new Date(2023, 0, 1),
            endDate: new Date(2050, 11, 31),
        }).create();

        period.previousPeriodId = previousPeriod.id;
        await period.save();
    });

    const initData = async ({ otherMemberAmount = 0, permissionLevel = PermissionLevel.Full }: { otherMemberAmount?: number; permissionLevel?: PermissionLevel } = {}) => {
        const organization = await new OrganizationFactory({ period })
            .create();

        const user = await new UserFactory({
            organization,
            permissions: Permissions.create({
                level: permissionLevel,
            }),
        })
            .create();

        const token = await Token.createToken(user);

        const member = await new MemberFactory({ organization, user }).create();

        const otherMembers: MemberWithRegistrations[] = [];

        for (let i = 0; i < otherMemberAmount; i++) {
            otherMembers.push(await new MemberFactory({ organization, user }).create());
        }

        const group = await new GroupFactory({
            organization,
            price: 25,
            reducedPrice: 21,
            stock: 5,
        }).create();

        const groupPrice = group.settings.prices[0];

        return {
            organization,
            user,
            token,
            member,
            otherMembers,
            group,
            groupPrice,
        };
    };

    beforeEach(async () => {
    });

    describe('Register prices and balances', () => {
        test('Register by member should create balance for member', async () => {
            const { organization, group, groupPrice, token, member } = await initData();

            const body = IDRegisterCheckout.create({
                cart: IDRegisterCart.create({
                    items: [
                        IDRegisterItem.create({
                            id: uuidv4(),
                            replaceRegistrationIds: [],
                            options: [],
                            groupPrice,
                            organizationId: organization.id,
                            groupId: group.id,
                            memberId: member.id,
                        }),
                    ],
                    balanceItems: [
                    ],
                    deleteRegistrationIds: [],
                }),
                administrationFee: 0,
                freeContribution: 0,
                paymentMethod: PaymentMethod.PointOfSale,
                totalPrice: 25,
                customer: null,
            });

            await assertBalances({ member }, []);

            await register(body, organization, token);

            await assertBalances({ member }, [
                {
                    pricePaid: 0,
                    type: BalanceItemType.Registration,
                    status: BalanceItemStatus.Due,
                    unitPrice: 25,
                    amount: 1,
                    pricePending: 25,
                    priceOpen: 0,
                },
            ]);
        });

        test('Should create balance items for options', async () => {
            const { organization, group, groupPrice, token, member } = await initData();

            const option1 = GroupOption.create({
                name: 'option 1',
                price: ReduceablePrice.create({
                    price: 5,
                    reducedPrice: 3,
                }),
            });

            const option2 = GroupOption.create({
                name: 'option 2',
                price: ReduceablePrice.create({
                    price: 3,
                    reducedPrice: 1,
                }),
            });

            const optionMenu = GroupOptionMenu.create({
                name: 'option menu 1',
                multipleChoice: true,
                options: [option1, option2],
            });

            group.settings.optionMenus = [
                optionMenu,
            ];

            await group.save();

            const body = IDRegisterCheckout.create({
                cart: IDRegisterCart.create({
                    items: [
                        IDRegisterItem.create({
                            id: uuidv4(),
                            replaceRegistrationIds: [],
                            options: [
                                RegisterItemOption.create({
                                    option: option1,
                                    amount: 2,
                                    optionMenu,
                                }),
                                RegisterItemOption.create({
                                    option: option2,
                                    amount: 5,
                                    optionMenu,
                                }),
                            ],
                            groupPrice,
                            organizationId: organization.id,
                            groupId: group.id,
                            memberId: member.id,
                        }),
                    ],
                    balanceItems: [
                    ],
                    deleteRegistrationIds: [],
                }),
                administrationFee: 0,
                freeContribution: 0,
                paymentMethod: PaymentMethod.PointOfSale,
                totalPrice: 50,
                customer: null,
            });

            await assertBalances({ member }, []);

            await register(body, organization, token);

            await assertBalances({ member }, [
                {
                    type: BalanceItemType.Registration,
                    amount: 2,
                    unitPrice: 5,
                    price: 10,
                    pricePaid: 0,
                    pricePending: 10,
                    relations: new Map([
                        [
                            BalanceItemRelationType.Group,
                            BalanceItemRelation.create({
                                id: group.id,
                                name: group.settings.name,
                            }),
                        ],
                        [
                            BalanceItemRelationType.GroupOptionMenu,
                            BalanceItemRelation.create({
                                id: optionMenu.id,
                                name: new TranslatedString(optionMenu.name),
                            }),
                        ],
                        [
                            BalanceItemRelationType.GroupOption,
                            BalanceItemRelation.create({
                                id: option1.id,
                                name: new TranslatedString(option1.name),
                            }),
                        ],
                    ]),
                },
                {
                    type: BalanceItemType.Registration,
                    amount: 5,
                    unitPrice: 3,
                    price: 15,
                    pricePaid: 0,
                    pricePending: 15,
                    relations: new Map([
                        [
                            BalanceItemRelationType.Group,
                            BalanceItemRelation.create({
                                id: group.id,
                                name: group.settings.name,
                            }),
                        ],
                        [
                            BalanceItemRelationType.GroupOptionMenu,
                            BalanceItemRelation.create({
                                id: optionMenu.id,
                                name: new TranslatedString(optionMenu.name),
                            }),
                        ],
                        [
                            BalanceItemRelationType.GroupOption,
                            BalanceItemRelation.create({
                                id: option2.id,
                                name: new TranslatedString(option2.name),
                            }),
                        ],
                    ]),
                },
                {
                    type: BalanceItemType.Registration,
                    amount: 1,
                    price: 25,
                    pricePaid: 0,
                    pricePending: 25,
                    relations: new Map([
                        [
                            BalanceItemRelationType.Group,
                            BalanceItemRelation.create({
                                id: group.id,
                                name: group.settings.name,
                            }),
                        ],
                    ]),
                },
            ]);
        });

        test('Should reset free contribution if no options on organization', async () => {
            const { organization, group, groupPrice, token, member, user } = await initData();

            const body = IDRegisterCheckout.create({
                cart: IDRegisterCart.create({
                    items: [
                        IDRegisterItem.create({
                            id: uuidv4(),
                            replaceRegistrationIds: [],
                            options: [],
                            groupPrice,
                            organizationId: organization.id,
                            groupId: group.id,
                            memberId: member.id,
                        }),
                    ],
                    balanceItems: [
                    ],
                    deleteRegistrationIds: [],
                }),
                administrationFee: 0,
                freeContribution: 31,
                paymentMethod: PaymentMethod.PointOfSale,
                totalPrice: 25,
                customer: null,
            });

            const receivableBalanceBefore = await getReceivableBalance(ReceivableBalanceType.user, user.id, organization, token);
            expect(receivableBalanceBefore).toBeDefined();
            expect(receivableBalanceBefore.body.balanceItems.length).toBe(0);
            expect(receivableBalanceBefore.body.amountOpen).toBe(0);

            await register(body, organization, token);

            const receivableBalanceAfter = await getReceivableBalance(ReceivableBalanceType.user, user.id, organization, token);
            expect(receivableBalanceAfter).toBeDefined();
            expect(receivableBalanceAfter.body.balanceItems.length).toBe(1);
            expect(receivableBalanceAfter.body.amountOpen).toBe(0);
            expect(receivableBalanceAfter.body.balanceItems).toEqual(expect.arrayContaining([
                expect.objectContaining({
                    price: 25,
                    pricePaid: 0,
                }),
            ]));
        });

        test('Should create balance item for free contribution', async () => {
            const { organization, group, groupPrice, token, member, user } = await initData();

            organization.meta.recordsConfiguration.freeContribution = FreeContributionSettings.create({
                description: 'free contribution settings',
                amounts: [30, 20],
            });

            await organization.save();

            const body = IDRegisterCheckout.create({
                cart: IDRegisterCart.create({
                    items: [
                        IDRegisterItem.create({
                            id: uuidv4(),
                            replaceRegistrationIds: [],
                            options: [],
                            groupPrice,
                            organizationId: organization.id,
                            groupId: group.id,
                            memberId: member.id,
                        }),
                    ],
                    balanceItems: [
                    ],
                    deleteRegistrationIds: [],
                }),
                administrationFee: 0,
                freeContribution: 30,
                paymentMethod: PaymentMethod.PointOfSale,
                totalPrice: 55,
                customer: null,
            });

            const receivableBalanceBefore = await getReceivableBalance(ReceivableBalanceType.user, user.id, organization, token);
            expect(receivableBalanceBefore).toBeDefined();
            expect(receivableBalanceBefore.body.balanceItems.length).toBe(0);
            expect(receivableBalanceBefore.body.amountOpen).toBe(0);

            await register(body, organization, token);

            const receivableBalanceAfter = await getReceivableBalance(ReceivableBalanceType.user, user.id, organization, token);
            expect(receivableBalanceAfter).toBeDefined();
            expect(receivableBalanceAfter.body.balanceItems.length).toBe(2);
            expect(receivableBalanceAfter.body.amountPending).toBe(55);

            expect(receivableBalanceAfter.body.balanceItems).toEqual(expect.arrayContaining([
                expect.objectContaining({
                    price: 30,
                    pricePaid: 0,
                    type: BalanceItemType.FreeContribution,
                }),
                expect.objectContaining({
                    price: 25,
                    pricePaid: 0,
                }),
            ]));
        });

        test('Should create balance item for free administration fee if register by member', async () => {
            const { organization, group, groupPrice, token, member, user } = await initData();

            organization.meta.registrationPaymentConfiguration.administrationFee = AdministrationFeeSettings.create({
                fixed: 33,
            });

            await organization.save();

            const body = IDRegisterCheckout.create({
                cart: IDRegisterCart.create({
                    items: [
                        IDRegisterItem.create({
                            id: uuidv4(),
                            replaceRegistrationIds: [],
                            options: [],
                            groupPrice,
                            organizationId: organization.id,
                            groupId: group.id,
                            memberId: member.id,
                        }),
                    ],
                    balanceItems: [
                    ],
                    deleteRegistrationIds: [],
                }),
                administrationFee: 33,
                freeContribution: 0,
                paymentMethod: PaymentMethod.PointOfSale,
                totalPrice: 58,
            });

            const receivableBalanceBefore = await getReceivableBalance(ReceivableBalanceType.user, user.id, organization
                , token);
            expect(receivableBalanceBefore).toBeDefined();
            expect(receivableBalanceBefore.body.balanceItems.length).toBe(0);
            expect(receivableBalanceBefore.body.amountOpen).toBe(0);

            await register(body, organization, token);

            const receivableBalanceAfter = await getReceivableBalance(ReceivableBalanceType.user, user.id, organization, token);
            expect(receivableBalanceAfter).toBeDefined();
            expect(receivableBalanceAfter.body.balanceItems.length).toBe(2);
            expect(receivableBalanceAfter.body.amountPending).toBe(58);

            expect(receivableBalanceAfter.body.balanceItems).toEqual(expect.arrayContaining([
                expect.objectContaining({
                    price: 25,
                    pricePaid: 0,
                    type: BalanceItemType.Registration,
                }),
                expect.objectContaining({
                    price: 33,
                    pricePaid: 0,
                    type: BalanceItemType.AdministrationFee,
                }),
            ]));
        });

        test('Should create balance item for cart item', async () => {
            const { organization, group, groupPrice, token, member, user } = await initData();

            const balanceItem1 = await new BalanceItemFactory({
                organizationId: organization.id,
                memberId: member.id,
                userId: user.id,
                payingOrganizationId: organization.id,
                type: BalanceItemType.Registration,
                amount: 10,
                unitPrice: 2,
            }).create();

            const cartItem = BalanceItemCartItem.create({
                item: balanceItem1.getStructure(),
                price: 10,
            });

            const body = IDRegisterCheckout.create({
                cart: IDRegisterCart.create({
                    items: [
                        IDRegisterItem.create({
                            id: uuidv4(),
                            replaceRegistrationIds: [],
                            options: [],
                            groupPrice,
                            organizationId: organization.id,
                            groupId: group.id,
                            memberId: member.id,
                        }),
                    ],
                    balanceItems: [
                        cartItem,
                    ],
                    deleteRegistrationIds: [],
                }),
                administrationFee: 0,
                freeContribution: 0,
                paymentMethod: PaymentMethod.PointOfSale,
                totalPrice: 35,
            });

            const response = await register(body, organization, token);
            expect(response.body.registrations.length).toBe(1);

            const receivableBalanceAfter = await getReceivableBalance(ReceivableBalanceType.user, user.id, organization, token);

            expect(receivableBalanceAfter.body.balanceItems.length).toBe(2);
            expect(receivableBalanceAfter.body.amountPending).toBe(35);
            expect(receivableBalanceAfter.body.amountOpen).toBe(10);

            expect(receivableBalanceAfter.body.balanceItems).toEqual(expect.arrayContaining([
                expect.objectContaining({
                    pricePending: 10,
                }),
                expect.objectContaining({
                    pricePending: 25,
                }),
            ]));
        });

        test('Should apply reduced price if member requires financial support', async () => {
            const { organization, group, groupPrice, token, member } = await initData();
            member.details.requiresFinancialSupport = BooleanStatus.create({
                value: true,
            });

            await member.save();

            const body = IDRegisterCheckout.create({
                cart: IDRegisterCart.create({
                    items: [
                        IDRegisterItem.create({
                            id: uuidv4(),
                            replaceRegistrationIds: [],
                            options: [],
                            groupPrice,
                            organizationId: organization.id,
                            groupId: group.id,
                            memberId: member.id,
                        }),
                    ],
                    balanceItems: [
                    ],
                    deleteRegistrationIds: [],
                }),
                administrationFee: 0,
                freeContribution: 0,
                paymentMethod: PaymentMethod.PointOfSale,
                totalPrice: 21,
                customer: null,
            });

            await assertBalances({ member }, []);

            await register(body, organization, token);

            await assertBalances({ member }, [
                {
                    unitPrice: 21,
                    amount: 1,
                    pricePaid: 0,
                    pricePending: 21,
                    priceOpen: 0,
                    type: BalanceItemType.Registration,
                    status: BalanceItemStatus.Due,
                },
            ]);
        });

        test('Should apply reduced price for options if member requires financial support', async () => {
            const { organization, group, groupPrice, token, member } = await initData();
            member.details.requiresFinancialSupport = BooleanStatus.create({
                value: true,
            });

            await member.save();

            const option1 = GroupOption.create({
                name: 'option 1',
                price: ReduceablePrice.create({
                    price: 5,
                    reducedPrice: 3,
                }),
            });

            const option2 = GroupOption.create({
                name: 'option 2',
                price: ReduceablePrice.create({
                    price: 3,
                    reducedPrice: 1,
                }),
            });

            const optionMenu = GroupOptionMenu.create({
                name: 'option menu 1',
                multipleChoice: true,
                options: [option1, option2],
            });

            group.settings.optionMenus = [
                optionMenu,
            ];

            await group.save();

            const body = IDRegisterCheckout.create({
                cart: IDRegisterCart.create({
                    items: [
                        IDRegisterItem.create({
                            id: uuidv4(),
                            replaceRegistrationIds: [],
                            options: [
                                RegisterItemOption.create({
                                    option: option1,
                                    amount: 2,
                                    optionMenu,
                                }),
                                RegisterItemOption.create({
                                    option: option2,
                                    amount: 5,
                                    optionMenu,
                                }),
                            ],
                            groupPrice,
                            organizationId: organization.id,
                            groupId: group.id,
                            memberId: member.id,
                        }),
                    ],
                    balanceItems: [
                    ],
                    deleteRegistrationIds: [],
                }),
                administrationFee: 0,
                freeContribution: 0,
                paymentMethod: PaymentMethod.PointOfSale,
                totalPrice: 32,
                customer: null,
            });

            await assertBalances({ member }, []);

            await register(body, organization, token);

            await assertBalances({ member }, [
                {
                    unitPrice: 3,
                    amount: 2,
                    pricePending: 6,
                    pricePaid: 0,
                    status: BalanceItemStatus.Due,
                },
                {
                    unitPrice: 21,
                    pricePaid: 0,
                    pricePending: 21,
                    amount: 1,
                    status: BalanceItemStatus.Due,
                },
                {
                    unitPrice: 1,
                    pricePaid: 0,
                    pricePending: 5,
                    amount: 5,
                    status: BalanceItemStatus.Due,
                },
            ]);
        });
    });

    describe('Delete registrations', () => {
        test('Should cancel balance item for deleted registration', async () => {
            const { member, group: group1, groupPrice: groupPrice1, organization, token } = await initData();

            const body1 = IDRegisterCheckout.create({
                cart: IDRegisterCart.create({
                    items: [
                        IDRegisterItem.create({
                            id: uuidv4(),
                            replaceRegistrationIds: [],
                            options: [],
                            groupPrice: groupPrice1,
                            organizationId: organization.id,
                            groupId: group1.id,
                            memberId: member.id,
                        }),
                    ],
                }),
                administrationFee: 0,
                freeContribution: 0,
                paymentMethod: PaymentMethod.PointOfSale,
                totalPrice: 25,
                customer: null,
            });

            const response1 = await register(body1, organization, token);
            expect(response1.body).toBeDefined();
            expect(response1.body.registrations.length).toBe(1);

            const registrationToDelete = response1.body.registrations[0];

            await assertBalances({ member }, [
                {
                    unitPrice: 25,
                    pricePaid: 0,
                    status: BalanceItemStatus.Due,
                    pricePending: 25,
                    priceOpen: 0,
                    registrationId: registrationToDelete.id,
                },
            ]);

            const group = await new GroupFactory({
                organization,
                price: 30,
                stock: 5,
            }).create();

            const groupPrice = group.settings.prices[0];

            const body2 = IDRegisterCheckout.create({
                cart: IDRegisterCart.create({
                    items: [
                        IDRegisterItem.create({
                            id: uuidv4(),
                            groupPrice,
                            organizationId: organization.id,
                            groupId: group.id,
                            memberId: member.id,
                        }),
                    ],
                    deleteRegistrationIds: [registrationToDelete.id],
                }),
                totalPrice: 30 - 25,
                asOrganizationId: organization.id,
            });

            await register(body2, organization, token);

            await assertBalances({ member }, [
                {
                    unitPrice: 25,
                    amount: 1,
                    pricePaid: 0,
                    status: BalanceItemStatus.Canceled,
                    registrationId: registrationToDelete.id,
                    pricePending: 25,
                    priceOpen: -25,
                },
                {
                    unitPrice: 30,
                    pricePaid: 0,
                    status: BalanceItemStatus.Due,
                    priceOpen: 30,
                    pricePending: 0,
                },
            ]);
        });

        test('Should cancel all related balance item for deleted registration', async () => {
            const { member, group: group1, groupPrice: groupPrice1, organization, token } = await initData();

            const option1 = GroupOption.create({
                name: 'option 1',
                price: ReduceablePrice.create({
                    price: 5,
                    reducedPrice: 3,
                }),
            });

            const option2 = GroupOption.create({
                name: 'option 2',
                price: ReduceablePrice.create({
                    price: 3,
                    reducedPrice: 1,
                }),
            });

            const optionMenu = GroupOptionMenu.create({
                name: 'option menu 1',
                multipleChoice: true,
                options: [option1, option2],
            });

            group1.settings.optionMenus = [
                optionMenu,
            ];

            await group1.save();

            const body1 = IDRegisterCheckout.create({
                cart: IDRegisterCart.create({
                    items: [
                        IDRegisterItem.create({
                            id: uuidv4(),
                            options: [
                                RegisterItemOption.create({
                                    option: option1,
                                    amount: 2,
                                    optionMenu,
                                }),
                                RegisterItemOption.create({
                                    option: option2,
                                    amount: 5,
                                    optionMenu,
                                }),
                            ],
                            groupPrice: groupPrice1,
                            organizationId: organization.id,
                            groupId: group1.id,
                            memberId: member.id,
                        }),
                    ],
                }),
                totalPrice: 50,
                customer: null,
                asOrganizationId: organization.id,
            });

            const response1 = await register(body1, organization, token);
            expect(response1.body).toBeDefined();
            expect(response1.body.registrations.length).toBe(1);

            const registrationToDelete = response1.body.registrations[0];

            await assertBalances({ member }, [
                {
                    unitPrice: 5,
                    amount: 2,
                    pricePending: 0,
                    priceOpen: 10,
                    status: BalanceItemStatus.Due,
                    registrationId: registrationToDelete.id,
                },
                {
                    unitPrice: 3,
                    amount: 5,
                    pricePending: 0,
                    priceOpen: 15,
                    status: BalanceItemStatus.Due,
                    registrationId: registrationToDelete.id,
                },
                {
                    unitPrice: 25,
                    pricePending: 0,
                    priceOpen: 25,
                    status: BalanceItemStatus.Due,
                    registrationId: registrationToDelete.id,
                },
            ]);

            const group = await new GroupFactory({
                organization,
                price: 30,
                stock: 5,
            }).create();

            const groupPrice = group.settings.prices[0];

            const body2 = IDRegisterCheckout.create({
                cart: IDRegisterCart.create({
                    items: [
                        IDRegisterItem.create({
                            id: uuidv4(),
                            groupPrice,
                            organizationId: organization.id,
                            groupId: group.id,
                            memberId: member.id,
                        }),
                    ],
                    deleteRegistrationIds: [registrationToDelete.id],
                }),
                totalPrice: 30 - 50,
                asOrganizationId: organization.id,
            });

            await register(body2, organization, token);

            await assertBalances({ member }, [
                {
                    unitPrice: 5,
                    amount: 2,
                    pricePending: 0,
                    priceOpen: 0,
                    status: BalanceItemStatus.Canceled,
                    registrationId: registrationToDelete.id,
                },
                {
                    unitPrice: 3,
                    amount: 5,
                    pricePending: 0,
                    priceOpen: 0,
                    status: BalanceItemStatus.Canceled,
                    registrationId: registrationToDelete.id,
                },
                {
                    unitPrice: 25,
                    pricePending: 0,
                    priceOpen: 0,
                    status: BalanceItemStatus.Canceled,
                    registrationId: registrationToDelete.id,
                },
                {
                    unitPrice: 30,
                    pricePaid: 0,
                    amount: 1,
                    status: BalanceItemStatus.Due,
                    pricePending: 0,
                    priceOpen: 30,
                },
            ]);
        });

        test('Should apply cancelation fee', async () => {
            const { member, group: group1, groupPrice: groupPrice1, organization, token } = await initData();

            const body1 = IDRegisterCheckout.create({
                cart: IDRegisterCart.create({
                    items: [
                        IDRegisterItem.create({
                            id: uuidv4(),
                            groupPrice: groupPrice1,
                            organizationId: organization.id,
                            groupId: group1.id,
                            memberId: member.id,
                        }),
                    ],
                }),
                totalPrice: 25,
                asOrganizationId: organization.id,
            });

            const response1 = await register(body1, organization, token);
            expect(response1.body).toBeDefined();
            expect(response1.body.registrations.length).toBe(1);

            const registrationToDelete = response1.body.registrations[0];

            await assertBalances({ member }, [
                {
                    unitPrice: 25,
                    pricePaid: 0,
                    status: BalanceItemStatus.Due,
                    type: BalanceItemType.Registration,
                    pricePending: 0,
                    priceOpen: 25,
                    registrationId: registrationToDelete.id,
                },
            ]);

            const group = await new GroupFactory({
                organization,
                price: 30,
                stock: 5,
            }).create();

            const groupPrice = group.settings.prices[0];

            const body2 = IDRegisterCheckout.create({
                cart: IDRegisterCart.create({
                    items: [
                        IDRegisterItem.create({
                            id: uuidv4(),
                            replaceRegistrationIds: [],
                            options: [],
                            groupPrice,
                            organizationId: organization.id,
                            groupId: group.id,
                            memberId: member.id,
                        }),
                    ],
                    deleteRegistrationIds: [registrationToDelete.id],
                }),
                totalPrice: 30 - 25 + 5, // 20% of 25 is 5
                asOrganizationId: organization.id,
                cancellationFeePercentage: 20_00,
            });

            await register(body2, organization, token);
            await assertBalances({ member }, [
                {
                    unitPrice: 25,
                    pricePaid: 0,
                    status: BalanceItemStatus.Canceled,
                    pricePending: 0,
                    priceOpen: 0,
                    type: BalanceItemType.Registration,
                    registrationId: registrationToDelete.id,
                },
                {
                    unitPrice: 5,
                    pricePaid: 0,
                    pricePending: 0,
                    priceOpen: 5,
                    amount: 1,
                    type: BalanceItemType.CancellationFee,
                    status: BalanceItemStatus.Due,
                    registrationId: registrationToDelete.id,
                },
                {
                    unitPrice: 30,
                    pricePaid: 0,
                    pricePending: 0,
                    priceOpen: 30,
                    amount: 1,
                    status: BalanceItemStatus.Due,
                    type: BalanceItemType.Registration,
                },
            ]);
        });
    });

    describe('Register for group with default age group', () => {
        test('Should create membership', async () => {
            const date = new Date('2023-05-14');
            jest.useFakeTimers({ advanceTimers: true, doNotFake: ['setTimeout', 'clearTimeout', 'hrtime', 'nextTick', 'performance', 'queueMicrotask', 'setImmediate', 'clearImmediate'] }).setSystemTime(date);

            const platformMembershipTypeConfig = PlatformMembershipTypeConfig.create({
                startDate: period.startDate,
                endDate: period.endDate,
            });

            const platformMembershipType = PlatformMembershipType.create({
                name: 'werkjaar',
                periods: new Map([
                    [period.id, platformMembershipTypeConfig],
                ]),
            });

            const platform = await Platform.getForEditing();

            platform.config.membershipTypes = [
                platformMembershipType,
            ];

            const defaultAgeGroup = DefaultAgeGroup.create({
                names: ['test groep'],
                defaultMembershipTypeId: platformMembershipType.id,
            });

            platform.config.defaultAgeGroups = [defaultAgeGroup];

            await platform.save();

            const { member, group, groupPrice, organization, token } = await initData();

            // todo: remove from initData
            member.organizationId = null;
            await member.save();

            group.defaultAgeGroupId = defaultAgeGroup.id;
            await group.save();

            const organizationPeriod = new OrganizationRegistrationPeriod();
            organizationPeriod.organizationId = organization.id;
            organizationPeriod.periodId = period.id;
            await organizationPeriod.save();

            const body = IDRegisterCheckout.create({
                cart: IDRegisterCart.create({
                    items: [
                        IDRegisterItem.create({
                            id: uuidv4(),
                            groupPrice: groupPrice,
                            organizationId: organization.id,
                            groupId: group.id,
                            memberId: member.id,
                            trial: false,
                        }),
                    ],
                }),
                totalPrice: 25,
                asOrganizationId: organization.id,
            });

            // act and assert
            const familyBefore = await getMemberFamily(member.id, organization, token);
            expect(familyBefore).toBeDefined();
            expect(familyBefore.body.members.length).toBe(1);
            expect(familyBefore.body.members[0]).toBeDefined();
            expect(familyBefore.body.members[0].platformMemberships.length).toBe(0);

            const response = await register(body, organization, token);

            expect(response.body).toBeDefined();
            expect(response.body.registrations.length).toBe(1);

            await PlatformMembershipService.updateMembershipsForId(member.id, false);

            const familyAfter = await getMemberFamily(member.id, organization, token);
            expect(familyAfter).toBeDefined();
            expect(familyAfter.body.members.length).toBe(1);
            expect(familyAfter.body.members[0]).toBeDefined();
            expect(familyAfter.body.members[0].platformMemberships.length).toBe(1);
            expect(familyAfter.body.members[0].platformMemberships[0].membershipTypeId).toBe(platformMembershipType.id);
        }, 20_000);

        test('Should set trial until on membership if trial', async () => {
            const date = new Date('2023-05-14');
            jest.useFakeTimers({ advanceTimers: true, doNotFake: ['setTimeout', 'clearTimeout', 'hrtime', 'nextTick', 'performance', 'queueMicrotask', 'setImmediate', 'clearImmediate'] }).setSystemTime(date);

            try {
                const platformMembershipTypeConfig = PlatformMembershipTypeConfig.create({
                    startDate: period.startDate,
                    endDate: period.endDate,
                    trialDays: 10,
                });

                const platformMembershipType = PlatformMembershipType.create({
                    name: 'werkjaar',
                    periods: new Map([
                        [period.id, platformMembershipTypeConfig],
                    ]),
                });

                const platform = await Platform.getForEditing();

                platform.config.membershipTypes = [
                    platformMembershipType,
                ];

                const defaultAgeGroup = DefaultAgeGroup.create({
                    names: ['test groep'],
                    defaultMembershipTypeId: platformMembershipType.id,
                });

                platform.config.defaultAgeGroups = [defaultAgeGroup];

                await platform.save();

                const { member, group, groupPrice, organization, token } = await initData();

                // todo: remove from initData
                member.organizationId = null;
                await member.save();

                group.settings.trialDays = 5;
                group.defaultAgeGroupId = defaultAgeGroup.id;
                await group.save();

                const organizationPeriod = new OrganizationRegistrationPeriod();
                organizationPeriod.organizationId = organization.id;
                organizationPeriod.periodId = period.id;
                await organizationPeriod.save();

                const body = IDRegisterCheckout.create({
                    cart: IDRegisterCart.create({
                        items: [
                            IDRegisterItem.create({
                                id: uuidv4(),
                                groupPrice: groupPrice,
                                organizationId: organization.id,
                                groupId: group.id,
                                memberId: member.id,
                                trial: true,
                            }),
                        ],
                    }),
                    totalPrice: 0,
                    asOrganizationId: organization.id,
                });

                // act and assert
                const familyBefore = await getMemberFamily(member.id, organization, token);
                expect(familyBefore).toBeDefined();
                expect(familyBefore.body.members.length).toBe(1);
                expect(familyBefore.body.members[0]).toBeDefined();
                expect(familyBefore.body.members[0].platformMemberships.length).toBe(0);

                const response = await register(body, organization, token);

                expect(response.body).toBeDefined();
                expect(response.body.registrations.length).toBe(1);

                const familyAfter = await getMemberFamily(member.id, organization, token);
                expect(familyAfter).toBeDefined();
                expect(familyAfter.body.members.length).toBe(1);
                expect(familyAfter.body.members[0]).toBeDefined();
                expect(familyAfter.body.members[0].platformMemberships.length).toBe(1);
                expect(familyAfter.body.members[0].platformMemberships[0].membershipTypeId).toBe(platformMembershipType.id);

                const trialUntil = familyAfter.body.members[0].platformMemberships[0].trialUntil;

                expect(trialUntil).not.toBeNull();
                expect(trialUntil!.getFullYear()).toBe(2023);
                expect(trialUntil!.getMonth()).toBe(4);
                expect(trialUntil!.getDate()).toBe(19);
            }
            finally {
                jest.useRealTimers().resetAllMocks();
            }
        });
    });
});
