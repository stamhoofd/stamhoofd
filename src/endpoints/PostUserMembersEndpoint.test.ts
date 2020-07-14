import { Request } from "@simonbackx/simple-endpoints";
import { EncryptedMember, KeychainedResponse } from '@stamhoofd/structures';

import { EncryptedMemberFactory } from '../factories/EncryptedMemberFactory';
import { OrganizationFactory } from '../factories/OrganizationFactory';
import { UserFactory } from '../factories/UserFactory';
import { Token } from '../models/Token';
import { User } from '../models/User';
import { PostUserMembersEndpoint } from './PostUserMembersEndpoint';


describe("Endpoint.PostUserMembers", () => {
    // Test endpoint
    const endpoint = new PostUserMembersEndpoint();

    test("Register a new member", async () => {
        const organization = await new OrganizationFactory({}).create()
        const userFactory = new UserFactory({ organization })
        const user = await userFactory.create()

        const memberData = await new EncryptedMemberFactory({ user, userPrivateKey: userFactory.lastPrivateKey }).createMultiple(2)
        const members = memberData.map(m => m[0])
        const keychainItems = memberData.flatMap(m => m[1] ? [m[1]] : [])

        const token = await Token.createToken(user)

        const r = Request.buildJson("POST", "/v3/user/members", organization.getApiHost(), {
            addMembers: members,
            updateMembers: [],
            keychainItems: keychainItems
        });
        r.headers.authorization = "Bearer "+token.accessToken

        const response = await endpoint.test(r);
        expect(response.body).toBeDefined();
        expect(response.body).toBeInstanceOf(KeychainedResponse)

        expect(response.body.data).toHaveLength(2)
        expect(response.body.keychainItems).toHaveLength(2)
        expect(response.body.data).toIncludeAllMembers(members)
        expect(response.body.keychainItems.map(i => i.publicKey)).toIncludeAllMembers(members.map(m => m.publicKey))
    });
});
