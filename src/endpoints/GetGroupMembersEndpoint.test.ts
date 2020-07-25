import { Request } from "@simonbackx/simple-endpoints";
import { EncryptedMember, EncryptedMemberWithRegistrations, KeychainedResponse, PermissionLevel,Permissions } from '@stamhoofd/structures';

import { GroupFactory } from '../factories/GroupFactory';
import { MemberFactory } from '../factories/MemberFactory';
import { OrganizationFactory } from '../factories/OrganizationFactory';
import { RegistrationFactory } from '../factories/RegistrationFactory';
import { UserFactory } from '../factories/UserFactory';
import { Token } from '../models/Token';
import { User } from '../models/User';
import { GetGroupMembersEndpoint } from './GetGroupMembersEndpoint';


describe("Endpoint.GetGroupMembers", () => {
    // Test endpoint
    const endpoint = new GetGroupMembersEndpoint();

    test("Request user members when signed in", async () => {
        const organization = await new OrganizationFactory({}).create()
        const group = await new GroupFactory({ organization }).create()
        const group2 = await new GroupFactory({ organization }).create()
        const userFactory = new UserFactory({ organization, permissions: Permissions.create({ level: PermissionLevel.Read }) })
        const members = await new MemberFactory({}).createMultiple(2)

        const user = await userFactory.create()

        // Register one of the members and create a payment
        const registration = await new RegistrationFactory({ member: members[0], group }).create()

        const registration2 = await new RegistrationFactory({ member: members[0], group: group2 }).create()
        await new RegistrationFactory({ member: members[1], group: group2 }).create()

        const token = await Token.createToken(user)

        const r = Request.buildJson("GET", "/v6/organization/group/"+group.id+"/members", organization.getApiHost());
        r.headers.authorization = "Bearer " + token.accessToken

        const response = await endpoint.test(r);
        expect(response.body).toBeDefined();
        expect(response.body).toHaveLength(1)

        expect(response.body[0].registrations).toIncludeSameMembers([registration.getStructure(), registration2.getStructure()])
        expect(response.body[0]).toMatchObject({
            id: members[0].id,
            publicKey: members[0].publicKey,
            encryptedForOrganization: members[0].encryptedForOrganization,
        })
    });
});
