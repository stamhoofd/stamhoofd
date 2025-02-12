import { Request } from '@simonbackx/simple-endpoints';
import { BalanceItem, BalanceItemFactory, Group, GroupFactory, MemberFactory, MemberWithRegistrations, Organization, OrganizationFactory, RegistrationFactory, RegistrationPeriod, RegistrationPeriodFactory, Token, User, UserFactory } from '@stamhoofd/models';
import { BalanceItemCartItem, BalanceItemType, Company, GroupPrice, IDRegisterCart, IDRegisterCheckout, IDRegisterItem, OrganizationPackages, PayconiqAccount, PaymentCustomer, PaymentMethod, PermissionLevel, Permissions, STPackageStatus, STPackageType, UserPermissions, Version } from '@stamhoofd/structures';
import nock from 'nock';
import { v4 as uuidv4 } from 'uuid';
import { testServer } from '../../../../tests/helpers/TestServer';
import { RegisterMembersEndpoint } from './RegisterMembersEndpoint';

const baseUrl = `/v${Version}/members/register`;

describe('Endpoint.RegisterMembers', () => {
    // #region global
    const endpoint = new RegisterMembersEndpoint();
    let period: RegistrationPeriod;
    let organization1: Organization;
    let organization2: Organization;
    let user: User;
    let token1: Token;
    let member: MemberWithRegistrations;
    let group1: Group;
    let groupPrice1: GroupPrice;
    let group2: Group;
    let groupPrice2: GroupPrice;

    // #region helpers
    const post = async (body: IDRegisterCheckout, organization = organization1, token = token1) => {
        const request = Request.buildJson('POST', baseUrl, organization.getApiHost(), body);
        request.headers.authorization = 'Bearer ' + token.accessToken;
        return await testServer.test(endpoint, request);
    };
    // #endregion

    // #endregion

    beforeAll(async () => {
        period = await new RegistrationPeriodFactory({}).create();
        organization1 = await new OrganizationFactory({ period }).create();
        organization2 = await new OrganizationFactory({ period }).create();
        organization1.meta.registrationPaymentConfiguration.paymentMethods = [PaymentMethod.PointOfSale, PaymentMethod.Payconiq];

        organization1.privateMeta.payconiqAccounts = [PayconiqAccount.create({
            id: uuidv4(),
            apiKey: 'test',
            merchantId: 'test',
            profileId: 'test',
            name: 'test',
            iban: 'BE56587127952688', // = random IBAN
            callbackUrl: 'https://example.com',
        })];

        user = await new UserFactory({
            organization: organization1,
            permissions: Permissions.create({
                level: PermissionLevel.Full,
            }),
        }).create();

        token1 = await Token.createToken(user);
        member = await new MemberFactory({ organization: organization1, user }).create();
    });

    const initData = async (otherMemberAmount: number = 0) => {
        const organization = await new OrganizationFactory({ period })
            .create();

        const user = await new UserFactory({
            organization,
            permissions: Permissions.create({
                level: PermissionLevel.Full,
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
        // #region groups
        group1 = await new GroupFactory({
            organization: organization1,
            price: 25,
            stock: 5,
        }).create();

        groupPrice1 = group1.settings.prices[0];

        group2 = await new GroupFactory({
            organization: organization1,
            price: 15,
            stock: 4,
            maxMembers: 1,
        }).create();

        groupPrice2 = group2.settings.prices[0];
        // #endregion
    });

    describe('Register', () => {
        test('Should fail if cannot manage finances', async () => {
            // #region arrange
            const registration = await new RegistrationFactory({
                member,
                group: group1,
                groupPrice: groupPrice1,
            }).create();

            const group = group1;

            const groupPrice = group.settings.prices[0];

            const body = IDRegisterCheckout.create({
                cart: IDRegisterCart.create({
                    items: [
                        IDRegisterItem.create({
                            id: uuidv4(),
                            replaceRegistrationIds: [],
                            options: [],
                            groupPrice,
                            organizationId: organization1.id,
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
                asOrganizationId: organization2.id,
                customer: null,
            });
            // #endregion

            // #region act and assert
            await expect(async () => await post(body))
                .rejects
                .toThrow('No permission to register as this organization for a different organization');
            // #endregion
        });

        test('Should fail if demo limit reached', async () => {
            // #region arrange
            (STAMHOOFD.userMode as string) = 'organization';

            const { member, group, groupPrice, organization, token, otherMembers } = await initData(10);

            organization.meta.packages = OrganizationPackages.create({
                packages: new Map([
                    [STPackageType.TrialMembers, STPackageStatus.create({
                        startDate: new Date(),
                    })],
                ]),
            });

            for (const member of otherMembers) {
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
                        deleteRegistrationIds: [],
                    }),
                    administrationFee: 0,
                    freeContribution: 0,
                    paymentMethod: PaymentMethod.PointOfSale,
                    totalPrice: 25,
                    asOrganizationId: organization.id,
                    customer: null,
                });

                await post(body, organization, token);
            }

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
                    deleteRegistrationIds: [],
                }),
                administrationFee: 0,
                freeContribution: 0,
                paymentMethod: PaymentMethod.PointOfSale,
                totalPrice: 25,
                asOrganizationId: organization.id,
                customer: null,
            });

            // #endregion

            // #region act and assert

            await expect(async () => await post(body, organization, token))
                .rejects
                .toThrow('Too many e-mails limited');
            // #endregion

            (STAMHOOFD.userMode as string) = 'platform';
        });

        test('Should fail if balance items changed', async () => {
            // #region arrange
            const { member, group, user, groupPrice, organization, token } = await initData();

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
                price: 20,
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
                totalPrice: 45,
                customer: null,
            });
            // #endregion

            // #region act and assert
            await balanceItem1.delete();

            await expect(async () => await post(body, organization, token))
                .rejects
                .toThrow(new RegExp('Oeps, één of meerdere openstaande bedragen in jouw winkelmandje zijn aangepast'));
            // #endregion
        });

        test('Should fail when pay balance item as organization', async () => {
            // #region arrange
            const { member, group, user, groupPrice, organization, token } = await initData();

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
                price: 20,
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
                totalPrice: 45,
                asOrganizationId: organization.id,
                customer: null,
            });
            // #endregion

            // #region act and assert
            await expect(async () => await post(body, organization, token))
                .rejects
                .toThrow(new RegExp('Not possible to pay balance items as the organization'));
            // #endregion
        });

        test('Should fail if has no write access for member', async () => {
            // #region arrange
            const { organization, group, groupPrice, token } = await initData();
            const { member: member2 } = await initData();

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
                            memberId: member2.id,
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
            await expect(async () => await post(body, organization, token))
                .rejects
                .toThrow(new RegExp('No permission to register this member'));
            // #endregion
        });

        test('Should fail if empty cart', async () => {
            // #region arrange
            const { member, user, organization, token } = await initData();

            const balanceItem1 = await new BalanceItemFactory({
                organizationId: organization.id,
                memberId: member.id,
                userId: user.id,
                payingOrganizationId: organization.id,
                type: BalanceItemType.Registration,
                amount: 10,
                unitPrice: 2,
            }).create();

            const body = IDRegisterCheckout.create({
                cart: IDRegisterCart.create({
                    items: [
                    ],
                    balanceItems: [
                    ],
                    deleteRegistrationIds: [],
                }),
                administrationFee: 0,
                freeContribution: 0,
                paymentMethod: PaymentMethod.PointOfSale,
                totalPrice: 45,
                customer: null,
            });
            // #endregion

            // #region act and assert
            await balanceItem1.delete();

            await expect(async () => await post(body, organization, token))
                .rejects
                .toThrow(new RegExp('Oeps, jouw mandje is leeg.'));
            // #endregion
        });

        test('Should fail if price changed', async () => {
            // #region arrange
            const { member, group, groupPrice, organization, token } = await initData();

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
                    deleteRegistrationIds: [],
                }),
                administrationFee: 0,
                freeContribution: 0,
                paymentMethod: PaymentMethod.PointOfSale,
                totalPrice: 30,
                asOrganizationId: organization.id,
                customer: null,
            });
            // #endregion

            // #region act and assert

            await expect(async () => await post(body, organization, token))
                .rejects
                .toThrow(new RegExp('Oeps! De prijs is gewijzigd terwijl je aan het afrekenen was'));
            // #endregion
        });

        test('Should fail if member is already registered', async () => {
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
            // register first time
            await post(body, organization, token);

            // second time should fail
            await expect(async () => await post(body, organization, token))
                .rejects
                .toThrow(new RegExp('Already registered'));
            // #endregion
        });

        test.skip('Should fail if duplicate registration in cart', async () => {
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
                totalPrice: 50,
                customer: null,
            });
            // #endregion

            // #region act and assert
            const response = await post(body, organization, token);
            expect(response.body.registrations.length).toBe(1);
            // #endregion
        });

        test('Should fail register by other organization if disabled by group', async () => {
            // #region arrange
            const { organization, group, groupPrice, token, member, user } = await initData();

            const { organization: organization2 } = await initData();

            user.permissions = UserPermissions.create({
                organizationPermissions: new Map([
                    [organization2.id, Permissions.create({
                        level: PermissionLevel.Full,
                    })],
                ]),
            });

            await user.save();

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
                asOrganizationId: organization2.id,
            });
            // #endregion

            // #region act and assert
            await expect(async () => await post(body, organization, token))
                .rejects
                .toThrow(new RegExp('allowRegistrationsByOrganization disabled'));
            // #endregion
        });

        // todo: check what happens if whoWillPayNow = organization and replaceRegistrations contains payingOrganizationId of other organization?

        // todo
        test.skip('replace registrations should set paid as organization on new registration', () => {
            // todo
            throw new Error('Not implemented');
        });

        test('invalid payment method should fail', async () => {
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
                paymentMethod: PaymentMethod.CreditCard,
                totalPrice: 25,
                customer: null,
            });
            // #endregion

            // #region act and assert
            await expect(async () => await post(body, organization, token))
                .rejects
                .toThrow(new RegExp('Oeps, je hebt geen geldige betaalmethode geselecteerd'));
            // #endregion
        });

        test('Should fail if no redirect url for online payment', async () => {
            // #region arrange
            const { organization, group, groupPrice, token, member } = await initData();
            organization.meta.registrationPaymentConfiguration.paymentMethods.push(PaymentMethod.Bancontact);
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
                freeContribution: 0,
                paymentMethod: PaymentMethod.Bancontact,
                totalPrice: 25,
                cancelUrl: new URL('https://www.stamhoofd.be'),
                customer: null,
            });
            // #endregion

            // #region act and assert
            await expect(async () => await post(body, organization, token))
                .rejects
                .toThrow(new RegExp('redirectUrl or cancelUrl is missing'));
            // #endregion
        });

        test('Should fail if no cancel url for online payment', async () => {
            // #region arrange
            const { organization, group, groupPrice, token, member } = await initData();
            organization.meta.registrationPaymentConfiguration.paymentMethods.push(PaymentMethod.Bancontact);
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
                freeContribution: 0,
                paymentMethod: PaymentMethod.Bancontact,
                totalPrice: 25,
                redirectUrl: new URL('https://www.stamhoofd.be'),
                customer: null,
            });
            // #endregion

            // #region act and assert
            await expect(async () => await post(body, organization, token))
                .rejects
                .toThrow(new RegExp('redirectUrl or cancelUrl is missing'));
            // #endregion
        });

        test('Should reserve if group has max members', async () => {
            // #region arrange
            const { organization, group, groupPrice, token, member } = await initData();
            group.settings.maxMembers = 5;
            await group.save();

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
            });
            // #endregion

            // #region act and assert
            const response = await post(body, organization, token);
            expect(response.body.registrations.length).toBe(1);
            expect(response.body.registrations[0].reservedUntil).not.toBeNull();
            // #endregion
        });

        test.skip('should update balance item price paid in database', async () => {
            // #region arrange
            const { organization, group, groupPrice, token, member } = await initData();
            group.settings.maxMembers = 5;
            await group.save();

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
            const response = await post(body, organization, token);
            expect(response.body.registrations.length).toBe(1);

            const balanceItem1Id: string = balanceItem1.id;
            const balanceItem = await BalanceItem.getByID(balanceItem1Id);
            expect(balanceItem).toBeDefined();
            expect(balanceItem!.pricePaid).toBe(10);
            // #endregion
        });

        test('Should reuse existing registration', async () => {
            // #region arrange
            const { organization, group, groupPrice, token, member, user } = await initData();
            group.settings.allowRegistrationsByOrganization = true;
            await group.save();

            user.permissions = UserPermissions.create({
                organizationPermissions: new Map([
                    [organization.id, Permissions.create({
                        level: PermissionLevel.Full,
                    })],
                ]),
            });

            await user.save();

            const group2 = await new GroupFactory({
                organization,
                price: 25,
                stock: 5,
            }).create();

            const firstRegistration = await new RegistrationFactory({
                member,
                group: group2,
                groupPrice: group2.settings.prices[0],
            }).create();

            const body = IDRegisterCheckout.create({
                cart: IDRegisterCart.create({
                    items: [
                        IDRegisterItem.create({
                            id: uuidv4(),
                            replaceRegistrationIds: [firstRegistration.id],
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
                totalPrice: 0,
                asOrganizationId: organization.id,
            });

            // #endregion

            // #region act and assert
            const response = await post(body, organization, token);
            expect(response.body.registrations.length).toBe(1);
            expect(response.body.registrations[0].id).toEqual(firstRegistration.id);
            // #endregion
        });

        test('Should reuse recently deactivated registration', async () => {
            // #region arrange
            const { organization, group, groupPrice, token, member, user } = await initData();
            group.settings.allowRegistrationsByOrganization = true;
            await group.save();

            user.permissions = UserPermissions.create({
                organizationPermissions: new Map([
                    [organization.id, Permissions.create({
                        level: PermissionLevel.Full,
                    })],
                ]),
            });

            await user.save();

            const firstRegistration = await new RegistrationFactory({
                member,
                group,
                groupPrice,
            }).create();

            firstRegistration.deactivatedAt = new Date();
            await firstRegistration.save();

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
                asOrganizationId: organization.id,
            });

            // #endregion

            // #region act and assert
            const response = await post(body, organization, token);
            expect(response.body.registrations.length).toBe(1);
            expect(response.body.registrations[0].id).toEqual(firstRegistration.id);
            // #endregion
        });

        test.skip('should update cached balance items in database', () => {
            throw new Error('Not implemented');
        });

        test.skip('should mark balance items as paid', async () => {
            // #region arrange
            const { organization, group, groupPrice, token, member } = await initData();

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
            const response = await post(body, organization, token);
            expect(response.body.registrations.length).toBe(1);

            const balanceItem1Id: string = balanceItem1.id;
            const balanceItem = await BalanceItem.getByID(balanceItem1Id);
            expect(balanceItem).toBeDefined();
            expect(balanceItem!.pricePaid).toBe(10);
            // #endregion
        });

        test.skip('should update occupancy', () => {
            throw new Error('Not implemented');
        });

        test('Should update registered mebers', async () => {
            // #region arrange
            const body = IDRegisterCheckout.create({
                cart: IDRegisterCart.create({
                    items: [
                        IDRegisterItem.create({
                            id: uuidv4(),
                            replaceRegistrationIds: [],
                            options: [],
                            groupPrice: groupPrice1,
                            organizationId: organization1.id,
                            groupId: group1.id,
                            memberId: member.id,
                        }),
                    ],
                    balanceItems: [],
                    deleteRegistrationIds: [],
                }),
                administrationFee: 0,
                freeContribution: 0,
                paymentMethod: PaymentMethod.PointOfSale,
                totalPrice: 25,
                asOrganizationId: organization1.id,
                customer: null,
            });
            // #endregion

            // act
            const response = await post(body);

            // assert
            expect(response.body).toBeDefined();
            expect(response.body.registrations.length).toBe(1);

            const updatedGroup = await Group.getByID(group1.id);
            expect(updatedGroup!.settings.registeredMembers).toBe(1);
            expect(updatedGroup!.settings.reservedMembers).toBe(0);
        });

        test('Should update reserved members', async () => {
            // #region arrange
            const body = IDRegisterCheckout.create({
                cart: IDRegisterCart.create({
                    items: [
                        IDRegisterItem.create({
                            id: uuidv4(),
                            replaceRegistrationIds: [],
                            options: [],
                            groupPrice: groupPrice2,
                            organizationId: organization1.id,
                            groupId: group2.id,
                            memberId: member.id,
                        }),
                    ],
                    balanceItems: [],
                    deleteRegistrationIds: [],
                }),
                administrationFee: 0,
                freeContribution: 0,
                paymentMethod: PaymentMethod.Payconiq,
                redirectUrl: new URL('https://www.example.com'),
                cancelUrl: new URL('https://www.example.com'),
                totalPrice: 15,
                customer: null,
            });

            nock('https://api.ext.payconiq.com')
                .post('/v3/payments')
                .reply(200, {
                    paymentId: 'testPaymentId',
                    _links: {
                        checkout: {
                            href: 'https://www.example.com',
                        },
                    },
                });
            // #endregion

            // act
            const response = await post(body);

            // assert
            expect(response.body).toBeDefined();
            expect(response.body.registrations.length).toBe(1);

            const updatedGroup = await Group.getByID(group2.id);
            expect(updatedGroup!.settings.registeredMembers).toBe(0);
            expect(updatedGroup!.settings.reservedMembers).toBe(1);
        });

        describe('balance items', () => {
            test.skip('should create balance items', () => {
                // also check options
                throw new Error('Not implemented');
            });

            test.skip('should create balance items for options', () => {
                throw new Error('Not implemented');
            });

            test.skip('should create balance item for free contribution', () => {
                throw new Error('Not implemented');
            });

            test.skip('should create balance item for free administration fee', () => {
                throw new Error('Not implemented');
            });

            // todo (Not possible to pay balance items as the organization)
            test.skip('should fail if organization pays balance items', () => {
                // also check options
                throw new Error('Not implemented');
            });
        });
    });

    describe('Register by other organization', () => {
        test('Should fail if disabled by group', async () => {
            // #region arrange
            const { organization, group, groupPrice, token, member, user } = await initData();

            const { organization: organization2 } = await initData();

            user.permissions = UserPermissions.create({
                organizationPermissions: new Map([
                    [organization2.id, Permissions.create({
                        level: PermissionLevel.Full,
                    })],
                ]),
            });

            await user.save();

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
                asOrganizationId: organization2.id,
            });
            // #endregion

            // #region act and assert
            await expect(async () => await post(body, organization, token))
                .rejects
                .toThrow(new RegExp('allowRegistrationsByOrganization disabled'));
            // #endregion
        });

        test('Should fail if no customer', async () => {
            // #region arrange
            const { organization, group, groupPrice, token, member, user } = await initData();
            group.settings.allowRegistrationsByOrganization = true;
            await group.save();

            const { organization: organization2 } = await initData();

            user.permissions = UserPermissions.create({
                organizationPermissions: new Map([
                    [organization2.id, Permissions.create({
                        level: PermissionLevel.Full,
                    })],
                ]),
            });

            await user.save();

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
                asOrganizationId: organization2.id,
            });
            // #endregion

            // #region act and assert
            await expect(async () => await post(body, organization, token))
                .rejects
                .toThrow(new RegExp('customer is required when paying as an organization'));
            // #endregion
        });

        test('Should fail if no company on customer', async () => {
            // #region arrange
            const { organization, group, groupPrice, token, member, user } = await initData();
            group.settings.allowRegistrationsByOrganization = true;
            await group.save();

            const { organization: organization2 } = await initData();

            user.permissions = UserPermissions.create({
                organizationPermissions: new Map([
                    [organization2.id, Permissions.create({
                        level: PermissionLevel.Full,
                    })],
                ]),
            });

            await user.save();

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
                customer: PaymentCustomer.create({
                    company: null,
                }),
                asOrganizationId: organization2.id,
            });
            // #endregion

            // #region act and assert
            await expect(async () => await post(body, organization, token))
                .rejects
                .toThrow(new RegExp('customer.company is required'));
            // #endregion
        });

        test('Should fail if company does not exist on organization', async () => {
            // #region arrange
            const { organization, group, groupPrice, token, member, user } = await initData();
            group.settings.allowRegistrationsByOrganization = true;
            await group.save();

            const { organization: organization2 } = await initData();

            user.permissions = UserPermissions.create({
                organizationPermissions: new Map([
                    [organization2.id, Permissions.create({
                        level: PermissionLevel.Full,
                    })],
                ]),
            });

            await user.save();

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
                customer: PaymentCustomer.create({
                    company: Company.create({
                        name: 'test company',
                    }),
                }),
                asOrganizationId: organization2.id,
            });
            // #endregion

            // #region act and assert
            await expect(async () => await post(body, organization, token))
                .rejects
                .toThrow(new RegExp('Oeps, de facturatiegegevens die je probeerde te selecteren lijken niet meer te bestaan.'));
            // #endregion
        });

        test('Should set paying organization id', async () => {
            // #region arrange
            const { organization, group, groupPrice, token, member, user } = await initData();
            group.settings.allowRegistrationsByOrganization = true;
            await group.save();

            const { organization: organization2 } = await initData();
            const company = Company.create({
                name: 'test company',
            });

            organization2.meta.companies.push(company);
            await organization2.save();

            user.permissions = UserPermissions.create({
                organizationPermissions: new Map([
                    [organization2.id, Permissions.create({
                        level: PermissionLevel.Full,
                    })],
                ]),
            });

            await user.save();

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
                customer: PaymentCustomer.create({
                    company,
                }),
                asOrganizationId: organization2.id,
            });
            // #endregion

            // #region act and assert
            const response = await post(body, organization, token);
            expect(response.body.registrations.length).toBe(1);
            expect(response.body.registrations[0].payingOrganizationId).toEqual(organization2.id);
            // #endregion
        });
    });

    describe('Replace registrations', () => {
        test('Should update registered members', async () => {
            // #region arrange
            const { organization, group: group1, groupPrice: groupPrice1, token, member } = await initData();

            const registration = await new RegistrationFactory({
                member,
                group: group1,
                groupPrice: groupPrice1,
            })
                .create();

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
                            replaceRegistrationIds: [registration.id],
                            options: [],
                            groupPrice,
                            organizationId: organization.id,
                            groupId: group.id,
                            memberId: member.id,
                        }),
                    ],
                    balanceItems: [],
                    deleteRegistrationIds: [],
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

            // update occupancy to be sure occupancy is 1
            await group1.updateOccupancy();
            expect(group1.settings.registeredMembers).toBe(1);

            // send request and check occupancy
            const response = await post(body, organization, token);

            expect(response.body).toBeDefined();
            expect(response.body.registrations.length).toBe(1);

            const updatedGroup = await Group.getByID(group.id);
            expect(updatedGroup!.settings.registeredMembers).toBe(1);
            expect(updatedGroup!.settings.reservedMembers).toBe(0);

            const updatedGroup1After = await Group.getByID(group1.id);
            // occupancy should go from 1 to 0 because the registration should be replaced
            expect(updatedGroup1After!.settings.registeredMembers).toBe(0);
            expect(updatedGroup1After!.settings.reservedMembers).toBe(0);
            // #endregion
        });

        test('Replace registration by registration of other member should fail', async () => {
            // #region arrange

            const { organization, group: group1, groupPrice: groupPrice1, token, member, otherMembers: [member2] } = await initData(1);

            const registration = await new RegistrationFactory({
                member: member2,
                group: group1,
                groupPrice: groupPrice1,
            })
                .create();

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
                            replaceRegistrationIds: [registration.id],
                            options: [],
                            groupPrice,
                            organizationId: organization.id,
                            groupId: group.id,
                            memberId: member.id,
                        }),
                    ],
                    balanceItems: [],
                    deleteRegistrationIds: [],
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
            await expect(async () => await post(body, organization, token))
                .rejects
                .toThrow(new RegExp('Registration not found'));
            // #endregion
        });

        test('Move registration should fail if admin of same organization', async () => {
            // #region arrange
            const { organization, group: group1, groupPrice: groupPrice1, token, member } = await initData();

            const registration = await new RegistrationFactory({
                member,
                group: group1,
                groupPrice: groupPrice1,
            })
                .create();

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
                            replaceRegistrationIds: [registration.id],
                            options: [],
                            groupPrice,
                            organizationId: organization.id,
                            groupId: group.id,
                            memberId: member.id,
                        }),
                    ],
                    balanceItems: [],
                    deleteRegistrationIds: [],
                }),
                administrationFee: 0,
                freeContribution: 0,
                paymentMethod: PaymentMethod.PointOfSale,
                totalPrice: 5,
                customer: null,
            });
            // #endregion

            // #region act and assert

            // send request and check occupancy
            await expect(async () => await post(body, organization, token)).rejects.toThrow('Not allowed to move registrations');

            // #endregion
        });
    });

    describe('Delete registrations', () => {
        test('Should update registered members', async () => {
            // #region arrange
            const registration = await new RegistrationFactory({
                member,
                group: group1,
                groupPrice: groupPrice1,
            })
                .create();

            const group = await new GroupFactory({
                organization: organization1,
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
                            organizationId: organization1.id,
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
                asOrganizationId: organization1.id,
                customer: null,
            });
            // #endregion

            // #region act and assert

            // update occupancy to be sure occupancy is 1
            await group1.updateOccupancy();
            expect(group1.settings.registeredMembers).toBe(1);

            // send request and check occupancy
            const response = await post(body);

            expect(response.body).toBeDefined();
            expect(response.body.registrations.length).toBe(1);

            const updatedGroup = await Group.getByID(group.id);
            expect(updatedGroup!.settings.registeredMembers).toBe(1);
            expect(updatedGroup!.settings.reservedMembers).toBe(0);

            const updatedGroup1After = await Group.getByID(group1.id);
            // occupancy should go from 1 to 0 because the registration should be deleted
            expect(updatedGroup1After!.settings.registeredMembers).toBe(0);
            expect(updatedGroup1After!.settings.reservedMembers).toBe(0);
            // #endregion
        });

        test('Should throw error if with payment', async () => {
            // #region arrange
            const registration = await new RegistrationFactory({
                member,
                group: group1,
                groupPrice: groupPrice1,
            })
                .create();

            const group = await new GroupFactory({
                organization: organization1,
                price: 30,
                stock: 5,
                maxMembers: 1,
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
                            organizationId: organization1.id,
                            groupId: group.id,
                            memberId: member.id,
                        }),
                    ],
                    balanceItems: [],
                    deleteRegistrationIds: [registration.id],
                }),
                administrationFee: 0,
                freeContribution: 0,
                paymentMethod: PaymentMethod.Payconiq,
                redirectUrl: new URL('https://www.example.com'),
                cancelUrl: new URL('https://www.example.com'),
                totalPrice: 5,
                customer: null,
            });
            // #endregion

            // #region act and assert

            // update occupancy to be sure occupancy is 1
            await group1.updateOccupancy();
            expect(group1.settings.registeredMembers).toBe(1);

            await expect(async () => await post(body)).rejects.toThrow('Permission denied: you are not allowed to delete registrations');
            // #endregion
        });

        test.skip('Should deactivate registration', () => {
            throw new Error('Not implemented');
        });

        test.skip('Should create negative balance items', () => {
            throw new Error('Not implemented');
        });

        test.skip('Should apply cancelation fee', () => {
            throw new Error('Not implemented');
        });

        test.skip('Should fail if no permission to delete registration', () => {
            // todo
            throw new Error('Not implemented');
        });

        test.skip('Should fail if already deleted', () => {
            // todo
            throw new Error('Not implemented');
        });
    });

    describe('Register if trial period', () => {
        test.skip('Register for group with trial should set trail period', () => {
            throw new Error('Not implemented');
        });

        test.skip('Register for platform with trial should set trail period', () => {
            throw new Error('Not implemented');
        });

        // todo
        test.skip('Register for group with trial and platform with trial should ... todo', () => {
            throw new Error('Not implemented');
        });
    });
});
