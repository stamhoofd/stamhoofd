import { Request } from '@simonbackx/simple-endpoints';
import { BalanceItemFactory, GroupFactory, MemberFactory, MemberWithRegistrations, Organization, OrganizationFactory, Platform, RegistrationFactory, RegistrationPeriod, RegistrationPeriodFactory, Token, UserFactory } from '@stamhoofd/models';
import { AdministrationFeeSettings, BalanceItemCartItem, BalanceItemType, DefaultAgeGroup, FreeContributionSettings, GroupOption, GroupOptionMenu, IDRegisterCart, IDRegisterCheckout, IDRegisterItem, PaymentMethod, PermissionLevel, Permissions, PlatformMembershipType, PlatformMembershipTypeConfig, ReceivableBalanceType, ReduceablePrice, RegisterItemOption, Version } from '@stamhoofd/structures';
import { v4 as uuidv4 } from 'uuid';
import { RegisterMembersEndpoint } from '../../src/endpoints/global/registration/RegisterMembersEndpoint';
import { GetMemberBalanceEndpoint } from '../../src/endpoints/organization/dashboard/payments/GetMemberBalanceEndpoint';
import { GetReceivableBalanceEndpoint } from '../../src/endpoints/organization/dashboard/receivable-balances/GetReceivableBalanceEndpoint';
import { testServer } from '../helpers/TestServer';

