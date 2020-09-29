import { Request } from "@simonbackx/simple-endpoints";
import { PaymentStatus,PermissionLevel,Permissions } from '@stamhoofd/structures';

import { GroupFactory } from '../factories/GroupFactory';
import { MemberFactory } from '../factories/MemberFactory';
import { OrganizationFactory } from '../factories/OrganizationFactory';
import { RegistrationFactory } from '../factories/RegistrationFactory';
import { UserFactory } from '../factories/UserFactory';
import { Token } from '../models/Token';
import { PatchOrganizationPaymentsEndpoint } from './PatchOrganizationPaymentsEndpoint';


describe("Endpoint.PatchOrganizationPayments", () => {
    // Test endpoint
    const endpoint = new PatchOrganizationPaymentsEndpoint();

    test("Update payments", async () => {
        const organization = await new OrganizationFactory({}).create()
        const group = await new GroupFactory({ organization }).create()
        const group2 = await new GroupFactory({ organization }).create()
        const userFactory = new UserFactory({ organization, permissions: Permissions.create({ level: PermissionLevel.Full })  })
        const user = await userFactory.create()
        const members = await new MemberFactory({ user, userPrivateKey: userFactory.lastPrivateKey }).createMultiple(3)

        // Register one of the members and create multiple payments
        const registrations = [
            await new RegistrationFactory({ member: members[0], group }).create(),
            await new RegistrationFactory({ member: members[0], group: group2 }).create(),
            await new RegistrationFactory({ member: members[1], group }).create()
        ]

        const token = await Token.createToken(user)

        const r = Request.buildJson("PATCH", "/v6/organization/payments", organization.getApiHost(), [
            {
                id: registrations[1].payment!.id,
                status: PaymentStatus.Failed
            },
            {
                id: registrations[2].payment!.id,
                status: PaymentStatus.Failed
            }
        ]);
        r.headers.authorization = "Bearer " + token.accessToken

        const response = await endpoint.test(r);
        expect(response.body).toBeDefined();

        expect(response.body).toHaveLength(3)
        expect(response.body.map(a => a.id)).toIncludeSameMembers(registrations.map(r => r.payment?.id))
    
    });

    test("No access for normal users", async () => {
        const organization = await new OrganizationFactory({}).create()
        const userFactory = new UserFactory({ organization })
        const user = await userFactory.create()
        const token = await Token.createToken(user)

        const r = Request.buildJson("PATCH", "/v6/organization/payments", organization.getApiHost(), []);
        r.headers.authorization = "Bearer " + token.accessToken

        await expect(endpoint.test(r)).rejects.toThrow(/permission/)
    });

});
