import { Request } from "@simonbackx/simple-endpoints";
import { GroupFactory, OrganizationFactory, Token, UserFactory } from '@stamhoofd/models';
import { KeychainedResponse, Organization, PermissionLevel, Permissions } from '@stamhoofd/structures';

import { testServer } from "../../../../../tests/helpers/TestServer";
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
        r.headers.authorization = "Bearer " + token.accessToken

        const response = await testServer.test(endpoint, r);
        expect(response.body).toBeDefined();

        if (!(response.body instanceof KeychainedResponse)) {
            throw new Error("Expected KeychainedResponse")
        }

        if (!(response.body.data instanceof Organization)) {
            throw new Error("Expected Organization")
        }

        expect(response.body.data.id).toEqual(organization.id)
        expect(response.body.data.groups.map(g => g.id).sort()).toEqual(groups.map(g => g.id).sort())
        expect(response.body.data.privateMeta).toEqual(null)
    });

    test("Get organization as admin", async () => {
        const organization = await new OrganizationFactory({}).create()
        const user = await new UserFactory({
            organization,
            permissions: Permissions.create({
                level: PermissionLevel.Read
            })
        }).create()

        const groups = await new GroupFactory({ organization }).createMultiple(2)
        const token = await Token.createToken(user)

        const r = Request.buildJson("GET", "/v3/organization", organization.getApiHost());
        r.headers.authorization = "Bearer " + token.accessToken

        const response = await testServer.test(endpoint, r);
        expect(response.body).toBeDefined();

        if (!(response.body instanceof KeychainedResponse)) {
            throw new Error("Expected KeychainedResponse")
        }

        if (!(response.body.data instanceof Organization)) {
            throw new Error("Expected Organization")
        }

        expect(response.body.data.id).toEqual(organization.id)
        expect(response.body.data.groups.map(g => g.id).sort()).toEqual(groups.map(g => g.id).sort())
        expect(response.body.data.privateMeta).not.toEqual(null)
    });

     test("Get organization as admin of a different organization", async () => {
        const organization = await new OrganizationFactory({}).create()
        const organization2 = await new OrganizationFactory({}).create()
        const user = await new UserFactory({
            organization: organization2,
            permissions: Permissions.create({
                level: PermissionLevel.Read
            })
        }).create()

        const token = await Token.createToken(user)

        const r = Request.buildJson("GET", "/v3/organization", organization.getApiHost());
        r.headers.authorization = "Bearer " + token.accessToken

        await expect(testServer.test(endpoint, r)).rejects.toThrow('The access token is invalid');
    });

});