describe('Endpoint.RegisterMembers', () => {
    // #region global
    const registerEndpoint = new RegisterMembersEndpoint();
    const memberBalanceEndpoint = new GetMemberBalanceEndpoint();
    const receivableBalancesEndpoint = new GetReceivableBalanceEndpoint();

    let period: RegistrationPeriod;

    // #region helpers
    const register = async (body: IDRegisterCheckout, organization: Organization, token: Token) => {
        const request = Request.buildJson('POST', `/v${Version}/members/register`, organization.getApiHost(), body);
        request.headers.authorization = 'Bearer ' + token.accessToken;
        return await testServer.test(registerEndpoint, request);
    };

    const getBalance = async (memberId: string, organization: Organization, token: Token) => {
        const request = Request.buildJson('GET', `/v${Version}/organization/members/${memberId}/balance`, organization.getApiHost());
        request.headers.authorization = 'Bearer ' + token.accessToken;
        return await testServer.test(memberBalanceEndpoint, request);
    };

    const getReceivableBalance = async (type: ReceivableBalanceType, id: string, organization: Organization, token: Token) => {
        const request = Request.buildJson('GET', `/v${Version}/receivable-balances/${type}/${id}`, organization.getApiHost());
        request.headers.authorization = 'Bearer ' + token.accessToken;
        return await testServer.test(receivableBalancesEndpoint, request);
    };
    // #endregion

    // #endregion

    beforeAll(async () => {
        period = await new RegistrationPeriodFactory({}).create();
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

        const member = await new MemberFactory({ organization, user })
            .create();

        const otherMembers: MemberWithRegistrations[] = [];

        for (let i = 0; i < otherMemberAmount; i++) {
            otherMembers.push(await new MemberFactory({ organization, user })
                .create());
        }

        const group = await new GroupFactory({
            organization,
            price: 25,
            stock: 5,
        })
            .create();

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

    describe('Register', () => {
        test('Register by member should create balance for member', async () => {
            // #region arrange
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
            // #endregion

            // #region act and assert
            const balanceBefore = await getBalance(member.id, organization, token);
            expect(balanceBefore).toBeDefined();
            expect(balanceBefore.body.length).toBe(0);

            await register(body, organization, token);

            const balance = await getBalance(member.id, organization, token);
            expect(balance).toBeDefined();
            expect(balance.body.length).toBe(1);
            expect(balance.body[0].price).toBe(25);
            expect(balance.body[0].pricePaid).toBe(0);
            // #endregion
        });

        // todo: test max option + allowAmount
        // todo: test stock?
        // todo: test reduced price?

        test('Should create balance items for options', async () => {
            // #region arrange
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
            // #endregion

            // #region act and assert
            const balanceBefore = await getBalance(member.id, organization, token);
            expect(balanceBefore).toBeDefined();
            expect(balanceBefore.body.length).toBe(0);

            await register(body, organization, token);

            const balance = await getBalance(member.id, organization, token);
            expect(balance).toBeDefined();
            expect(balance.body.length).toBe(3);
            expect(balance.body).toEqual(expect.arrayContaining([
                expect.objectContaining({
                    price: 25,
                    pricePaid: 0,
                }),
                expect.objectContaining({
                    price: 15,
                    pricePaid: 0,
                }),
                expect.objectContaining({
                    price: 10,
                    pricePaid: 0,
                }),
            ]));
            // #endregion
        });

        test('Should reset free contribution if no options on organization', async () => {
            // #region arrange
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
            // #endregion

            // #region act and assert
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
            // #endregion
        });

        test('Should create balance item for free contribution', async () => {
            // #region arrange
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
            // #endregion

            // #region act and assert
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
            // #endregion
        });

        test('Should create balance item for free administration fee if register by member', async () => {
            // #region arrange
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
            // #endregion

            // #region act and assert
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
            // #endregion
        });

        test('Should create balance item for cart item', async () => {
            // #region arrange
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

            // #endregion

            // #region act and assert
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
            // #endregion
        });
    });

    describe('Delete registrations', () => {
        // todo: should include call to other endpoints?
        test.skip('Should create negative balance items', async () => {
            // #region arrange
            const { member, group: group1, groupPrice: groupPrice1, organization, token } = await initData();

            const registration = await new RegistrationFactory({
                member,
                group: group1,
                groupPrice: groupPrice1,
            }).create();

            const group = await new GroupFactory({
                organization,
                price: 30,
                stock: 5,
            }).create();

            const groupPrice = group.settings.prices[0];

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
                    balanceItems: [],
                    deleteRegistrationIds: [registration.id],
                }),
                administrationFee: 0,
                freeContribution: 0,
                paymentMethod: PaymentMethod.PointOfSale,
                totalPrice: 5,
                asOrganizationId: organization.id,
                customer: null,
            });
            // #endregion

            // #region act and assert
            const response = await register(body, organization, token);

            throw new Error('not implemented');
            // #endregion
        });

        test.skip('Should apply cancelation fee', async () => {
            throw new Error('Not implemented');
        });

        test.skip('Should fail if invalid cancelation fee', async () => {
            throw new Error('Not implemented');
        });
    });

    describe('Register for group with default age group', () => {
        test.skip('Should create membership', async () => {
            throw new Error('Not implemented');
        });

        test.skip('Should set trial period on membership', async () => {
            // #region arrange
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

            const platform = await Platform.getShared();

            platform.config.membershipTypes = [
                platformMembershipType,
            ];

            await platform.save();

            const { member, group, groupPrice, organization, token } = await initData();
            group.settings.trialDays = 5;

            const defaultAgeGroup = DefaultAgeGroup.create({
                names: ['test groep'],
                defaultMembershipTypeId: platformMembershipType.id,
            });

            group.defaultAgeGroupId = defaultAgeGroup.id;
            await group.save();

            const body = IDRegisterCheckout.create({
                cart: IDRegisterCart.create({
                    items: [
                        IDRegisterItem.create({
                            id: uuidv4(),
                            replaceRegistrationIds: [],
                            options: [],
                            groupPrice: groupPrice,
                            organizationId: organization.id,
                            groupId: group.id,
                            memberId: member.id,
                            trial: true,
                        }),
                    ],
                    balanceItems: [],
                    deleteRegistrationIds: [],
                }),
                administrationFee: 0,
                freeContribution: 0,
                paymentMethod: PaymentMethod.PointOfSale,
                totalPrice: 0,
                asOrganizationId: organization.id,
                customer: null,
            });
            // #endregion

            // act
            const response = await register(body, organization, token);

            // assert
            expect(response.body).toBeDefined();
            expect(response.body.registrations.length).toBe(1);
            const trialUntil = response.body.registrations[0].trialUntil;
            expect(trialUntil).not.toBeNull();
            // 2023-05-14
            expect(trialUntil!.getFullYear()).toBe(2023);
            expect(trialUntil!.getMonth()).toBe(4);
            expect(trialUntil!.getDate()).toBe(24);

            throw new Error('Not implemented');
        });
    });
});
