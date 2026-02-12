import { PatchMap } from '@simonbackx/simple-encoding';
import { Request } from '@simonbackx/simple-endpoints';
import { EmailMocker } from '@stamhoofd/email';
import { BalanceItemFactory, Group, GroupFactory, Member, MemberFactory, MemberWithRegistrationsAndGroups, Organization, OrganizationFactory, OrganizationRegistrationPeriodFactory, Registration, RegistrationFactory, RegistrationPeriod, RegistrationPeriodFactory, Token, UserFactory } from '@stamhoofd/models';
import { AccessRight, BalanceItemCartItem, BalanceItemStatus, BalanceItemType, BooleanStatus, Company, GroupOption, GroupOptionMenu, IDRegisterCart, IDRegisterCheckout, IDRegisterItem, OrganizationPackages, PaymentCustomer, PaymentMethod, PermissionLevel, Permissions, PermissionsResourceType, ReduceablePrice, RegisterItemOption, ResourcePermissions, STPackageStatus, STPackageType, UitpasNumberDetails, UitpasSocialTariff, UitpasSocialTariffStatus, UserPermissions, Version } from '@stamhoofd/structures';
import { STExpect, TestUtils } from '@stamhoofd/test-utils';
import { v4 as uuidv4 } from 'uuid';
import { assertBalances } from '../../../../tests/assertions/assertBalances.js';
import { testServer } from '../../../../tests/helpers/TestServer.js';
import { initAdmin, initPermissionRole, initUitpasApi } from '../../../../tests/init/index.js';
import { initPayconiq } from '../../../../tests/init/initPayconiq.js';
import { BalanceItemService } from '../../../services/BalanceItemService.js';
import { RegisterMembersEndpoint } from './RegisterMembersEndpoint.js';

const baseUrl = `/v${Version}/members/register`;

