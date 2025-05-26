import { Request } from '@simonbackx/simple-endpoints';
import { EmailMocker } from '@stamhoofd/email';
import { BalanceItem, BalanceItemFactory, Group, GroupFactory, MemberFactory, MemberWithRegistrations, Organization, OrganizationFactory, OrganizationRegistrationPeriod, OrganizationRegistrationPeriodFactory, Registration, RegistrationFactory, RegistrationPeriod, RegistrationPeriodFactory, Token, User, UserFactory } from '@stamhoofd/models';
import { AppliedRegistrationDiscount, BalanceItemCartItem, BalanceItemStatus, BalanceItemType, BundleDiscount, BundleDiscountGroupPriceSettings, Company, GroupOption, GroupOptionMenu, GroupPrice, GroupPriceDiscount, GroupPriceDiscountType, IDRegisterCart, IDRegisterCheckout, IDRegisterItem, OrganizationPackages, PaymentCustomer, PaymentMethod, PermissionLevel, Permissions, ReduceablePrice, RegisterItemOption, STPackageStatus, STPackageType, TranslatedString, UserPermissions, Version } from '@stamhoofd/structures';
import { STExpect, TestUtils } from '@stamhoofd/test-utils';
import { v4 as uuidv4 } from 'uuid';
import { PayconiqMocker } from '../../../../tests/helpers/PayconiqMocker';
import { testServer } from '../../../../tests/helpers/TestServer';
import { RegisterMembersEndpoint } from './RegisterMembersEndpoint';
import { StripeMocker } from '../../../../tests/helpers/StripeMocker';

const baseUrl = `/v${Version}/members/register`;

