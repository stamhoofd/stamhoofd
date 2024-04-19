import { Request } from "@simonbackx/simple-endpoints";
import { OrganizationFactory, Token, UserFactory, WebshopFactory } from '@stamhoofd/models';
import { PermissionLevel, Permissions, PrivateWebshop, Webshop as WebshopStruct  } from '@stamhoofd/structures';

import { testServer } from "../../../../tests/helpers/TestServer";
import { GetWebshopEndpoint } from './GetWebshopEndpoint';

describe("Endpoint.GetWebshop", () => {
    // Test endpoint
    const endpoint = new GetWebshopEndpoint();

    test("Get webshop as signed in user", async () => {
        const organization = await new OrganizationFactory({}).create()
        const user = await new UserFactory({ organization }).create()
        const token = await Token.createToken(user)
        const webshop = await new WebshopFactory({ organizationId: organization.id }).create()

        const r = Request.buildJson("GET", "/v244/webshop/" + webshop.id, organization.getApiHost());
        r.headers.authorization = "Bearer " + token.accessToken

        const response = await testServer.test(endpoint, r);
        expect(response.body).toBeDefined();

        expect(response.body.id).toEqual(webshop.id)
        expect((response.body as any).privateMeta).toBeUndefined()
    });

    test("Allow access without organization scope in old v243", async () => {
        const organization = await new OrganizationFactory({}).create()
        const webshop = await new WebshopFactory({ organizationId: organization.id }).create()

        const r = Request.buildJson("GET", "/v243/webshop/" + webshop.id);

        const response = await testServer.test(endpoint, r);
        expect(response.body).toBeDefined();

        expect(response.body.id).toEqual(webshop.id)
        expect((response.body as any).privateMeta).toBeUndefined()
    });

    test("Do not allow access without organization scope in v244", async () => {
        const organization = await new OrganizationFactory({}).create()
        const webshop = await new WebshopFactory({ organizationId: organization.id }).create()
        const r = Request.buildJson("GET", "/v244/webshop/" + webshop.id);
        await expect(testServer.test(endpoint, r)).rejects.toThrow('Please specify the organization in the hostname');
    });

    test("Get webshop as admin", async () => {
        const organization = await new OrganizationFactory({}).create()
        const user = await new UserFactory({
            organization,
            permissions: Permissions.create({
                level: PermissionLevel.Read
            })
        }).create()
        const token = await Token.createToken(user)

        const webshop = await new WebshopFactory({ organizationId: organization.id }).create()

        const r = Request.buildJson("GET", "/v244/webshop/" + webshop.id, organization.getApiHost());
        r.headers.authorization = "Bearer " + token.accessToken

        const response = await testServer.test(endpoint, r);
        expect(response.body).toBeDefined();

        expect(response.body.id).toEqual(webshop.id)
        expect((response.body as any).privateMeta).toBeDefined()
    });

    test("Get webshop as admin that does not have access to specific webshop", async () => {
        const organization = await new OrganizationFactory({}).create()
        const user = await new UserFactory({
            organization,
            permissions: Permissions.create({
                level: PermissionLevel.None
            })
        }).create()
        const token = await Token.createToken(user)

        const webshop = await new WebshopFactory({ organizationId: organization.id }).create()

        const r = Request.buildJson("GET", "/v244/webshop/" + webshop.id, organization.getApiHost());
        r.headers.authorization = "Bearer " + token.accessToken

        const response = await testServer.test(endpoint, r);
        expect(response.body).toBeDefined();

        expect(response.body.id).toEqual(webshop.id)
        expect((response.body as any).privateMeta).toBeUndefined()
    });

     test("Get webshop as admin of a different organization", async () => {
        const organization = await new OrganizationFactory({}).create()
        const organization2 = await new OrganizationFactory({}).create()
        const user = await new UserFactory({
            organization: organization2,
            permissions: Permissions.create({
                level: PermissionLevel.Read
            })
        }).create()

        const token = await Token.createToken(user)
        const webshop = await new WebshopFactory({ organizationId: organization.id }).create()

        const r = Request.buildJson("GET", "/v244/webshop/" + webshop.id, organization.getApiHost());
        r.headers.authorization = "Bearer " + token.accessToken

        await expect(testServer.test(endpoint, r)).rejects.toThrow('The access token is invalid');
    });

    test("If organization scope is missing in v243, access is still checked correctly", async () => {
        const organization = await new OrganizationFactory({}).create()
        const organization2 = await new OrganizationFactory({}).create()
        const user = await new UserFactory({
            organization: organization2,
            permissions: Permissions.create({
                level: PermissionLevel.Full
            })
        }).create()

        const token = await Token.createToken(user)
        const webshop = await new WebshopFactory({ organizationId: organization.id }).create()

        const r = Request.buildJson("GET", "/v243/webshop/" + webshop.id);
        r.headers.authorization = "Bearer " + token.accessToken

        await expect(testServer.test(endpoint, r)).rejects.toThrow('The access token is invalid');
    });

});