describe('Endpoint.RegisterMembers', () => {
    // #region global
    const endpoint = new RegisterMembersEndpoint();
    let period: RegistrationPeriod;
    let previousPeriod: RegistrationPeriod;
    let defaultPermissionLevel = PermissionLevel.None;
    let defaultLinkMembersToUser = true;
    const post = async (body: IDRegisterCheckout, organization: Organization, token: Token) => {
        const request = Request.buildJson('POST', baseUrl, organization.getApiHost(), body);
        request.headers.authorization = 'Bearer ' + token.accessToken;
        return await testServer.test(endpoint, request);
    };

    beforeAll(async () => {
        previousPeriod = await new RegistrationPeriodFactory({
            startDate: new Date(2022, 0, 1),
            endDate: new Date(2022, 11, 31),
            locked: true,
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
        jest.useRealTimers();
    });

    const initOrganization = async (registrationPeriod: RegistrationPeriod = period) => {
        const organization = await new OrganizationFactory({ period: registrationPeriod })
            .create();

        const organizationRegistrationPeriod = await new OrganizationRegistrationPeriodFactory({ organization, period: registrationPeriod }).create();
        if (registrationPeriod !== previousPeriod) {
            await new OrganizationRegistrationPeriodFactory({ organization, period: previousPeriod }).create();
        }

        return { organization, organizationRegistrationPeriod };
    };

    async function initData({ registrationPeriod = period, otherMemberAmount = 0, groupPermissionLevel = PermissionLevel.None, memberPermissionLevel = PermissionLevel.None, permissionLevel = defaultPermissionLevel, linkMembersToUser = defaultLinkMembersToUser }: { registrationPeriod?: RegistrationPeriod; otherMemberAmount?: number; memberPermissionLevel?: PermissionLevel; groupPermissionLevel?: PermissionLevel; permissionLevel?: PermissionLevel; linkMembersToUser?: boolean } = {}) {
        const { organization, organizationRegistrationPeriod } = await initOrganization(registrationPeriod);

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

        const member = await new MemberFactory({ organization, user: linkMembersToUser ? user : undefined })
            .create();

        const otherMembers: MemberWithRegistrationsAndGroups[] = [];

        for (let i = 0; i < otherMemberAmount; i++) {
            otherMembers.push(await new MemberFactory({ organization, user: linkMembersToUser ? user : undefined })
                .create());
        }

        if (!linkMembersToUser && (permissionLevel !== PermissionLevel.None || memberPermissionLevel !== null)) {
            // Give write permission to the member by registering them for another group
            const genericGroup = await new GroupFactory({
                organization,
                price: 0,
            })
                .create();

            await new RegistrationFactory({
                member,
                group: genericGroup,
                groupPrice: genericGroup.settings.prices[0],
            }).create();

            if (memberPermissionLevel !== PermissionLevel.None) {
                // Grant permissions to this genericGroup
                user.permissions = user.permissions ?? UserPermissions.create({});
                let org = user.permissions.organizationPermissions.get(organization.id) ?? Permissions.create({});
                const p = Permissions.patch({});
                p.resources.set(PermissionsResourceType.Groups, new PatchMap([[
                    genericGroup.id, ResourcePermissions.patch({
                        level: memberPermissionLevel,
                    }),
                ]]));
                org = org.patch(p);
                user.permissions.organizationPermissions.set(organization.id, org);

                // Save
                await user.save();
            }
        }

        const group = await new GroupFactory({
            organization,
            price: 25_0000,
            reducedPrice: 12_5000,
            stock: 500,
        })
            .create();

        if (groupPermissionLevel !== PermissionLevel.None) {
            // Grant permissions to this genericGroup
            user.permissions = user.permissions ?? UserPermissions.create({});
            let org = user.permissions.organizationPermissions.get(organization.id) ?? Permissions.create({});
            const p = Permissions.patch({});
            p.resources.set(PermissionsResourceType.Groups, new PatchMap([[
                group.id, ResourcePermissions.patch({
                    level: groupPermissionLevel,
                }),
            ]]));
            org = org.patch(p);
            user.permissions.organizationPermissions.set(organization.id, org);

            // Save
            await user.save();
        }

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

    describe('Register as member', () => {
        beforeEach(() => {
            defaultPermissionLevel = PermissionLevel.None;
            defaultLinkMembersToUser = true;
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
                    totalPrice: 25_0000,
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
                totalPrice: 25_0000,
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
                unitPrice: 200,
            }).create();

            const cartItem = BalanceItemCartItem.create({
                item: balanceItem1.getStructure(),
                price: 2000,
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
                totalPrice: 2000,
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
                unitPrice: 200,
            }).create();

            const cartItem = BalanceItemCartItem.create({
                item: balanceItem1.getStructure(),
                price: 3000, // too much
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
                totalPrice: 3000,
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
                totalPrice: 25_0000,
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
                unitPrice: 200,
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
                totalPrice: 4500,
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
                totalPrice: groupPrice.price.price + 500, // too much
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
                totalPrice: 25_0000,
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
                totalPrice: 5000,
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
                totalPrice: 25_0000,
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
                totalPrice: 25_0000,
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
                totalPrice: 25_0000,
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
                totalPrice: 25_0000,
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
                totalPrice: 25_0000,
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
                totalPrice: 25_0000,
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
            // await BalanceItem.updateOutstanding([item]);

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
                totalPrice: 25_0000,
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
                totalPrice: 25_0000,
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

        test('Cannot register in locked period', async () => {
            const { member, group, groupPrice, organization, token } = await initData({
                registrationPeriod: previousPeriod,
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
                    balanceItems: [],
                    deleteRegistrationIds: [],
                }),
                administrationFee: 0,
                freeContribution: 0,
                paymentMethod: PaymentMethod.PointOfSale,
                totalPrice: 25_0000,
                customer: null,
            });

            await expect(post(body, organization, token)).rejects.toThrow(STExpect.errorWithCode('locked_period'));
        });

        test('Should set reserved members when using online payments', async () => {
            const { member, organization, token } = await initData();
            await initPayconiq({ organization });

            const group2 = await new GroupFactory({
                organization,
                price: 1500,
                stock: 4,
                maxMembers: 1,
            }).create();

            const groupPrice2 = group2.settings.prices[0];

            const body = IDRegisterCheckout.create({
                cart: IDRegisterCart.create({
                    items: [
                        IDRegisterItem.create({
                            id: uuidv4(),
                            groupPrice: groupPrice2,
                            organizationId: organization.id,
                            groupId: group2.id,
                            memberId: member.id,
                        }),
                    ],
                }),
                paymentMethod: PaymentMethod.Payconiq,
                redirectUrl: new URL('https://www.example.com'),
                cancelUrl: new URL('https://www.example.com'),
                totalPrice: 1500,
            });

            const response = await post(body, organization, token);

            expect(response.body).toBeDefined();
            expect(response.body.registrations.length).toBe(1);
            expect(response.body.paymentUrl).toMatch(/payconiq\.com/);

            expect(response.body.registrations[0]).toMatchObject({
                registeredAt: null,
                deactivatedAt: null,
                reservedUntil: expect.any(Date),
            });

            await group2.refresh();
            expect(group2.settings.registeredMembers).toBe(0);
            expect(group2.settings.reservedMembers).toBe(1);
        });

        test('Register for group with trial should set trial period', async () => {
            // #region arrange
            const date = new Date('2023-05-14');
            jest.useFakeTimers({ advanceTimers: true, doNotFake: ['setTimeout', 'clearTimeout', 'hrtime', 'nextTick', 'performance', 'queueMicrotask', 'setImmediate', 'clearImmediate'] }).setSystemTime(date);

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
                jest.useRealTimers();
            }
        }, 20_00000);

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
                totalPrice: 25_0000,
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
                totalPrice: 7500,
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
                    price: 500,
                    reducedPrice: 300,
                }),
            });

            const option2 = GroupOption.create({
                name: 'option 2',
                stock: 4,
                price: ReduceablePrice.create({
                    price: 300,
                    reducedPrice: 100,
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
                totalPrice: 5000,
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
            const { organization, group, groupPrice, token, member } = await initData();

            const option1 = GroupOption.create({
                name: 'option 1',
                stock: 4,
                maximum: 5,
                allowAmount: true,
                price: ReduceablePrice.create({
                    price: 5_0000,
                    reducedPrice: 3_0000,
                }),
            });

            const option2 = GroupOption.create({
                name: 'option 2',
                stock: 5,
                maximum: 2,
                allowAmount: true,
                price: ReduceablePrice.create({
                    price: 3_0000,
                    reducedPrice: 1_0000,
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
                totalPrice: 50_0000,
                customer: null,
            });

            await expect(async () => await post(body, organization, token))
                .rejects
                .toThrow(new RegExp('Option maximum exceeded'));
        });

        test('Should not fail if max option not exceeded', async () => {
            const { organization, group, groupPrice, token, member } = await initData();

            const option1 = GroupOption.create({
                name: 'option 1',
                stock: 4,
                maximum: 5,
                allowAmount: true,
                price: ReduceablePrice.create({
                    price: 5_0000,
                    reducedPrice: 3_0000,
                }),
            });

            const option2 = GroupOption.create({
                name: 'option 2',
                stock: 5,
                maximum: 5,
                allowAmount: true,
                price: ReduceablePrice.create({
                    price: 3_0000,
                    reducedPrice: 1_0000,
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
                totalPrice: 50_0000,
                customer: null,
            });

            const result = await post(body, organization, token);
            expect(result).toBeDefined();
        });

        describe('Uitpas number', () => {
            test('should update social tariff status and throw error if the price changed', async () => {
                // #region arrange
                initUitpasApi();
                const { member, group, groupPrice, organization, token } = await initData();
                member.details.uitpasNumberDetails = UitpasNumberDetails.create({
                    // expired
                    uitpasNumber: '0900000031618',
                    socialTariff: UitpasSocialTariff.create({
                        // but last time checked it was active
                        status: UitpasSocialTariffStatus.Active,
                        updatedAt: new Date(2000, 0, 1),
                        endDate: new Date(2000, 0, 1),
                    }),
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
                        balanceItems: [],
                        deleteRegistrationIds: [],
                    }),
                    administrationFee: 0,
                    freeContribution: 0,
                    paymentMethod: PaymentMethod.PointOfSale,
                    // reduced price
                    totalPrice: 12_5000,
                    customer: null,
                });
                // #endregion

                // act

                // should throw error
                await expect(async () => await post(body, organization, token))
                    .rejects
                    .toThrow(STExpect.errorWithCode('changed_price'));

                // should update status
                const updatedMember = await Member.getByID(member.id);
                expect(updatedMember!.details.uitpasNumberDetails?.uitpasNumber).toEqual('0900000031618');
                expect(updatedMember!.details.uitpasNumberDetails?.socialTariff?.status).toEqual(UitpasSocialTariffStatus.Expired);
                expect(updatedMember!.details.uitpasNumberDetails?.socialTariff?.updatedAt.getTime()).not.toEqual(new Date(2000, 0, 1).getTime());
                expect(updatedMember!.details.uitpasNumberDetails?.socialTariff?.endDate?.getTime()).not.toEqual(new Date(2000, 0, 1).getTime());
            });

            test('should not update social tariff status if updated less than 1 week ago', async () => {
                // #region arrange
                initUitpasApi();
                const { member, group, groupPrice, organization, token } = await initData();

                const now = new Date();
                const weekInMs = 7 * 24 * 3600 * 1000;
                const oneHourInMs = 3600 * 1000;
                const lessThanAWeekAgo = new Date(now.getTime() - weekInMs + oneHourInMs);

                member.details.uitpasNumberDetails = UitpasNumberDetails.create({
                    // expired
                    uitpasNumber: '0900000031618',
                    socialTariff: UitpasSocialTariff.create({
                        // but last time checked it was active
                        status: UitpasSocialTariffStatus.Active,
                        updatedAt: lessThanAWeekAgo,
                        endDate: new Date(2000, 0, 1),
                    }),
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
                        balanceItems: [],
                        deleteRegistrationIds: [],
                    }),
                    administrationFee: 0,
                    freeContribution: 0,
                    paymentMethod: PaymentMethod.PointOfSale,
                    // reduced price
                    totalPrice: 12_5000,
                    customer: null,
                });
                // #endregion

                // act
                const response = await post(body, organization, token);

                // assert
                expect(response.body).toBeDefined();
                expect(response.body.registrations.length).toBe(1);

                // should not update status
                const updatedMember = await Member.getByID(member.id);
                expect(updatedMember!.details.uitpasNumberDetails?.uitpasNumber).toEqual('0900000031618');
                expect(updatedMember!.details.uitpasNumberDetails?.socialTariff?.status).toEqual(UitpasSocialTariffStatus.Active);
            });

            test('should not apply reduced price if social tariff status is unknown and uitpas api is unavailable', async () => {
                const mocker = initUitpasApi();
                mocker.forceFailure();

                const { member, group, groupPrice, organization, token } = await initData();
                member.details.uitpasNumberDetails = UitpasNumberDetails.create({
                    // active
                    uitpasNumber: '0900011354829',
                    socialTariff: UitpasSocialTariff.create({
                        // but last time checked it was active
                        status: UitpasSocialTariffStatus.Unknown,
                        updatedAt: new Date(2000, 0, 1),
                        endDate: new Date(2000, 0, 1),
                    }),
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
                        balanceItems: [],
                        deleteRegistrationIds: [],
                    }),
                    administrationFee: 0,
                    freeContribution: 0,
                    paymentMethod: PaymentMethod.PointOfSale,
                    // normal price
                    totalPrice: 25_0000,
                    customer: null,
                });

                // act
                const response = await post(body, organization, token);

                // assert
                expect(response.body).toBeDefined();
                expect(response.body.registrations.length).toBe(1);

                // should not update status
                const updatedMember = await Member.getByID(member.id);
                expect(updatedMember!.details.uitpasNumberDetails?.uitpasNumber).toEqual('0900011354829');
                expect(updatedMember!.details.uitpasNumberDetails?.socialTariff?.status).toEqual(UitpasSocialTariffStatus.Unknown);
            });

            test('should apply reduced price based on legacy rule if uitpas api is not connected and status is unkown', async () => {
                TestUtils.setEnvironment('UITPAS_API_CLIENT_SECRET', undefined);

                const { member, group, groupPrice, organization, token } = await initData();
                member.details.uitpasNumberDetails = UitpasNumberDetails.create({
                    // active
                    uitpasNumber: '0900011354819', // Second last number is 1, so has social tariffs in legacy mode
                    socialTariff: UitpasSocialTariff.create({
                        // but last time checked it was active
                        status: UitpasSocialTariffStatus.Unknown,
                        updatedAt: new Date(2000, 0, 1),
                        endDate: new Date(2000, 0, 1),
                    }),
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
                        balanceItems: [],
                        deleteRegistrationIds: [],
                    }),
                    administrationFee: 0,
                    freeContribution: 0,
                    paymentMethod: PaymentMethod.PointOfSale,
                    // normal price
                    totalPrice: 12_5000,
                    customer: null,
                });

                // act
                const response = await post(body, organization, token);

                // assert
                expect(response.body).toBeDefined();
                expect(response.body.registrations.length).toBe(1);

                // should not update status
                const updatedMember = await Member.getByID(member.id);
                expect(updatedMember!.details.uitpasNumberDetails?.uitpasNumber).toEqual('0900011354819');
                expect(updatedMember!.details.uitpasNumberDetails?.socialTariff?.status).toEqual(UitpasSocialTariffStatus.Unknown);
            });

            test('should not apply reduced price based on legacy rule if uitpas api is not connected and status is unkown', async () => {
                TestUtils.setEnvironment('UITPAS_API_CLIENT_SECRET', undefined);

                const { member, group, groupPrice, organization, token } = await initData();
                member.details.uitpasNumberDetails = UitpasNumberDetails.create({
                    // active
                    uitpasNumber: '0900011354829', // Second last number isnot 1, so does not have social tariffs in legacy mode
                    socialTariff: UitpasSocialTariff.create({
                        // but last time checked it was active
                        status: UitpasSocialTariffStatus.Unknown,
                        updatedAt: new Date(2000, 0, 1),
                        endDate: new Date(2000, 0, 1),
                    }),
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
                        balanceItems: [],
                        deleteRegistrationIds: [],
                    }),
                    administrationFee: 0,
                    freeContribution: 0,
                    paymentMethod: PaymentMethod.PointOfSale,
                    // normal price
                    totalPrice: 25_0000,
                    customer: null,
                });

                // act
                const response = await post(body, organization, token);

                // assert
                expect(response.body).toBeDefined();
                expect(response.body.registrations.length).toBe(1);

                // should not update status
                const updatedMember = await Member.getByID(member.id);
                expect(updatedMember!.details.uitpasNumberDetails?.uitpasNumber).toEqual('0900011354829');
                expect(updatedMember!.details.uitpasNumberDetails?.socialTariff?.status).toEqual(UitpasSocialTariffStatus.Unknown);
            });
        });
    });

    describe('Register as organization', () => {
        beforeEach(() => {
            defaultPermissionLevel = PermissionLevel.Full;
            defaultLinkMembersToUser = false;
        });

        test('[Regression] Pay balance between organizations requires only finance access rights', async () => {
            const { member, organization, token, user } = await initData();
            const role = await initPermissionRole({
                organization,
                accessRights: [AccessRight.OrganizationFinanceDirector],
            });
            const { admin, adminToken } = await initAdmin({
                organization,
                permissions: Permissions.create({
                    level: PermissionLevel.None,
                    roles: [role],
                }),
            });

            const company = Company.create({});
            organization.meta.companies.push(company);
            await organization.save();

            const otherOrganization = await new OrganizationFactory({ }).create();

            const balanceItem1 = await new BalanceItemFactory({
                organizationId: otherOrganization.id,
                memberId: null,
                userId: null,
                payingOrganizationId: organization.id,
                type: BalanceItemType.PlatformMembership,
                amount: 10,
                unitPrice: 200,
            }).create();

            const cartItem = BalanceItemCartItem.create({
                item: balanceItem1.getStructure(),
                price: 2000,
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
                totalPrice: 2000,
                asOrganizationId: organization.id,
                customer: PaymentCustomer.create({
                    firstName: user.firstName,
                    lastName: user.lastName,
                    email: user.email,
                    company,
                }),
            });

            const response = await post(body, otherOrganization, adminToken);
            expect(response.body.registrations.length).toBe(0);

            await BalanceItemService.flushAll();
            await balanceItem1.refresh();

            expect(balanceItem1).toMatchObject({
                amount: 10,
                unitPrice: 200,
                priceOpen: 0,
                pricePending: 2000,
                pricePaid: 0,
            });
        });

        test('Pay balance between organizations not possible without finance access rights', async () => {
            const { member, user, organization, token } = await initData({
                permissionLevel: PermissionLevel.Write,
            });

            const otherOrganization = await new OrganizationFactory({ }).create();

            const company = Company.create({});
            organization.meta.companies.push(company);
            await organization.save();

            const balanceItem1 = await new BalanceItemFactory({
                organizationId: otherOrganization.id,
                memberId: null,
                userId: null,
                payingOrganizationId: organization.id,
                type: BalanceItemType.PlatformMembership,
                amount: 10,
                unitPrice: 200,
            }).create();

            const cartItem = BalanceItemCartItem.create({
                item: balanceItem1.getStructure(),
                price: 2000,
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
                totalPrice: 2000,
                asOrganizationId: organization.id,
                customer: PaymentCustomer.create({
                    firstName: user.firstName,
                    lastName: user.lastName,
                    email: user.email,
                    company,
                }),
            });

            await expect(post(body, otherOrganization, token))
                .rejects
                .toThrow(STExpect.simpleError({
                    code: 'forbidden',
                    message: 'No permission to checkout as this organization for a different organization',
                }));
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
                totalPrice: 25_0000,
                asOrganizationId: organization.id,
            });

            const response = await post(body, organization, token);
            expect(response.body.registrations.length).toBe(1);
            expect(response.body.registrations[0].id).toEqual(firstRegistration.id);
        });

        test('Cannot pay member balances as organization', async () => {
            const { member, user, organization, token } = await initData();

            const balanceItem1 = await new BalanceItemFactory({
                organizationId: organization.id,
                memberId: member.id,
                userId: user.id,
                payingOrganizationId: organization.id,
                type: BalanceItemType.Registration,
                amount: 10,
                unitPrice: 200,
            }).create();

            const cartItem = BalanceItemCartItem.create({
                item: balanceItem1.getStructure(),
                price: 2000,
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
                totalPrice: 2000,
                asOrganizationId: organization.id,
                customer: null,
            });

            await expect(post(body, organization, token))
                .rejects
                .toThrow(STExpect.simpleError({
                    code: 'cannot_pay_balance_items',
                }));
        });

        /**
         * Case: you have write permission - but no access to financial data.
         */
        test('Registering members with financial support', async () => {
            const { member, user, groupPrice, group, organization, token } = await initData({
                permissionLevel: PermissionLevel.Write,
            });

            // Set member financial data status
            member.details.requiresFinancialSupport = BooleanStatus.create({ value: true });
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
                totalPrice: 25_0000, // This is wrong, but the admin should not know that since he/she does not know the actual financial status of the member
                asOrganizationId: organization.id,
            });

            const response = await post(body, organization, token);
            expect(response.body.registrations.length).toBe(1);

            // No balance information leaks
            expect(response.body.registrations[0].balances.length).toEqual(0);

            // Check acual charged amount
            const registration = (await Registration.getByID(response.body.registrations[0].id))!;
            expect(registration).toBeDefined();
            expect(registration.discounts).toMatchMap(new Map([]));

            // Check balance has been added
            await assertBalances({ member }, [
                {
                    type: BalanceItemType.Registration,
                    registrationId: registration.id,
                    amount: 1,
                    price: 12_5000,
                    status: BalanceItemStatus.Due,
                    priceOpen: 12_5000,
                    pricePending: 0,
                },
            ]);

            // Check member in response doesn't include sensitive data
            const memberInResponse = response.body.members.members.find(m => m.id === member.id)!;
            expect(memberInResponse).toBeDefined();
            expect(memberInResponse.details.requiresFinancialSupport).toBe(null);
            const returnedRegistration = memberInResponse.registrations.find(r => r.id === registration.id)!;
            expect(returnedRegistration).toBeDefined();
            expect(returnedRegistration.balances.length).toBe(0);
        });

        /**
         * Negative test for previous test
         */
        test('Can register a member as full admin', async () => {
            const { member, groupPrice, group, organization, token } = await initData({});

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
                totalPrice: 25_0000,
                asOrganizationId: organization.id,
            });

            const response = await post(body, organization, token);
            expect(response.body.registrations.length).toBe(1);

            // Check acual charged amount
            const registration = (await Registration.getByID(response.body.registrations[0].id))!;
            expect(registration).toBeDefined();
            expect(registration.discounts).toMatchMap(new Map([]));

            // Check balance has been added
            await assertBalances({ member }, [
                {
                    type: BalanceItemType.Registration,
                    registrationId: registration.id,
                    amount: 1,
                    price: 25_0000,
                    status: BalanceItemStatus.Due,
                    priceOpen: 25_0000,
                    pricePending: 0,
                },
            ]);

            // Check member in response does include financial data
            const memberInResponse = response.body.members.members.find(m => m.id === member.id)!;
            expect(memberInResponse).toBeDefined();
            const returnedRegistration = memberInResponse.registrations.find(r => r.id === registration.id)!;
            expect(returnedRegistration).toBeDefined();
            expect(returnedRegistration.balances.length).not.toBe(0);
        });

        test('[REGRESSION] Cannot register a member in a locked period', async () => {
            const { member, organization, token } = await initData({});
            const group = await new GroupFactory({
                organization,
                price: 25_0000,
                reducedPrice: 12_5000,
                stock: 500,
                period: previousPeriod,
            })
                .create();
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
                    balanceItems: [
                    ],
                    deleteRegistrationIds: [],
                }),
                administrationFee: 0,
                freeContribution: 0,
                paymentMethod: PaymentMethod.PointOfSale,
                totalPrice: 25_0000,
                asOrganizationId: organization.id,
            });

            await expect(post(body, organization, token)).rejects.toThrow(STExpect.errorWithCode('locked_period'));
        });

        test('Can register a member as admin with write permission to new group only', async () => {
            // read permission to existing member, write permission to new group you want to register the member in
            const { member, groupPrice, group, organization, token } = await initData({
                permissionLevel: PermissionLevel.None,
                groupPermissionLevel: PermissionLevel.Write,
                memberPermissionLevel: PermissionLevel.Read,
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
                    ],
                    deleteRegistrationIds: [],
                }),
                administrationFee: 0,
                freeContribution: 0,
                paymentMethod: PaymentMethod.PointOfSale,
                totalPrice: 25_0000,
                asOrganizationId: organization.id,
            });

            const response = await post(body, organization, token);
            expect(response.body.registrations.length).toBe(1);

            // No balance information leaks
            expect(response.body.registrations[0].balances.length).toEqual(0);

            // Check acual charged amount
            const registration = (await Registration.getByID(response.body.registrations[0].id))!;
            expect(registration).toBeDefined();
            expect(registration.discounts).toMatchMap(new Map([]));

            // Check balance has been added
            await assertBalances({ member }, [
                {
                    type: BalanceItemType.Registration,
                    registrationId: registration.id,
                    amount: 1,
                    price: 25_0000,
                    status: BalanceItemStatus.Due,
                    priceOpen: 25_0000,
                    pricePending: 0,
                },
            ]);
        });

        test('Cannot register a member with only read permissions', async () => {
            const { member, groupPrice, group, organization, token } = await initData({
                permissionLevel: PermissionLevel.None,
                groupPermissionLevel: PermissionLevel.Read,
                memberPermissionLevel: PermissionLevel.Read,
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
                    ],
                    deleteRegistrationIds: [],
                }),
                administrationFee: 0,
                freeContribution: 0,
                paymentMethod: PaymentMethod.PointOfSale,
                totalPrice: 25_0000,
                asOrganizationId: organization.id,
            });

            // send request and check occupancy
            await expect(async () => await post(body, organization, token)).rejects.toThrow('No permission to register in this group');
        });

        test('Cannot register a member with only read permissions even when having full permissions to the specific member', async () => {
            const { member, groupPrice, group, organization, token } = await initData({
                // No global organization permissions
                permissionLevel: PermissionLevel.None,
                groupPermissionLevel: PermissionLevel.Read, // Only read access to the new group
                memberPermissionLevel: PermissionLevel.Full, // Full access to the member
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
                    ],
                    deleteRegistrationIds: [],
                }),
                administrationFee: 0,
                freeContribution: 0,
                paymentMethod: PaymentMethod.PointOfSale,
                totalPrice: 25_0000,
                asOrganizationId: organization.id,
            });

            // send request and check occupancy
            await expect(async () => await post(body, organization, token)).rejects.toThrow('No permission to register in this group');
        });
    });

    describe('Register by other organization', () => {
        beforeEach(() => {
            defaultPermissionLevel = PermissionLevel.Full;
            defaultLinkMembersToUser = false;
        });

        async function initDualData(options?: Parameters<typeof initData>[0]) {
            const base = await initData({ ...options, permissionLevel: PermissionLevel.None });

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

            // Give the user permission to the original member
            const genericGroup = await new GroupFactory({
                organization: organization2,
                price: 0,
            }).create();

            await new RegistrationFactory({
                member: base.member,
                group: genericGroup,
                groupPrice: genericGroup.settings.prices[0],
            }).create();

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
                totalPrice: 25_0000,
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
                totalPrice: 25_0000,
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
                totalPrice: 25_0000,
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
                totalPrice: 25_0000,
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
                totalPrice: 500,
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
                totalPrice: 25_0000,
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
                totalPrice: 25_0000,
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
                price: 3000,
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
                totalPrice: 3000,
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

        test('[REGRESSION] Cannot replace registrations of locked periods', async () => {
            const { member, group, groupPrice, organization, token } = await initData();

            const group1 = await new GroupFactory({
                organization,
                price: 25_0000,
                reducedPrice: 12_5000,
                stock: 500,
                period: previousPeriod,
            })
                .create();
            const groupPrice1 = group1.settings.prices[0];

            const registration = await new RegistrationFactory({
                member,
                group: group1,
                groupPrice: groupPrice1,
            }).create();

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
                }),
                administrationFee: 0,
                freeContribution: 0,
                paymentMethod: PaymentMethod.PointOfSale,
                totalPrice: 3000,
                asOrganizationId: organization.id,
                customer: null,
            });

            await expect(post(body, organization, token)).rejects.toThrow(STExpect.errorWithCode('locked_period'));
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
                totalPrice: 25_0000,
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
                price: 30_0000,
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
                totalPrice: 30_0000 - 25_0000,
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
                price: 3000,
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
                totalPrice: 500,
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

        test('Move registration should fail via member portal (no asOrganizationId set)', async () => {
            const { organization, group: group1, groupPrice: groupPrice1, token, member } = await initData({
                permissionLevel: defaultPermissionLevel,
                linkMembersToUser: true,
            });

            const registration = await new RegistrationFactory({
                member,
                group: group1,
                groupPrice: groupPrice1,
            })
                .create();

            const group = await new GroupFactory({
                organization,
                price: 3000,
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
                totalPrice: 500,
                customer: null,
            });

            // send request and check occupancy
            await expect(async () => await post(body, organization, token)).rejects.toThrow('Not allowed to move registrations');
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
                price: 3000,
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
                totalPrice: 3000,
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
            const { member, group: group1, groupPrice: groupPrice1, organization: organization1, token } = await initData({
                permissionLevel: PermissionLevel.Full,
                linkMembersToUser: true,
            });
            await initPayconiq({ organization: organization1 });

            const registration = await new RegistrationFactory({
                member,
                group: group1,
                groupPrice: groupPrice1,
            })
                .create();

            const group = await new GroupFactory({
                organization: organization1,
                price: 3000,
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
                totalPrice: 500,
                customer: null,
            });

            await expect(async () => await post(body, organization1, token)).rejects.toThrow('Permission denied: you are not allowed to delete registrations');
        });

        test('Should deactivate registration', async () => {
            const { member, group: group1, groupPrice: groupPrice1, organization, token } = await initData();

            const registration = await new RegistrationFactory({
                member,
                group: group1,
                groupPrice: groupPrice1,
            }).create();

            const group = await new GroupFactory({
                organization,
                price: 3000,
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
                totalPrice: 3000,
                asOrganizationId: organization.id,
                customer: null,
            });

            await post(body, organization, token);

            const updatedRegistration = await Registration.getByID(registration.id);
            expect(updatedRegistration).toBeDefined();
            expect(updatedRegistration!.deactivatedAt).not.toBe(null);
        });

        test('[REGRESSION] Cannot deactivate registrations of locked periods', async () => {
            const { member, organization, token } = await initData();

            const group1 = await new GroupFactory({
                organization,
                price: 25_0000,
                reducedPrice: 12_5000,
                stock: 500,
                period: previousPeriod,
            })
                .create();
            const groupPrice1 = group1.settings.prices[0];

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
                totalPrice: 3000,
                asOrganizationId: organization.id,
                customer: null,
            });

            await expect(post(body, organization, token)).rejects.toThrow(STExpect.errorWithCode('locked_period'));
        });

        test('Should fail if invalid cancelation fee', async () => {
            for (const cancellationFeePercentage of [10001, -1]) {
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
                    totalPrice: 25_0000,
                    asOrganizationId: organization.id,
                    customer: null,
                });

                const group2 = await new GroupFactory({
                    organization,
                    price: 3000,
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
                    totalPrice: 3000 - 2500 + 100 * Math.round(25 * cancellationFeePercentage / 10000),
                    asOrganizationId: organization.id,
                    customer: null,
                });

                await expect(async () => await post(body2, organization, token))
                    .rejects
                    .toThrow(STExpect.simpleError({
                        field: 'cancellationFeePercentage',
                        code: 'invalid_field',
                    }));
            }
        });

        test('Cannot delete registrations via the member portal', async () => {
            const { member, group: group1, groupPrice: groupPrice1, organization, token } = await initData({
                linkMembersToUser: true,
            });

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
                totalPrice: 500,
                customer: null,
            });

            await expect(async () => await post(body, organization, token))
                .rejects
                .toThrow(new RegExp('Permission denied: you are not allowed to delete registrations'));
        });

        test('Cannot delete registrations as admin if no write permission to group', async () => {
            const { member, group: group1, groupPrice: groupPrice1, organization, token } = await initData({
                permissionLevel: PermissionLevel.None,
                groupPermissionLevel: PermissionLevel.Read,
                memberPermissionLevel: PermissionLevel.Full,
                linkMembersToUser: false,
            });

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

            await expect(async () => await post(body, organization, token)).rejects.toThrow(/No permission to delete this registration/);
        });

        /**
         * userManager does not allow unregistering your own members, even when you have some admin permissions and set asOrganizationId
         */
        test('Cannot delete registrations as admin if no write permission to group but does have userManager permissions', async () => {
            const { member, group: group1, groupPrice: groupPrice1, organization, token } = await initData({
                permissionLevel: PermissionLevel.Read,
                linkMembersToUser: true,
            });

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

            await expect(async () => await post(body, organization, token)).rejects.toThrow(/No permission to delete this registration/);
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
                price: 3000,
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
                totalPrice: 500,
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
                price: 3000,
                stock: 5,
            }).create();

            const groupPrice2 = group2.settings.prices[0];

            const group3 = await new GroupFactory({
                organization,
                price: 3000,
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
                totalPrice: 3000,
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
                totalPrice: 3000,
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