describe('Endpoint.RegisterMembers', () => {
    // #region global
    const endpoint = new RegisterMembersEndpoint();
    let period: RegistrationPeriod;
    let defaultPermissionLevel = PermissionLevel.None;
    const post = async (body: IDRegisterCheckout, organization: Organization, token: Token) => {
        const request = Request.buildJson('POST', baseUrl, organization.getApiHost(), body);
        request.headers.authorization = 'Bearer ' + token.accessToken;
        return await testServer.test(endpoint, request);
    };

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

    beforeEach(async () => {
        TestUtils.setEnvironment('userMode', 'platform');

        // Set current date within period
        const date = new Date('2023-05-14');
        jest.useFakeTimers({ now: date, advanceTimers: true });
    });

    afterEach(() => {
        jest.restoreAllMocks();
        jest.useRealTimers();
    });

    const initOrganization = async (registrationPeriod: RegistrationPeriod = period) => {
        const organization = await new OrganizationFactory({ period: registrationPeriod })
            .create();

        const organizationRegistrationPeriod = await new OrganizationRegistrationPeriodFactory({ organization, period: registrationPeriod }).create();

        return { organization, organizationRegistrationPeriod };
    };

    async function assertBalances({ user, balances }: { user: User; balances: Partial<BalanceItem>[] }) {
        // Fetch all user balances
        const userBalances = await BalanceItem.select().where('userId', user.id).fetch();

        try {
            expect(userBalances).toIncludeAllMembers(balances.map(b => expect.objectContaining(b)));
        }
        catch (e) {
            // List all the balances that were found and the ones that were missing
            if (userBalances.length !== balances.length) {
                console.error('Difference in number of balances found:', userBalances.length, 'expected:', balances.length);
            }

            for (const expectedBalance of balances) {
                let found = false;
                for (const userBalance of userBalances) {
                    try {
                        expect(userBalance).toEqual(expect.objectContaining(expectedBalance));
                        found = true;
                    }
                    catch (e) {
                        // ignore
                    }
                }

                if (!found) {
                    console.error('Expected balance not found:', expectedBalance);
                }
            }

            throw e;
        }
    }

    async function initData({ otherMemberAmount = 0, permissionLevel = defaultPermissionLevel }: { otherMemberAmount?: number; permissionLevel?: PermissionLevel } = {}) {
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

        const otherMembers: MemberWithRegistrations[] = [];

        for (let i = 0; i < otherMemberAmount; i++) {
            otherMembers.push(await new MemberFactory({ organization, user })
                .create());
        }

        const group = await new GroupFactory({
            organization,
            price: 25_00,
            stock: 500,
        })
            .create();

        const groupPrice = group.settings.prices[0];

        return {
            organization,
            organizationRegistrationPeriod,
            user,
            token,
            member,
            otherMembers,
            group,
            groupPrice,
        };
    }

    async function initPayconiq({ organization }: { organization: Organization }) {
        organization.meta.registrationPaymentConfiguration.paymentMethods.push(PaymentMethod.Payconiq);
        organization.privateMeta.payconiqAccounts = [PayconiqMocker.generateTestAccount()];
        await organization.save();
    }

    async function initStripe({ organization }: { organization: Organization }) {
        const stripeMocker = new StripeMocker();
        const stripeAccount = await stripeMocker.createStripeAccount(organization.id);

        stripeMocker.start();

        TestUtils.scheduleAfterThisTest(() => {
            stripeMocker.stop();
        });

        organization.meta.registrationPaymentConfiguration.paymentMethods.push(PaymentMethod.Bancontact, PaymentMethod.CreditCard, PaymentMethod.iDEAL);
        organization.privateMeta.registrationPaymentConfiguration.stripeAccountId = stripeAccount.id;
        await organization.save();

        return { stripeMocker, stripeAccount };
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

    async function enableDiscount({ group, groupPrice, bundleDiscount }: { group: Group; groupPrice: GroupPrice; bundleDiscount: BundleDiscount }) {
        groupPrice.bundleDiscounts.set(bundleDiscount.id, BundleDiscountGroupPriceSettings.create({
            name: bundleDiscount.name,
        }));
        await group.save();
    }

    async function initDiscount({ organizationRegistrationPeriod, discount }: { organizationRegistrationPeriod: OrganizationRegistrationPeriod; discount: Parameters<typeof createBundleDiscount>[0] }) {
        const bundleDiscount = createBundleDiscount(discount);
        organizationRegistrationPeriod.settings.bundleDiscounts.push(bundleDiscount);
        await organizationRegistrationPeriod.save();
        return bundleDiscount;
    }

    describe('Register as member', () => {
        beforeEach(() => {
            defaultPermissionLevel = PermissionLevel.None;
        });

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
                    totalPrice: 25_00,
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
                totalPrice: 25_00,
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
                totalPrice: 25_00,
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
                totalPrice: 25_00,
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
                totalPrice: 25_00,
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
                totalPrice: 25_00,
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
                totalPrice: 25_00,
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
                totalPrice: 25_00,
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
                totalPrice: 25_00,
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
                totalPrice: 25_00,
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
                totalPrice: 25_00,
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
                totalPrice: 25_00,
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
            await initPayconiq({ organization });

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

            // act
            const response = await post(body, organization, token);

            // assert
            expect(response.body).toBeDefined();
            expect(response.body.registrations.length).toBe(1);
            expect(response.body.paymentUrl).toMatch(/payconiq\.com/);

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
                totalPrice: 25_00,
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
        beforeEach(() => {
            defaultPermissionLevel = PermissionLevel.Full;
        });

        test('Should reuse recently deactivated registration', async () => {
            const { organization, group, groupPrice, token, member } = await initData();
            group.settings.allowRegistrationsByOrganization = true;
            await group.save();

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
                totalPrice: 25_00,
                asOrganizationId: organization.id,
            });

            const response = await post(body, organization, token);
            expect(response.body.registrations.length).toBe(1);
            expect(response.body.registrations[0].id).toEqual(firstRegistration.id);
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
        beforeEach(() => {
            defaultPermissionLevel = PermissionLevel.Full;
        });

        async function initDualData(options?: Parameters<typeof initData>[0]) {
            const base = await initData(options);

            base.group.settings.allowRegistrationsByOrganization = true;
            await base.group.save();

            // Give the user permission for a different organization
            const { organization: organization2 } = await initOrganization();
            base.user.permissions = UserPermissions.create({
                organizationPermissions: new Map([
                    [organization2.id, Permissions.create({
                        level: options?.permissionLevel ?? defaultPermissionLevel,
                    })],
                ]),
            });
            await base.user.save();

            return {
                ...base,
                organization2,
            };
        }

        test('Should set paying organization id', async () => {
            const { organization, group, groupPrice, member, token, organization2 } = await initDualData();

            const company = Company.create({
                name: 'test company',
            });

            organization2.meta.companies.push(company);
            await organization2.save();

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
                totalPrice: 25_00,
                customer: PaymentCustomer.create({
                    company,
                }),
                asOrganizationId: organization2.id,
            });

            const response = await post(body, organization, token);
            expect(response.body.registrations.length).toBe(1);
            expect(response.body.registrations[0].payingOrganizationId).toEqual(organization2.id);
        });

        test('Should fail if not sufficient permissions', async () => {
            const { organization, group, groupPrice, member, token, organization2 } = await initDualData({ permissionLevel: PermissionLevel.Read });

            const company = Company.create({
                name: 'test company',
            });

            organization2.meta.companies.push(company);
            await organization2.save();

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
                totalPrice: 25_00,
                customer: PaymentCustomer.create({
                    company,
                }),
                asOrganizationId: organization2.id,
            });

            await expect(async () => await post(body, organization, token))
                .rejects
                .toThrow(STExpect.simpleError({ code: 'forbidden' }));
        });

        test('Should fail if disabled by group', async () => {
            const { organization, group, groupPrice, member, token, organization2 } = await initDualData();

            group.settings.allowRegistrationsByOrganization = false;
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
                totalPrice: 25_00,
                customer: null,
                asOrganizationId: organization2.id,
            });

            await expect(async () => await post(body, organization, token))
                .rejects
                .toThrow(STExpect.simpleError({ code: 'as_organization_disabled' }));
        });

        test('Should fail if no customer', async () => {
            const { organization, group, groupPrice, member, token, organization2 } = await initDualData();

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
                totalPrice: 25_00,
                customer: null,
                asOrganizationId: organization2.id,
            });

            await expect(async () => await post(body, organization, token))
                .rejects
                .toThrow(new RegExp('customer is required when paying as an organization'));
        });

        test('Deleting registrations is not allowed', async () => {
            const { member, group, groupPrice, organization, token, organization2 } = await initDualData();

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
                .toThrow(STExpect.simpleError({ code: 'forbidden' }));
        });

        test('Should fail if no company on customer', async () => {
            const { organization, group, groupPrice, member, token, organization2 } = await initDualData();

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
                totalPrice: 25_00,
                customer: PaymentCustomer.create({
                    company: null,
                }),
                asOrganizationId: organization2.id,
            });

            await expect(async () => await post(body, organization, token))
                .rejects
                .toThrow(new RegExp('customer.company is required'));
        });

        test('Should fail if company does not exist on organization', async () => {
            const { organization, group, groupPrice, member, token, organization2 } = await initDualData();

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
                totalPrice: 25_00,
                customer: PaymentCustomer.create({
                    company: Company.create({
                        name: 'test company',
                    }),
                }),
                asOrganizationId: organization2.id,
            });

            await expect(async () => await post(body, organization, token))
                .rejects
                .toThrow(new RegExp('Oeps, de facturatiegegevens die je probeerde te selecteren lijken niet meer te bestaan.'));
        });
    });

    describe('Replace registrations', () => {
        beforeEach(() => {
            defaultPermissionLevel = PermissionLevel.Full;
        });

        test('Should update registered members', async () => {
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
        });

        test('When replacing a registration, we should keep the original paying organization id', async () => {
            const { organization, group: group1, groupPrice: groupPrice1, token, member, user } = await initData();

            group1.settings.allowRegistrationsByOrganization = true;
            await group1.save();
            const { organization: organization2 } = await initOrganization();

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
                totalPrice: 25_00,
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

            const response = await post(body2, organization, token);

            expect(response.body).toBeDefined();
            expect(response.body.registrations.length).toBe(1);

            // the payingOrganizationId should equal the id of the paying organization of the replaced registration
            expect(response.body.registrations[0].payingOrganizationId).toEqual(organization2.id);
        }, 10_000);

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
        beforeEach(() => {
            defaultPermissionLevel = PermissionLevel.Full;
        });

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

        test('Should throw error if deleting registrations as normal member', async () => {
            // #region arrange
            const { member, group: group1, groupPrice: groupPrice1, organization: organization1, token } = await initData();
            await initPayconiq({ organization: organization1 });

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
                paymentMethod: PaymentMethod.Payconiq,
                redirectUrl: new URL('https://www.example.com'),
                cancelUrl: new URL('https://www.example.com'),
                totalPrice: 5,
                customer: null,
            });

            await expect(async () => await post(body, organization1, token)).rejects.toThrow('Permission denied: you are not allowed to delete registrations');
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
                    totalPrice: 25_00,
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

    /**
     * Note: specific calculations are tested in unit tests (which group gets the discount etc), this only tests backend realted logic related to balances
     */
    describe.only('Bundle discounts', () => {
        beforeEach(() => {
            defaultPermissionLevel = PermissionLevel.Full;
        });

        describe('With historic registrations', () => {
            test('Case: Replacing a historic registration causes a change in a different registration\'s discounts', async () => {
                const { organizationRegistrationPeriod, organization, group, groupPrice, member, token, user } = await initData();
                const bundleDiscount = await initDiscount({
                    organizationRegistrationPeriod,
                    discount: {
                        discounts: [
                            { value: 20_00, type: GroupPriceDiscountType.Percentage },
                        ],
                    },
                });
                await enableDiscount({ group, groupPrice, bundleDiscount });

                const group2 = await new GroupFactory({
                    organization,
                    price: 15_00, // Lower price so discount is applied preferably on the first group
                }).create();

                const groupPrice2 = group2.settings.prices[0];

                const group3 = await new GroupFactory({
                    organization,
                    price: 40_00, // Higher price
                }).create();
                const groupPrice3 = group3.settings.prices[0];

                await enableDiscount({ group: group2, groupPrice: groupPrice2, bundleDiscount });
                await enableDiscount({ group: group3, groupPrice: groupPrice3, bundleDiscount });

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
                const { organizationRegistrationPeriod, organization, group, groupPrice, member, token, user } = await initData();
                const { stripeMocker } = await initStripe({ organization });

                const bundleDiscount = await initDiscount({
                    organizationRegistrationPeriod,
                    discount: {
                        discounts: [
                            { value: 20_00, type: GroupPriceDiscountType.Percentage },
                        ],
                    },
                });
                await enableDiscount({ group, groupPrice, bundleDiscount });

                const group2 = await new GroupFactory({
                    organization,
                    price: 15_00, // Lower price so discount is applied preferably on the first group
                }).create();

                const groupPrice2 = group2.settings.prices[0];
                await enableDiscount({ group: group2, groupPrice: groupPrice2, bundleDiscount });

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
                /* expect(updatedRegistration1.discounts).toMatchMap(new Map([
                    [bundleDiscount.id, AppliedRegistrationDiscount.create({
                        name: bundleDiscount.name,
                        amount: 5_00,
                    })],
                ])); */

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
});
