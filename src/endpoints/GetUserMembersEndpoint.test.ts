import { Request } from "@simonbackx/simple-endpoints";
import { EncryptedMember } from '@stamhoofd/structures';

import { MemberFactory } from '../factories/MemberFactory';
import { OrganizationFactory } from '../factories/OrganizationFactory';
import { UserFactory } from '../factories/UserFactory';
import { Token } from '../models/Token';
import { GetUserMembersEndpoint } from './GetUserMembersEndpoint';


describe("Endpoint.GetUserMembers", () => {
    // Test endpoint
    const endpoint = new GetUserMembersEndpoint();

    test("Request user members when signed in", async () => {
        const organization = await new OrganizationFactory({}).create()
        const user = await new UserFactory({ organization }).create()
        const members = await new MemberFactory({ user }).createMultiple(2)
        const token = await Token.createToken(user)

        const r = Request.buildJson("GET", "/v1/user/members", organization.getApiHost());
        r.headers.authorization = "Bearer "+token.accessToken

        const response = await endpoint.test(r);
        expect(response.body).toBeDefined();

        expect(response.body).toHaveLength(2)
        expect(response.body).toIncludeAllMembers(members.map(m => EncryptedMember.create(m)))
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
