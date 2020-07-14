import { Request } from "@simonbackx/simple-endpoints";
import { KeychainedResponse,Organization, PermissionLevel,Permissions } from '@stamhoofd/structures';

import { GroupFactory } from '../factories/GroupFactory';
import { OrganizationFactory } from '../factories/OrganizationFactory';
import { UserFactory } from '../factories/UserFactory';
import { Token } from '../models/Token';
import { GetOrganizationEndpoint } from './GetOrganizationEndpoint';

describe("Endpoint.GetOrganization", () => {
    // Test endpoint
    const endpoint = new GetOrganizationEndpoint();

    test("Get organization as signed in user", async () => {
        const organization = await new OrganizationFactory({}).create()
        const user = await new UserFactory({ organization }).create()
        const groups = await new GroupFactory({ organization }).createMultiple(2)
        const token = await Token.createToken(user)

        const r = Request.buildJson("GET", "/v3/organization", organization.getApiHost());
        r.headers.authorization = "Bearer "+token.accessToken

        const response = await endpoint.test(r);
        expect(response.body).toBeDefined();

        if (!(response.body instanceof KeychainedResponse)) {
            throw new Error("Expected KeychainedResponse")
        }

        if (!(response.body.data instanceof Organization)) {
            throw new Error("Expected Organization")
        }

        expect(response.body.data.id).toEqual(organization.id)
        expect(response.body.data.groups.map(g => g.id).sort()).toEqual(groups.map(g => g.id).sort())
        expect(response.body.keychainItems).toHaveLength(0)
    });

    test("Get organization as admin with keys", async () => {
        const user = await new UserFactory({ 
            permissions: Permissions.create({ 
                level: PermissionLevel.Read 
            }) 
        }).create()
        const organization = user.organization

        const groups = await new GroupFactory({ organization }).createMultiple(2)
        const token = await Token.createToken(user)

        const r = Request.buildJson("GET", "/v3/organization", organization.getApiHost());
        r.headers.authorization = "Bearer " + token.accessToken

        const response = await endpoint.test(r);
        expect(response.body).toBeDefined();

        if (!(response.body instanceof KeychainedResponse)) {
            throw new Error("Expected KeychainedResponse")
        }

        if (!(response.body.data instanceof Organization)) {
            throw new Error("Expected Organization")
        }

        expect(response.body.data.id).toEqual(organization.id)
        expect(response.body.data.groups.map(g => g.id).sort()).toEqual(groups.map(g => g.id).sort())
        expect(response.body.keychainItems).toHaveLength(1)
        expect(response.body.keychainItems[0]).toMatchObject({
            userId: user.id,
            publicKey: organization.publicKey
        })
    });

});
