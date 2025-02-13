import { Request } from '@simonbackx/simple-endpoints';
import { BalanceItem, BalanceItemFactory, GroupFactory, MemberFactory, MemberWithRegistrations, Organization, OrganizationFactory, Platform, RegistrationFactory, RegistrationPeriod, RegistrationPeriodFactory, Token, UserFactory } from '@stamhoofd/models';
import { BalanceItemCartItem, BalanceItemType, DefaultAgeGroup, IDRegisterCart, IDRegisterCheckout, IDRegisterItem, PaymentMethod, PermissionLevel, Permissions, PlatformMembershipType, PlatformMembershipTypeConfig, Version } from '@stamhoofd/structures';
import { v4 as uuidv4 } from 'uuid';
import { RegisterMembersEndpoint } from '../../src/endpoints/global/registration/RegisterMembersEndpoint';
import { testServer } from '../helpers/TestServer';

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

    describe('register', () => {
        test.skip('Should create balance items', () => {
            // also check options
            throw new Error('Not implemented');
        });

        test.skip('Should create balance items for options', () => {
            throw new Error('Not implemented');
        });

        test.skip('Should create balance item for free contribution', () => {
            throw new Error('Not implemented');
        });

        test.skip('Should create balance item for free administration fee', () => {
            throw new Error('Not implemented');
        });

        // todo (Not possible to pay balance items as the organization)
        test.skip('Should fail if organization pays balance items', () => {
            // also check options
            throw new Error('Not implemented');
        });

        test.skip('Should update cached balance items in database', () => {
            throw new Error('Not implemented');
        });

        test.skip('Should mark balance items as paid', async () => {
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
            const response = await post(body, organization, token);
            expect(response.body.registrations.length).toBe(1);

            const balanceItem1Id: string = balanceItem1.id;
            const balanceItem = await BalanceItem.getByID(balanceItem1Id);
            expect(balanceItem).toBeDefined();
            expect(balanceItem!.pricePaid).toBe(10);
            // #endregion
        });

        test.skip('should update balance item price paid in database', async () => {
            // #region arrange
            const { organization, group, groupPrice, token, member, user } = await initData();
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
            const response = await post(body, organization, token);

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
            const response = await post(body, organization, token);

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
