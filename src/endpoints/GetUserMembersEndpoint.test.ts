import { Request } from "@simonbackx/simple-endpoints";
import { EncryptedMember, EncryptedMemberWithRegistrations,KeychainedResponse } from '@stamhoofd/structures';

import { GroupFactory } from '../factories/GroupFactory';
import { MemberFactory } from '../factories/MemberFactory';
import { OrganizationFactory } from '../factories/OrganizationFactory';
import { RegistrationFactory } from '../factories/RegistrationFactory';
import { UserFactory } from '../factories/UserFactory';
import { Token } from '../models/Token';
import { User } from '../models/User';
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
        expect(response.body.data).toIncludeSameMembers(members.map(m => EncryptedMemberWithRegistrations.create(Object.assign({ registrations: m.id === members[0].id ? [registration.getStructure()] : [] }, m))))
        expect(response.body.keychainItems.map(i => i.publicKey)).toIncludeSameMembers(members.map(m => m.publicKey))
    });

    test("Request user members when signed in when no member is registered yet", async () => {
        const organization = await new OrganizationFactory({}).create()
        const userFactory = new UserFactory({ organization })
        const user = await userFactory.create()
        const members = await new MemberFactory({ user, userPrivateKey: userFactory.lastPrivateKey }).createMultiple(2)
        const token = await Token.createToken(user)

        const r = Request.buildJson("GET", "/v1/user/members", organization.getApiHost());
        r.headers.authorization = "Bearer "+token.accessToken

        const response = await endpoint.test(r);
        expect(response.body).toBeDefined();
        expect(response.body).toBeInstanceOf(KeychainedResponse)

        expect(response.body.data).toHaveLength(2)
        expect(response.body.keychainItems).toHaveLength(2)
        expect(response.body.data).toIncludeSameMembers(members.map(m => EncryptedMemberWithRegistrations.create(Object.assign({registrations: []}, m))))
        expect(response.body.keychainItems.map(i => i.publicKey)).toIncludeSameMembers(members.map(m => m.publicKey))
    });

    test("Do not include keychain items of other users when no member is registered yet", async () => {
        const organization = await new OrganizationFactory({}).create()
        const userFactory = new UserFactory({ organization })
        const user = await userFactory.create()
        const members = await new MemberFactory({ user, userPrivateKey: userFactory.lastPrivateKey }).createMultiple(2)

        // userB only has access to the encrypted data, he doesn't have keychain items (yet)
        const userB = await userFactory.create()

        // Give userB access to the users
        await User.members.link(userB, members)

        // Continue as normal
        const token = await Token.createToken(userB)

        const r = Request.buildJson("GET", "/v1/user/members", organization.getApiHost());
        r.headers.authorization = "Bearer " + token.accessToken

        const response = await endpoint.test(r);
        expect(response.body).toBeDefined();
        expect(response.body).toBeInstanceOf(KeychainedResponse)

        expect(response.body.data).toHaveLength(2)
        expect(response.body.keychainItems).toHaveLength(0)
        expect(response.body.data).toIncludeAllMembers(members.map(m => EncryptedMemberWithRegistrations.create(Object.assign({ registrations: [] }, m))))
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
        r.headers.authorization = "Bearer " + token.accessToken+"d"

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
