import { Request } from '@simonbackx/simple-endpoints';
import { EmailMocker } from '@stamhoofd/email';
import { BalanceItem, BalanceItemFactory, Group, GroupFactory, MemberFactory, MemberWithRegistrations, Organization, OrganizationFactory, Registration, RegistrationFactory, RegistrationPeriod, RegistrationPeriodFactory, Token, UserFactory } from '@stamhoofd/models';
import { BalanceItemCartItem, BalanceItemType, Company, GroupOption, GroupOptionMenu, IDRegisterCart, IDRegisterCheckout, IDRegisterItem, OrganizationPackages, PayconiqAccount, PaymentCustomer, PaymentMethod, PermissionLevel, Permissions, ReduceablePrice, RegisterItemOption, STPackageStatus, STPackageType, UserPermissions, Version } from '@stamhoofd/structures';
import nock from 'nock';
import { v4 as uuidv4 } from 'uuid';
import { testServer } from '../../../../tests/helpers/TestServer';
import { RegisterMembersEndpoint } from './RegisterMembersEndpoint';
import { STExpect, TestUtils } from '@stamhoofd/test-utils';

const baseUrl = `/v${Version}/members/register`;

describe('Endpoint.RegisterMembers', () => {
    // #region global
    const endpoint = new RegisterMembersEndpoint();
    let period: RegistrationPeriod;

    // #region helpers
    const post = async (body: IDRegisterCheckout, organization: Organization, token: Token) => {
        const request = Request.buildJson('POST', baseUrl, organization.getApiHost(), body);
        request.headers.authorization = 'Bearer ' + token.accessToken;
        return await testServer.test(endpoint, request);
    };
    // #endregion

    // #endregion

    beforeAll(async () => {
        const previousPeriod = await new RegistrationPeriodFactory({
            startDate: new Date(2022, 0, 1),
            endDate: new Date(2022, 11, 31),
        }).create();

        period = await new RegistrationPeriodFactory({
            startDate: new Date(2023, 0, 1),
            endDate: new Date(2023, 11, 31),
            previousPeriodId: previousPeriod.id,
        }).create();
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    const initOrganization = async (registrationPeriod: RegistrationPeriod = period) => {
        return await new OrganizationFactory({ period: registrationPeriod })
            .create();
    };

    const initData = async ({ otherMemberAmount = 0, permissionLevel = PermissionLevel.Full }: { otherMemberAmount?: number; permissionLevel?: PermissionLevel } = {}) => {
        const organization = await initOrganization(period);

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
            stock: 500,
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

    describe('Register as member', () => {
        test('Should fail if demo limit reached', async () => {
            TestUtils.setEnvironment('userMode', 'organization');
            const { member, group, groupPrice, organization, token, otherMembers } = await initData({ otherMemberAmount: 10 });

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
                customer: null,
            });
            await expect(post(body, organization, token))
                .rejects
                .toThrow(STExpect.simpleError({ code: 'too_many_emails_period' }));

            expect(await EmailMocker.transactional.getSucceededEmails()).toEqual([
                expect.objectContaining({
                    to: '"Stamhoofd" <hallo@stamhoofd.be>',
                    from: '"Ravot" <webmaster@stamhoofd.be>',
                    subject: '[Limiet] Limiet bereikt voor aantal inschrijvingen',
                }),
            ]);
        });

        test('Should fail if balance item deleted', async () => {
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

            const cartItem = BalanceItemCartItem.create({
                item: balanceItem1.getStructure(),
                price: 20,
            });

            const body = IDRegisterCheckout.create({
                cart: IDRegisterCart.create({
                    items: [],
                    balanceItems: [
                        cartItem,
                    ],
                    deleteRegistrationIds: [],
                }),
                administrationFee: 0,
                freeContribution: 0,
                paymentMethod: PaymentMethod.PointOfSale,
                totalPrice: 20,
                customer: null,
            });

            await balanceItem1.delete();

            await expect(async () => await post(body, organization, token))
                .rejects
                .toThrow(new RegExp('Oeps, één of meerdere openstaande bedragen in jouw winkelmandje zijn aangepast'));
        });

        test('Should fail if balance item price difference', async () => {
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

            const cartItem = BalanceItemCartItem.create({
                item: balanceItem1.getStructure(),
                price: 30, // too much
            });

            const body = IDRegisterCheckout.create({
                cart: IDRegisterCart.create({
                    items: [],
                    balanceItems: [
                        cartItem,
                    ],
                    deleteRegistrationIds: [],
                }),
                administrationFee: 0,
                freeContribution: 0,
                paymentMethod: PaymentMethod.PointOfSale,
                totalPrice: 30,
                customer: null,
            });

            await expect(post(body, organization, token))
                .rejects
                .toThrow(STExpect.simpleError({ code: 'changed_price' }));
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
                .toThrow(new RegExp('Member not found'));
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
                totalPrice: groupPrice.price.price + 5, // too much
                customer: null,
            });

            await expect(async () => await post(body, organization, token))
                .rejects
                .toThrow(STExpect.simpleError({ code: 'changed_price' }));
        });

        test('Should fail if member is already registered', async () => {
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

            // register first time
            await post(body, organization, token);

            // second time should fail
            await expect(async () => await post(body, organization, token))
                .rejects
                .toThrow(STExpect.simpleError({ code: 'already_registered' }));
        });

        test('Should fail if duplicate registration in cart', async () => {
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
                }),
                administrationFee: 0,
                freeContribution: 0,
                paymentMethod: PaymentMethod.PointOfSale,
                totalPrice: 50,
                customer: null,
            });

            await expect(async () => await post(body, organization, token))
                .rejects
                .toThrow(STExpect.simpleErrors([
                    { code: 'duplicate_register_item' },
                    { code: 'duplicate_register_item' },
                ]));
        });

        test('Should fail if invalid payment', async () => {
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
                }),
                administrationFee: 0,
                freeContribution: 0,
                paymentMethod: PaymentMethod.Bancontact,
                totalPrice: 25,
                redirectUrl: new URL('https://www.stamhoofd.be'),
                customer: null,
            });

            await expect(async () => await post(body, organization, token))
                .rejects
                .toThrow(new RegExp('redirectUrl or cancelUrl is missing'));
        });

        test('Should not reserve for point of sale payment method if group has max members', async () => {
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
                }),
                administrationFee: 0,
                freeContribution: 0,
                paymentMethod: PaymentMethod.PointOfSale,
                totalPrice: 25,
            });

            const response = await post(body, organization, token);
            expect(response.body.registrations.length).toBe(1);

            const updatedRegistration = (await Registration.getByID(response.body.registrations[0].id))!;
            expect(updatedRegistration.registeredAt).not.toBeNull();
            expect(updatedRegistration.reservedUntil).toBeNull();

            // Check if response is up-to-date (if it fails here, data storage is okay, but returned API response is not up-to-date)
            expect(response.body.registrations[0].registeredAt).not.toBeNull();
            expect(response.body.registrations[0].reservedUntil).toBeNull();
        });

        test('Should reuse recently deactivated registration if it has zero balance', async () => {
            const { organization, group, groupPrice, token, member } = await initData();
            const firstRegistration = await new RegistrationFactory({
                member,
                group: group,
                groupPrice: group.settings.prices[0],
                deactivatedAt: new Date(new Date().getTime() - 1 * 24 * 60 * 60 * 1000), // 1 day ago
            }).create();

            const body = IDRegisterCheckout.create({
                cart: IDRegisterCart.create({
                    items: [
                        IDRegisterItem.create({
                            id: uuidv4(),
                            options: [],
                            groupPrice,
                            organizationId: organization.id,
                            groupId: group.id,
                            memberId: member.id,
                        }),
                    ],
                }),
                administrationFee: 0,
                freeContribution: 0,
                paymentMethod: PaymentMethod.PointOfSale,
                totalPrice: 25,
            });

            const response = await post(body, organization, token);
            expect(response.body.registrations.length).toBe(1);
            expect(response.body.registrations[0].id).toEqual(firstRegistration.id);
        });

        test('Should not reuse existing registration if it is older than 7 days', async () => {
            const { organization, group, groupPrice, token, member } = await initData();

            const firstRegistration = await new RegistrationFactory({
                member,
                group: group,
                groupPrice: group.settings.prices[0],
                deactivatedAt: new Date(new Date().getTime() - 8 * 24 * 60 * 60 * 1000), // 8 days ago
            }).create();

            const body = IDRegisterCheckout.create({
                cart: IDRegisterCart.create({
                    items: [
                        IDRegisterItem.create({
                            id: uuidv4(),
                            options: [],
                            groupPrice,
                            organizationId: organization.id,
                            groupId: group.id,
                            memberId: member.id,
                        }),
                    ],
                }),
                administrationFee: 0,
                freeContribution: 0,
                paymentMethod: PaymentMethod.PointOfSale,
                totalPrice: 25,
            });

            const response = await post(body, organization, token);
            expect(response.body.registrations.length).toBe(1);
            expect(response.body.registrations[0].id).not.toEqual(firstRegistration.id);
        });

        test('Should not reuse existing registration if has a non-zero balance', async () => {
            const { organization, group, groupPrice, token, member, user } = await initData();
            const firstRegistration = await new RegistrationFactory({
                member,
                group,
                groupPrice: group.settings.prices[0],
                deactivatedAt: new Date(new Date().getTime() - 1 * 24 * 60 * 60 * 1000), // 1 day ago
            }).create();

            // Create a balance item for the first registration
            const item = await new BalanceItemFactory({
                organizationId: organization.id,
                memberId: member.id,
                userId: user.id,
                type: BalanceItemType.Registration,
                amount: 1,
                unitPrice: group.settings.prices[0].price.price,
                registrationId: firstRegistration.id,
            }).create();

            // Update outstanding cache
            await BalanceItem.updateOutstanding([item]);

            const body = IDRegisterCheckout.create({
                cart: IDRegisterCart.create({
                    items: [
                        IDRegisterItem.create({
                            id: uuidv4(),
                            options: [],
                            groupPrice,
                            organizationId: organization.id,
                            groupId: group.id,
                            memberId: member.id,
                        }),
                    ],
                }),
                administrationFee: 0,
                freeContribution: 0,
                paymentMethod: PaymentMethod.PointOfSale,
                totalPrice: 25,
            });

            const response = await post(body, organization, token);
            expect(response.body.registrations.length).toBe(1);
            expect(response.body.registrations[0].id).not.toEqual(firstRegistration.id);
        });

        test('Should update registered members', async () => {
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
                    balanceItems: [],
                    deleteRegistrationIds: [],
                }),
                administrationFee: 0,
                freeContribution: 0,
                paymentMethod: PaymentMethod.PointOfSale,
                totalPrice: 25,
                customer: null,
            });
            // #endregion

            // act
            const response = await post(body, organization, token);

            // assert
            expect(response.body).toBeDefined();
            expect(response.body.registrations.length).toBe(1);

            const updatedGroup = await Group.getByID(group.id);
            expect(updatedGroup!.settings.registeredMembers).toBe(1);
            expect(updatedGroup!.settings.reservedMembers).toBe(0);
        });

        test('Should update reserved members', async () => {
            const { member, organization, token } = await initData();

            organization.meta.registrationPaymentConfiguration.paymentMethods = [PaymentMethod.PointOfSale, PaymentMethod.Payconiq];

            organization.privateMeta.payconiqAccounts = [PayconiqAccount.create({
                id: uuidv4(),
                apiKey: 'testKey',
                merchantId: 'test',
                profileId: 'test',
                name: 'test',
                iban: 'BE56587127952688', // = random IBAN
                callbackUrl: 'https://www.example.com',
            })];

            await organization.save();

            const group2 = await new GroupFactory({
                organization,
                price: 15,
                stock: 4,
                maxMembers: 1,
            }).create();

            const groupPrice2 = group2.settings.prices[0];

            const body = IDRegisterCheckout.create({
                cart: IDRegisterCart.create({
                    items: [
                        IDRegisterItem.create({
                            id: uuidv4(),
                            replaceRegistrationIds: [],
                            options: [],
                            groupPrice: groupPrice2,
                            organizationId: organization.id,
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

            // act
            const response = await post(body, organization, token);

            // assert
            expect(response.body).toBeDefined();
            expect(response.body.registrations.length).toBe(1);

            const updatedGroup = await Group.getByID(group2.id);
            expect(updatedGroup!.settings.registeredMembers).toBe(0);
            expect(updatedGroup!.settings.reservedMembers).toBe(1);
        });

        test('Register for group with trial should set trial period', async () => {
            // #region arrange
            const date = new Date('2023-05-14');
            jest.useFakeTimers().setSystemTime(date);

            try {
                const { member, group, groupPrice, organization, token } = await initData();
                group.settings.trialDays = 5;
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
                const response = await post(body, organization, token);

                // assert
                expect(response.body).toBeDefined();
                expect(response.body.registrations.length).toBe(1);
                const trialUntil = response.body.registrations[0].trialUntil;
                expect(trialUntil).not.toBeNull();
                // 2023-05-14
                expect(trialUntil!.getFullYear()).toBe(2023);
                expect(trialUntil!.getMonth()).toBe(4);
                expect(trialUntil!.getDate()).toBe(19);
            }
            finally {
                jest.useFakeTimers().resetAllMocks();
            }
        });

        test('Should update group stock reservations', async () => {
            // #region arrange
            const { organization, group, groupPrice, token, member } = await initData();
            groupPrice.stock = 5;
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
            expect(group?.stockReservations.length).toBe(0);

            await post(body, organization, token);

            const updatedGroup = await Group.getByID(group.id);
            expect(updatedGroup?.stockReservations.length).toBe(1);
            // #endregion
        });

        test('Should fail if group price stock sold out', async () => {
            // #region arrange
            const { organization, group, groupPrice, token, member, otherMembers } = await initData({
                permissionLevel: PermissionLevel.Read, otherMemberAmount: 3 });
            groupPrice.stock = 2;
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
                        ...otherMembers.map(m => IDRegisterItem.create({
                            id: uuidv4(),
                            replaceRegistrationIds: [],
                            options: [],
                            groupPrice,
                            organizationId: organization.id,
                            groupId: group.id,
                            memberId: m.id,
                        })),
                    ],
                    balanceItems: [],
                    deleteRegistrationIds: [],
                }),
                administrationFee: 0,
                freeContribution: 0,
                paymentMethod: PaymentMethod.PointOfSale,
                totalPrice: 75,
                customer: null,
            });
            // #endregion

            // #region act and assert
            expect(group?.stockReservations.length).toBe(0);

            await expect(async () => await post(body, organization, token))
                .rejects
                .toThrow(new RegExp('Maximum reached'));
            // #endregion
        });

        test('Should fail if option stock sold out', async () => {
            // #region arrange
            const { organization, group, groupPrice, token, member } = await initData();

            const option1 = GroupOption.create({
                name: 'option 1',
                stock: 4,
                price: ReduceablePrice.create({
                    price: 5,
                    reducedPrice: 3,
                }),
            });

            const option2 = GroupOption.create({
                name: 'option 2',
                stock: 4,
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
            await expect(async () => await post(body, organization, token))
                .rejects
                .toThrow(new RegExp('Stock empty'));
            // #endregion
        });

        test('Should fail if max option exceeded', async () => {
            // #region arrange
            const { organization, group, groupPrice, token, member } = await initData();

            const option1 = GroupOption.create({
                name: 'option 1',
                stock: 4,
                maximum: 5,
                allowAmount: true,
                price: ReduceablePrice.create({
                    price: 5,
                    reducedPrice: 3,
                }),
            });

            const option2 = GroupOption.create({
                name: 'option 2',
                stock: 5,
                maximum: 2,
                allowAmount: true,
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
            await expect(async () => await post(body, organization, token))
                .rejects
                .toThrow(new RegExp('Option maximum exceeded'));
            // #endregion
        });

        test('Should not fail if max option not exceeded', async () => {
            // #region arrange
            const { organization, group, groupPrice, token, member } = await initData();

            const option1 = GroupOption.create({
                name: 'option 1',
                stock: 4,
                maximum: 5,
                allowAmount: true,
                price: ReduceablePrice.create({
                    price: 5,
                    reducedPrice: 3,
                }),
            });

            const option2 = GroupOption.create({
                name: 'option 2',
                stock: 5,
                maximum: 5,
                allowAmount: true,
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
            const result = await post(body, organization, token);
            expect(result).toBeDefined();
            // #endregion
        });
    });

    describe('Register as organization', () => {
        test('Should reuse recently deactivated registration', async () => {
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

            const response = await post(body, organization, token);
            expect(response.body.registrations.length).toBe(1);
            expect(response.body.registrations[0].id).toEqual(firstRegistration.id);
        });

        test('Deleting registrations should fail if cannot manage finances', async () => {
            const { member, group, groupPrice, organization, token } = await initData();
            const organization2 = await initOrganization();

            const registration = await new RegistrationFactory({
                member,
                group,
                groupPrice,
            }).create();

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
                asOrganizationId: organization2.id,
                customer: null,
            });

            await expect(async () => await post(body, organization, token))
                .rejects
                .toThrow('No permission to register as this organization for a different organization');
        });

        test('Cannot pay balances as organization', async () => {
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

            const cartItem = BalanceItemCartItem.create({
                item: balanceItem1.getStructure(),
                price: 20,
            });

            const body = IDRegisterCheckout.create({
                cart: IDRegisterCart.create({
                    items: [],
                    balanceItems: [
                        cartItem,
                    ],
                    deleteRegistrationIds: [],
                }),
                administrationFee: 0,
                freeContribution: 0,
                paymentMethod: PaymentMethod.PointOfSale,
                totalPrice: 20,
                asOrganizationId: organization.id,
                customer: null,
            });

            await expect(post(body, organization, token))
                .rejects
                .toThrow(STExpect.simpleError({
                    code: 'cannot_pay_balance_items',
                }));
        });
    });

    describe('Register by other organization', () => {
        test('Should fail if disabled by group', async () => {
            const { organization, group, groupPrice, token, member, user } = await initData();
            group.settings.allowRegistrationsByOrganization = false;
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

            await expect(async () => await post(body, organization, token))
                .rejects
                .toThrow(STExpect.simpleError({ code: 'as_organization_disabled' }));
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
                totalPrice: 30,
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

        test('Should set paid as organization on new registration', async () => {
            // #region arrange
            const { organization, group: group1, groupPrice: groupPrice1, token, member, user } = await initData();

            group1.settings.allowRegistrationsByOrganization = true;
            await group1.save();
            const organization2 = await initOrganization();

            user.permissions = UserPermissions.create({
                organizationPermissions: new Map([
                    [organization2.id, Permissions.create({
                        level: PermissionLevel.Full,
                    })],
                    [organization.id, Permissions.create({
                        level: PermissionLevel.Full,
                    })],
                ]),
            });

            await user.save();

            const company = Company.create({
                name: 'test company',
            });

            organization2.meta.companies.push(company);
            await organization2.save();

            organization.meta.companies.push(company);
            await organization.save();

            const body = IDRegisterCheckout.create({
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
                    balanceItems: [],
                    deleteRegistrationIds: [],
                }),
                administrationFee: 0,
                freeContribution: 0,
                paymentMethod: PaymentMethod.PointOfSale,
                totalPrice: 25,
                asOrganizationId: organization2.id,
                customer: PaymentCustomer.create({
                    company,
                }),
            });

            const response1 = await post(body, organization, token);
            const registration = response1.body.registrations[0];
            expect(registration).toBeDefined();

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
                totalPrice: 30 - 25,
                asOrganizationId: organization.id,
                customer: PaymentCustomer.create({
                    company,
                }),
            });
            // #endregion

            // #region act and assert
            const response = await post(body2, organization, token);

            expect(response.body).toBeDefined();
            expect(response.body.registrations.length).toBe(1);

            // the payingOrganizationId should equal the id of the paying organization of the replaced registration
            expect(response.body.registrations[0].payingOrganizationId).toEqual(organization2.id);
            // #endregion
        });

        test('Replace registration by registration of other member should fail', async () => {
            // #region arrange
            const { organization, group: group1, groupPrice: groupPrice1, token, member, otherMembers: [member2] } = await initData({ otherMemberAmount: 1 });

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
            const { member, group: group1, groupPrice: groupPrice1, organization: organization1, token } = await initData();

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
                totalPrice: 30,
                asOrganizationId: organization1.id,
                customer: null,
            });
            // #endregion

            // #region act and assert

            // update occupancy to be sure occupancy is 1
            await group1.updateOccupancy();
            expect(group1.settings.registeredMembers).toBe(1);

            // send request and check occupancy
            const response = await post(body, organization1, token);

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
            const { member, group: group1, groupPrice: groupPrice1, organization: organization1, token } = await initData();

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

            await expect(async () => await post(body, organization1, token)).rejects.toThrow('Permission denied: you are not allowed to delete registrations');
            // #endregion
        });

        test('Should deactivate registration', async () => {
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
                totalPrice: 30,
                asOrganizationId: organization.id,
                customer: null,
            });
            // #endregion

            // #region act and assert
            await post(body, organization, token);

            const updatedRegistration = await Registration.getByID(registration.id);
            expect(updatedRegistration).toBeDefined();
            expect(updatedRegistration!.deactivatedAt).not.toBe(null);
            // #endregion
        });

        test('Should fail if invalid cancelation fee', async () => {
            for (const cancellationFeePercentage of [10001, -1]) {
                // #region arrange
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

                const group2 = await new GroupFactory({
                    organization,
                    price: 30,
                    stock: 5,
                }).create();

                const groupPrice2 = group2.settings.prices[0];

                const firstResponse = await post(body1, organization, token);
                expect(firstResponse).toBeDefined();
                expect(firstResponse.body.registrations.length).toBe(1);
                const registration = firstResponse.body.registrations[0];

                const body2 = IDRegisterCheckout.create({
                    cart: IDRegisterCart.create({
                        items: [
                            IDRegisterItem.create({
                                id: uuidv4(),
                                replaceRegistrationIds: [],
                                options: [],
                                groupPrice: groupPrice2,
                                organizationId: organization.id,
                                groupId: group2.id,
                                memberId: member.id,
                            }),
                        ],
                        balanceItems: [],
                        deleteRegistrationIds: [registration.id],
                    }),
                    cancellationFeePercentage,
                    administrationFee: 0,
                    freeContribution: 0,
                    paymentMethod: PaymentMethod.PointOfSale,
                    totalPrice: 30 - 25 + Math.round(25 * cancellationFeePercentage / 10000),
                    asOrganizationId: organization.id,
                    customer: null,
                });
                // #endregion

                // #region act and assert
                await expect(async () => await post(body2, organization, token))
                    .rejects
                    .toThrow(new RegExp('Invalid cancellation fee percentage.'));
            // #endregion
            }
        });

        test('Delete by member should fail if no permission to delete registration', async () => {
            // #region arrange
            const { member, group: group1, groupPrice: groupPrice1, organization, token } = await initData();

            const registration = await new RegistrationFactory({
                member,
                group: group1,
                groupPrice: groupPrice1,
            }).create();

            const group2 = await new GroupFactory({
                organization,
                price: 30,
                stock: 5,
            }).create();

            const groupPrice = group2.settings.prices[0];

            const body = IDRegisterCheckout.create({
                cart: IDRegisterCart.create({
                    items: [
                        IDRegisterItem.create({
                            id: uuidv4(),
                            replaceRegistrationIds: [],
                            options: [],
                            groupPrice,
                            organizationId: organization.id,
                            groupId: group2.id,
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
                customer: null,
            });
            // #endregion

            // #region act and assert
            await expect(async () => await post(body, organization, token))
                .rejects
                .toThrow(new RegExp('Permission denied: you are not allowed to delete registrations'));
            // #endregion
        });

        test('Delete by organization should fail if no permission to delete registration', async () => {
            // #region arrange
            const { member, group: group1, groupPrice: groupPrice1, organization, token } = await initData({ permissionLevel: PermissionLevel.Read });

            const registration = await new RegistrationFactory({
                member,
                group: group1,
                groupPrice: groupPrice1,
            }).create();

            const body = IDRegisterCheckout.create({
                cart: IDRegisterCart.create({
                    items: [],
                    balanceItems: [],
                    deleteRegistrationIds: [registration.id],
                }),
                administrationFee: 0,
                freeContribution: 0,
                paymentMethod: PaymentMethod.PointOfSale,
                totalPrice: 0,
                customer: null,
                asOrganizationId: organization.id,
            });
            // #endregion

            // #region act and assert
            await expect(async () => await post(body, organization, token)).rejects.toThrow(/No permission to delete this registration/);
            // #endregion
        });

        test('Should fail if registration does not exist anymore', async () => {
            // #region arrange
            const { member, group: group1, groupPrice: groupPrice1, organization, token } = await initData();

            const registration = await new RegistrationFactory({
                member,
                group: group1,
                groupPrice: groupPrice1,
            }).create();

            const group2 = await new GroupFactory({
                organization,
                price: 30,
                stock: 5,
            }).create();

            const groupPrice = group2.settings.prices[0];

            const body = IDRegisterCheckout.create({
                cart: IDRegisterCart.create({
                    items: [
                        IDRegisterItem.create({
                            id: uuidv4(),
                            replaceRegistrationIds: [],
                            options: [],
                            groupPrice,
                            organizationId: organization.id,
                            groupId: group2.id,
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
                customer: null,
                asOrganizationId: organization.id,
            });
            // #endregion

            // #region act and assert
            await registration.delete();
            await expect(async () => await post(body, organization, token)).rejects.toThrow(new RegExp('Registration not found'));
            // #endregion
        });

        test('Should fail if already deleted', async () => {
            // #region arrange
            const { member, group: group1, groupPrice: groupPrice1, organization, token } = await initData();

            const registration = await new RegistrationFactory({
                member,
                group: group1,
                groupPrice: groupPrice1,
            }).create();

            const group2 = await new GroupFactory({
                organization,
                price: 30,
                stock: 5,
            }).create();

            const groupPrice2 = group2.settings.prices[0];

            const group3 = await new GroupFactory({
                organization,
                price: 30,
                stock: 5,
            }).create();

            const groupPrice3 = group3.settings.prices[0];

            const body1 = IDRegisterCheckout.create({
                cart: IDRegisterCart.create({
                    items: [
                        IDRegisterItem.create({
                            id: uuidv4(),
                            replaceRegistrationIds: [],
                            options: [],
                            groupPrice: groupPrice2,
                            organizationId: organization.id,
                            groupId: group2.id,
                            memberId: member.id,
                        }),
                    ],
                    balanceItems: [],
                    deleteRegistrationIds: [registration.id],
                }),
                administrationFee: 0,
                freeContribution: 0,
                paymentMethod: PaymentMethod.PointOfSale,
                totalPrice: 30,
                customer: null,
                asOrganizationId: organization.id,
            });

            const body2 = IDRegisterCheckout.create({
                cart: IDRegisterCart.create({
                    items: [
                        IDRegisterItem.create({
                            id: uuidv4(),
                            replaceRegistrationIds: [],
                            options: [],
                            groupPrice: groupPrice3,
                            organizationId: organization.id,
                            groupId: group3.id,
                            memberId: member.id,
                        }),
                    ],
                    balanceItems: [],
                    deleteRegistrationIds: [registration.id],
                }),
                administrationFee: 0,
                freeContribution: 0,
                paymentMethod: PaymentMethod.PointOfSale,
                totalPrice: 30,
                customer: null,
                asOrganizationId: organization.id,
            });
            // #endregion

            // #region act and assert
            await post(body1, organization, token);
            await expect(async () => await post(body2, organization, token)).rejects.toThrow(/No permission to delete this registration/);
            // #endregion
        });
    });
});
