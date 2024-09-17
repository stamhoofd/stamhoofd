import { Request } from "@simonbackx/simple-endpoints";
import { Group, GroupFactory, MemberFactory, MemberWithRegistrations, Organization, OrganizationFactory, RegistrationFactory, RegistrationPeriod, RegistrationPeriodFactory, Token, User, UserFactory } from "@stamhoofd/models";
import { GroupPrice, IDRegisterCart, IDRegisterCheckout, IDRegisterItem, PayconiqAccount, PaymentMethod, PermissionLevel, Permissions, Version } from "@stamhoofd/structures";
import nock from "nock";
import { v4 as uuidv4 } from "uuid";
import { testServer } from "../../../../tests/helpers/TestServer";
import { RegisterMembersEndpoint } from "./RegisterMembersEndpoint";

const baseUrl = `/v${Version}/members/register`

describe("Endpoint.RegisterMembers", () => {
    //#region global
    const endpoint = new RegisterMembersEndpoint();
    let period: RegistrationPeriod;
    let organization: Organization;
    let user: User;
    let token: Token;
    let member: MemberWithRegistrations;
    let group1: Group;
    let groupPrice1: GroupPrice;
    let group2: Group;
    let groupPrice2: GroupPrice;

    //#region helpers
    const post = async (body: IDRegisterCheckout) => {
        const request = Request.buildJson("POST", baseUrl,organization.getApiHost(), body);
        request.headers.authorization = "Bearer "+token.accessToken;
        return await testServer.test(endpoint, request);
    }
    //#endregion

    //#endregion

    beforeAll(async () => {
        period = await new RegistrationPeriodFactory({}).create();
        organization = await new OrganizationFactory({ period }).create();
        organization.meta.registrationPaymentConfiguration.paymentMethods = [PaymentMethod.PointOfSale, PaymentMethod.Payconiq];
        
        organization.privateMeta.payconiqAccounts = [PayconiqAccount.create({
            id: uuidv4(),
            apiKey: 'test',
            merchantId: 'test',
            profileId: 'test',
            name: 'test',
            iban: 'BE56587127952688', // = random IBAN
            callbackUrl: 'https://example.com'
        })]

        user = await new UserFactory({
            organization,
            permissions: Permissions.create({
                level: PermissionLevel.Full
            })
        }).create();
        token = await Token.createToken(user);
        member = await new MemberFactory({ organization, user }).create();
    });

    beforeEach(async () => {
        //#region groups
        group1 = await new GroupFactory({
            organization,
            price: 25,
            stock: 5
        }).create();

        groupPrice1 = group1.settings.prices[0];

        group2 = await new GroupFactory({
            organization,
            price: 15,
            stock: 4,
            maxMembers: 1
        }).create();

        groupPrice2 = group2.settings.prices[0];
        //#endregion
    });

    describe('Register member', () => {

        test("Should update registered mmebers", async () => {
            //#region arrange
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
                            memberId: member.id
                        })
                    ],
                    balanceItems: [],
                    deleteRegistrationIds: []
                }),
                administrationFee: 0,
                freeContribution: 0,
                paymentMethod: PaymentMethod.PointOfSale,
                totalPrice: 25,
                asOrganizationId: organization.id,
                customer: null,
            });
            //#endregion

            // act
            const response = await post(body);

            // assert
            expect(response.body).toBeDefined();
            expect(response.body.registrations.length).toBe(1);

            const updatedGroup = await Group.getByID(group1.id);
            expect(updatedGroup!.settings.registeredMembers).toBe(1);
            expect(updatedGroup!.settings.reservedMembers).toBe(0);
        })

        test("Should update reserved members", async () => {
            //#region arrange
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
                            memberId: member.id
                        })
                    ],
                    balanceItems: [],
                    deleteRegistrationIds: []
                }),
                administrationFee: 0,
                freeContribution: 0,
                paymentMethod: PaymentMethod.Payconiq,
                redirectUrl: new URL("https://www.example.com"),
                cancelUrl: new URL("https://www.example.com"),
                totalPrice: 15,
                customer: null,
            });
            
            nock('https://api.ext.payconiq.com')
            .post('/v3/payments')
            .reply(200, {
                paymentId: 'testPaymentId',
                _links: {
                    checkout: {
                        href: 'https://www.example.com'
                    }
                }
            });
            //#endregion

            // act
            const response = await post(body);

            // assert
            expect(response.body).toBeDefined();
            expect(response.body.registrations.length).toBe(1);

            const updatedGroup = await Group.getByID(group2.id);
            expect(updatedGroup!.settings.registeredMembers).toBe(0);
            expect(updatedGroup!.settings.reservedMembers).toBe(1);
        })
    })

    describe('Register member with replace registration', () => {
        
        test("Should update registered members", async () => {
            //#region arrange
            const registration = await new RegistrationFactory({
                member,
                group: group1,
                groupPrice: groupPrice1
            })
            .create();

            const group = await new GroupFactory({
                organization,
                price: 30,
                stock: 5
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
                            memberId: member.id
                        })
                    ],
                    balanceItems: [],
                    deleteRegistrationIds: []
                }),
                administrationFee: 0,
                freeContribution: 0,
                paymentMethod: PaymentMethod.PointOfSale,
                totalPrice: 5,
                asOrganizationId: organization.id,
                customer: null,
            });
            //#endregion

            //#region act and assert

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
            // occupancy should go from 1 to 0 because the registration should be replaced
            expect(updatedGroup1After!.settings.registeredMembers).toBe(0);
            expect(updatedGroup1After!.settings.reservedMembers).toBe(0);
            //#endregion
        })

        test("Should throw error if with payment", async () => {
            //#region arrange
            const registration = await new RegistrationFactory({
                member,
                group: group1,
                groupPrice: groupPrice1
            })
            .create();

            const group = await new GroupFactory({
                organization,
                price: 30,
                stock: 5,
                maxMembers: 1
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
                            memberId: member.id
                        })
                    ],
                    balanceItems: [],
                    deleteRegistrationIds: []
                }),
                administrationFee: 0,
                freeContribution: 0,
                paymentMethod: PaymentMethod.Payconiq,
                redirectUrl: new URL("https://www.example.com"),
                cancelUrl: new URL("https://www.example.com"),
                totalPrice: 5,
                customer: null,
            });
            //#endregion

            //#region act and assert

            // update occupancy to be sure occupancy is 1
            await group1.updateOccupancy();
            expect(group1.settings.registeredMembers).toBe(1);

            await expect(async () => await post(body)).rejects.toThrow("Not allowed to move registrations");
            //#endregion
        })
    })

    describe('Register member with delete registration', () => {
        
        test("Should update registered members", async () => {
            //#region arrange
            const registration = await new RegistrationFactory({
                member,
                group: group1,
                groupPrice: groupPrice1
            })
            .create();

            const group = await new GroupFactory({
                organization,
                price: 30,
                stock: 5
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
                            memberId: member.id
                        })
                    ],
                    balanceItems: [],
                    deleteRegistrationIds: [registration.id]
                }),
                administrationFee: 0,
                freeContribution: 0,
                paymentMethod: PaymentMethod.PointOfSale,
                totalPrice: 5,
                asOrganizationId: organization.id,
                customer: null,
            });
            //#endregion

            //#region act and assert

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
            //#endregion
        })

        test("Should throw error if with payment", async () => {
            //#region arrange
            const registration = await new RegistrationFactory({
                member,
                group: group1,
                groupPrice: groupPrice1
            })
            .create();

            const group = await new GroupFactory({
                organization,
                price: 30,
                stock: 5,
                maxMembers: 1
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
                            memberId: member.id
                        })
                    ],
                    balanceItems: [],
                    deleteRegistrationIds: [registration.id]
                }),
                administrationFee: 0,
                freeContribution: 0,
                paymentMethod: PaymentMethod.Payconiq,
                redirectUrl: new URL("https://www.example.com"),
                cancelUrl: new URL("https://www.example.com"),
                totalPrice: 5,
                customer: null,
            });
            //#endregion

            //#region act and assert

            // update occupancy to be sure occupancy is 1
            await group1.updateOccupancy();
            expect(group1.settings.registeredMembers).toBe(1);

            await expect(async () => await post(body)).rejects.toThrow("Permission denied: you are not allowed to delete registrations");
            //#endregion
        })
    })

    it('Register member that is already registered should throw error', async () => {
        // create existing registration
        await new RegistrationFactory({
            member,
            group: group1,
            groupPrice: groupPrice1
        })
        .create();

        // register again
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
                        memberId: member.id
                    })
                ],
                balanceItems: [],
                deleteRegistrationIds: []
            }),
            administrationFee: 0,
            freeContribution: 0,
            paymentMethod: PaymentMethod.PointOfSale,
            totalPrice: groupPrice1.price.price,
            asOrganizationId: organization.id,
            customer: null,
        });

        await expect(async () => await post(body)).rejects.toThrow("Already registered");
    })
})
