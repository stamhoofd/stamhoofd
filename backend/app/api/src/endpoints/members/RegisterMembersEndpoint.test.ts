import { Request } from "@simonbackx/simple-endpoints";
import { Group, GroupFactory, MemberFactory, Organization, OrganizationFactory, Token, UserFactory,UserWithOrganization } from "@stamhoofd/models";
import { IDRegisterCart, IDRegisterCheckout, IDRegisterItem, Member, PaymentMethod } from "@stamhoofd/structures";

import { RegisterMembersEndpoint } from "./RegisterMembersEndpoint";

describe("Endpoint.RegisterMembersEndpoint", () => {
// Test endpoint
    const endpoint = new RegisterMembersEndpoint();
    let organization: Organization, groups: Group[], user: UserWithOrganization, token: Token;

    beforeAll(async () => {
        organization = await new OrganizationFactory({}).create();
        groups = await new GroupFactory({ organization }).createMultiple(2)
        user = await new UserFactory({ organization }).create();
        token = await Token.createToken(user)
    });

    it.todo('creates a balance item for free contributions'); 
    it.todo('correctly handles online payment exchanges'); 
    it.todo('correctly handles registrations for members on the waiting list'); 
    it.todo('correctly handles invites for waiting list'); 
    it.todo('throws an error if the price is different in the frontend and backend'); 

    it("Register some members", async () => {
        const member = await new MemberFactory({user}).create();

        const checkout = IDRegisterCheckout.create({
            cart: IDRegisterCart.create({
                items: [
                    IDRegisterItem.create({
                        memberId: member.id,
                        groupId: groups[0].id,
                        reduced: false,
                        waitingList: false,
                    })
                ],
                freeContribution: 1500
            }),
            paymentMethod: PaymentMethod.Transfer
        });
        checkout.cart.calculatePrices([member.getStructureWithRegistrations()], groups.map(g => g.getStructure()), organization.meta.categories);
        const request = Request.buildJson("POST", "/v203/members/register", organization.getApiHost(), checkout);

        request.headers.authorization = "Bearer " + token.accessToken

        const response = await endpoint.test(request);
        const data = response.body;

        expect(data).toBeDefined();

        // Check payment created

        // Check registrations

        // Check balance items created succesfully
        // with pending status


        /*const r = Request.buildJson("POST", "/v1/organizations", "todo-host.be", {
            // eslint-disable-next-line @typescript-eslint/camelcase
            organization: {
                id: organizationId,
                name: "My endpoint test organization",
                publicKey: organizationKeyPair.publicKey,
                meta: {
                    type: "Other",
                    umbrellaOrganization: null,
                    genderType: OrganizationGenderType.Mixed,
                    expectedMemberCount: 120,
                    defaultPrices: [],
                    defaultEndDate: new Date().getTime(),
                    defaultStartDate: new Date().getTime()
                },
                address: {
                    street: "Demostraat",
                    number: "12",
                    city: "Gent",
                    postalCode: "9000",
                    country: Country.Belgium
                }
            },
            privateMeta: null,
            user: {
                id: userId,
                email: "admin@domain.com",
                publicKey: userKeyPair.publicKey,
                publicAuthSignKey: authSignKeyPair.publicKey,
                // Indirectly the server can have access to the private key during moments where he can read the password (= login and register)
                // encryptedPrivateKey is optional, and is only needed for browser based users. Users that use the apps will have a better
                // (= forward secrecy) protection against a compromised server
                encryptedPrivateKey: await Sodium.encryptMessage(userKeyPair.privateKey, authEncryptionSecretKey),
                authSignKeyConstants: authSignKeyConstants,
                authEncryptionKeyConstants: authSignKeyConstants,
            },
            keychainItems: [
                // Give access to the private key of the organization by encrypting the private key of the organization with the private key of the user
                KeychainItem.create({
                    publicKey: organizationKeyPair.publicKey,
                    // encrypted private key is always authenticated with the private key of the user
                    encryptedPrivateKey: await Sodium.sealMessageAuthenticated(organizationKeyPair.privateKey, userKeyPair.publicKey, userKeyPair.privateKey),
                }).encode({ version: 1 }),
            ]
        });

        const response = await endpoint.test(r);
        expect(response.body).toBeDefined();

        // Access token should be expired (todo for email validation)
        // expect(response.body.accessTokenValidUntil).toBeBefore(new Date());
        expect(response.body).toBeInstanceOf(SignupResponse);

        expect(response.status).toEqual(200);

        const organization = await Organization.getByURI(Formatter.slug("My endpoint test organization"));
        expect(organization).toBeDefined();
        if (!organization) throw new Error("impossible");

        const token = await EmailVerificationCode.poll(organizationId, response.body.token);
        expect(token).toEqual(true)
        if (!token) throw new Error("impossible");
        //expect(token.accessTokenValidUntil).toBeBefore(new Date());

        //const user = await User.login(organization, "admin@domain.com", "My user password");
        //expect(user).toBeDefined();
        */
    });

});