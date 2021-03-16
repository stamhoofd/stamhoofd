import { Request } from "@simonbackx/simple-endpoints";
import { EncryptedMember, KeychainedResponse, User as UserStruct } from '@stamhoofd/structures';
import { Sorter } from '@stamhoofd/utility';

import { GroupFactory } from '../factories/GroupFactory';
import { MemberFactory } from '../factories/MemberFactory';
import { OrganizationFactory } from '../factories/OrganizationFactory';
import { RegistrationFactory } from '../factories/RegistrationFactory';
import { UserFactory } from '../factories/UserFactory';
import { Member } from '../models/Member';
import { Token } from '../models/Token';
import { GetUserMembersEndpoint } from './GetUserMembersEndpoint';


describe("Endpoint.GetUserMembers", () => {
    // Test endpoint
    const endpoint = new GetUserMembersEndpoint();

    test("Request user members when signed in", async () => {
        const organization = await new OrganizationFactory({}).create()
        const group = await new GroupFactory({ organization }).create()
        const userFactory = new UserFactory({ organization })
        const user = await userFactory.create()
        const members = await new MemberFactory({ user, userPrivateKey: userFactory.lastPrivateKey }).createMultiple(2)

        // Register one of the members and create a payment
        const registration = await new RegistrationFactory({ member: members[0], group }).create()

        const token = await Token.createToken(user)

        const r = Request.buildJson("GET", "/v1/user/members", organization.getApiHost());
        r.headers.authorization = "Bearer " + token.accessToken

        const response = await endpoint.test(r);
        expect(response.body).toBeDefined();
        expect(response.body).toBeInstanceOf(KeychainedResponse)

        expect(response.body.data).toHaveLength(2)
        expect(response.body.keychainItems).toHaveLength(2)

        expect(
            response.body.data.map(
                m => 
                    Object.assign({}, m, { 
                        updatedAt: undefined, 
                        createdAt: undefined 
                    })
                )
            .sort(Sorter.byID)
        ).toEqual(
            members.map(
                m => 
                Object.assign({ 
                    registrations: m.id === members[0].id ? [registration.getStructure()] : [], 
                    users: [UserStruct.create(user)] 
                }, EncryptedMember.create(m), { 
                    updatedAt: undefined, 
                    createdAt: undefined 
                })
            ).sort(Sorter.byID)
        )
        //expect(response.body.keychainItems.map(i => i.publicKey)).toIncludeSameMembers(members.map(m => m.publicKey))
        throw new Error("Todo: update")
    });

    test("Request user without members", async () => {
        const organization = await new OrganizationFactory({}).create()
        const group = await new GroupFactory({ organization }).create()
        const userFactory = new UserFactory({ organization })
        const user = await userFactory.create()

        const token = await Token.createToken(user)

        const r = Request.buildJson("GET", "/v5/user/members", organization.getApiHost());
        r.headers.authorization = "Bearer " + token.accessToken

        const response = await endpoint.test(r);
        expect(response.body).toBeDefined();
        expect(response.body).toBeInstanceOf(KeychainedResponse)

        expect(response.body.data).toHaveLength(0)
        expect(response.body.keychainItems).toHaveLength(0)
    });

    test("Member with multiple registrations", async () => {
        const organization = await new OrganizationFactory({}).create()
        const groups = await new GroupFactory({ organization }).createMultiple(2)
        const userFactory = new UserFactory({ organization })
        const user = await userFactory.create()
        const member = await new MemberFactory({ user, userPrivateKey: userFactory.lastPrivateKey }).create()

        // Register one of the members and create a payment
        const registration = await new RegistrationFactory({ member, group: groups[0] }).create()
        const registration2 = await new RegistrationFactory({ member, group: groups[1] }).create()

        const token = await Token.createToken(user)

        const r = Request.buildJson("GET", "/v1/user/members", organization.getApiHost());
        r.headers.authorization = "Bearer " + token.accessToken

        const response = await endpoint.test(r);
        expect(response.body).toBeDefined();
        expect(response.body).toBeInstanceOf(KeychainedResponse)

        expect(response.body.data).toHaveLength(1)
        expect(response.body.keychainItems).toHaveLength(1)
        expect(response.body.data[0]).toMatchObject(EncryptedMember.create(member))
        expect(response.body.data[0].registrations).toIncludeSameMembers([registration.getStructure(), registration2.getStructure()])
        //expect(response.body.keychainItems[0].publicKey).toEqual(member.publicKey)
        throw new Error("Todo: update")
    });

    test("Request user members when signed in when no member is registered yet", async () => {
        const organization = await new OrganizationFactory({}).create()
        const userFactory = new UserFactory({ organization })
        const user = await userFactory.create()
        const members = await new MemberFactory({ user, userPrivateKey: userFactory.lastPrivateKey }).createMultiple(2)
        const token = await Token.createToken(user)

        const r = Request.buildJson("GET", "/v1/user/members", organization.getApiHost());
        r.headers.authorization = "Bearer " + token.accessToken

        const response = await endpoint.test(r);
        expect(response.body).toBeDefined();
        expect(response.body).toBeInstanceOf(KeychainedResponse)

        expect(response.body.data).toHaveLength(2)
        expect(response.body.keychainItems).toHaveLength(2)

        expect(
            response.body.data.map(
                m => 
                    Object.assign({}, m, { 
                        updatedAt: undefined, 
                        createdAt: undefined 
                    })
                )
            .sort(Sorter.byID)
        ).toEqual(
            members.map(
                m => 
                Object.assign({ 
                    registrations: [], 
                    users: [UserStruct.create(user)] 
                }, EncryptedMember.create(m), { 
                    updatedAt: undefined, 
                    createdAt: undefined 
                })
            ).sort(Sorter.byID)
        )
        
        //expect(response.body.keychainItems.map(i => i.publicKey)).toIncludeSameMembers(members.map(m => m.publicKey))
        throw new Error("Todo: update")
    });

    test("Do not include keychain items of other users when no member is registered yet", async () => {
        const organization = await new OrganizationFactory({}).create()
        const userFactory = new UserFactory({ organization })
        const user = await userFactory.create()
        const members = await new MemberFactory({ user, userPrivateKey: userFactory.lastPrivateKey }).createMultiple(2)

        // userB only has access to the encrypted data, he doesn't have keychain items (yet)
        const userB = await userFactory.create()

        // Give userB access to the users
        await Member.users.reverse("members").link(userB, members)

        // Continue as normal
        const token = await Token.createToken(userB)

        const r = Request.buildJson("GET", "/v1/user/members", organization.getApiHost());
        r.headers.authorization = "Bearer " + token.accessToken

        const response = await endpoint.test(r);
        expect(response.body).toBeDefined();
        expect(response.body).toBeInstanceOf(KeychainedResponse)

        expect(response.body.data).toHaveLength(2)
        expect(response.body.keychainItems).toHaveLength(0)
         expect(
            response.body.data.map(
                m => 
                    Object.assign({}, m, { 
                        updatedAt: undefined, 
                        createdAt: undefined 
                    })
                )
            .sort(Sorter.byID)
        ).toEqual(
            members.map(
                m => 
                Object.assign({ 
                    registrations: [], 
                    // todo: this will return two users as soon as we fix this issue (currenlty only returning currently signed in user)
                    users: [UserStruct.create(userB)] 
                }, EncryptedMember.create(m), { 
                    updatedAt: undefined, 
                    createdAt: undefined 
                })
            ).sort(Sorter.byID)
        )
    });

    test("Request user details when not signed in is not working", async () => {
        const organization = await new OrganizationFactory({}).create()
        const user = await new UserFactory({ organization }).create()
        const token = await Token.createToken(user)

        const r = Request.buildJson("GET", "/v1/user/members", organization.getApiHost());

        await expect(endpoint.test(r)).rejects.toThrow(/missing/i)
    });

    test("Request user details with invalid token is not working", async () => {
        const organization = await new OrganizationFactory({}).create()
        const user = await new UserFactory({ organization }).create()
        const token = await Token.createToken(user)

        const r = Request.buildJson("GET", "/v1/user/members", organization.getApiHost());
        r.headers.authorization = "Bearer " + token.accessToken + "d"

        await expect(endpoint.test(r)).rejects.toThrow(/invalid/i)
    });

    test("Request user details with expired token is not working", async () => {
        const organization = await new OrganizationFactory({}).create()
        const user = await new UserFactory({ organization }).create()
        const token = await Token.createExpiredToken(user)

        const r = Request.buildJson("GET", "/v1/user/members", organization.getApiHost());
        r.headers.authorization = "Bearer " + token.accessToken

        await expect(endpoint.test(r)).rejects.toThrow(/expired/i)
    });


});
