import { Request } from "@simonbackx/simple-endpoints";
import { Organization, PermissionLevel,Permissions } from '@stamhoofd/structures';

import { GroupFactory } from '../factories/GroupFactory';
import { OrganizationFactory } from '../factories/OrganizationFactory';
import { UserFactory } from '../factories/UserFactory';
import { Token } from '../models/Token';
import { PatchOrganizationEndpoint } from './PatchOrganizationEndpoint';

describe("Endpoint.PatchOrganization", () => {
    // Test endpoint
    const endpoint = new PatchOrganizationEndpoint();

    test("Change the name of the organization", async () => {
        const organization = await new OrganizationFactory({}).create()
        const user = await new UserFactory({ organization, permissions: Permissions.create({ level: PermissionLevel.Full }) }).create()
        //const groups = await new GroupFactory({ organization }).createMultiple(2)
        const token = await Token.createToken(user)

        const r = Request.buildJson("PATCH", "/v1/organization", organization.getApiHost(), {
            id: organization.id,
            name: "My crazy name"
        });
        r.headers.authorization = "Bearer "+token.accessToken

        const response = await endpoint.test(r);
        expect(response.body).toBeDefined();

        if (!(response.body instanceof Organization)) {
            throw new Error("Expected Organization")
        }

        expect(response.body.id).toEqual(organization.id)
        expect(response.body.name).toEqual("My crazy name")
    });

    test("Can't change organization as a normal user", async () => {
        const organization = await new OrganizationFactory({}).create()
        const user = await new UserFactory({ organization }).create()
        const token = await Token.createToken(user)

        const r = Request.buildJson("PATCH", "/v1/organization", organization.getApiHost(), {
            id: organization.id,
            name: "My crazy name"
        });
        r.headers.authorization = "Bearer " + token.accessToken

        await expect(endpoint.test(r)).rejects.toThrow(/permissions/i);
    });

    test("Can't change organization as a user with read access", async () => {
        const organization = await new OrganizationFactory({}).create()
        const user = await new UserFactory({ organization, permissions: Permissions.create({ level: PermissionLevel.Read }) }).create()
        const token = await Token.createToken(user)

        const r = Request.buildJson("PATCH", "/v1/organization", organization.getApiHost(), {
            id: organization.id,
            name: "My crazy name"
        });
        r.headers.authorization = "Bearer " + token.accessToken

        await expect(endpoint.test(r)).rejects.toThrow(/permissions/i);
    });

});
