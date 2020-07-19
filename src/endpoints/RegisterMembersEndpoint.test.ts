import { Request } from "@simonbackx/simple-endpoints";
import { EncryptedMember, KeychainedResponse, Payment } from '@stamhoofd/structures';
import { group } from "console";

import { GroupFactory } from '../factories/GroupFactory';
import { MemberFactory } from '../factories/MemberFactory';
import { OrganizationFactory } from '../factories/OrganizationFactory';
import { UserFactory } from '../factories/UserFactory';
import { Token } from '../models/Token';
import { RegisterMembersEndpoint } from './RegisterMembersEndpoint';


describe("Endpoint.RegisterMembers", () => {
    // Test endpoint
    const endpoint = new RegisterMembersEndpoint();

    test("Register a new member", async () => {
        const organization = await new OrganizationFactory({}).create()
        const userFactory = new UserFactory({ organization })
        const group = await new GroupFactory({ organization }).create()

        const user = await userFactory.create()
        const members = await new MemberFactory({ organization, user }).createMultiple(2)

        const token = await Token.createToken(user)

        const r = Request.buildJson("POST", "/v5/user/members/register", organization.getApiHost(), {
            members: members.map(m => {
                return { 
                    memberId: m.id,
                    groupId: group.id,
                    reduced: false
                }
            }),
            paymentMethod: "Transfer"
        });
        r.headers.authorization = "Bearer " + token.accessToken

        const response = await endpoint.test(r);
        expect(response.body).toBeDefined();
        expect(response.body).toBeInstanceOf(Payment)

        expect(response.body.status).toEqual("Succeeded")
        expect(response.body.method).toEqual("Transfer")
        expect(response.body.price).toEqual(400 * 2)
    });

});
