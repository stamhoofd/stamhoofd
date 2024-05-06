import { Request } from "@simonbackx/simple-endpoints";
import { OrganizationFactory, Token, UserFactory } from "@stamhoofd/models";
import { Token as TokenStruct } from "@stamhoofd/structures";

import { testServer } from "../../../tests/helpers/TestServer";
import { CreateTokenEndpoint } from './CreateTokenEndpoint';

describe("Endpoint.CreateToken", () => {
    // Test endpoint
    const endpoint = new CreateTokenEndpoint();

    test("Can get a token via password flow", async () => {
        const organization = await new OrganizationFactory({}).create()
        // Also check UTF8 passwords
        const password = "54😂test👌🏾86s&é"
        const user = await new UserFactory({ organization, password }).create()

        const r = Request.buildJson("POST", "/oauth/token", organization.getApiHost(), {
            grant_type: "password",
            username: user.email,
            password: password
        });

        const response = await testServer.test(endpoint, r);
        expect(response.body).toBeDefined();

        if (!(response.body instanceof TokenStruct)) {
            throw new Error("Expected TokenStruct")
        }

        // Check token is valid
        const token = await Token.getByAccessToken(response.body.accessToken)
        expect(token).toBeDefined()

        const byRefresh = await Token.getByRefreshToken(response.body.refreshToken)
        expect(byRefresh).toBeDefined()
    });

    test("Can get a token via refresh flow", async () => {
        const organization = await new OrganizationFactory({}).create()
        // Also check UTF8 passwords
        const password = "54😂test👌🏾86s&é"
        const user = await new UserFactory({ organization, password }).create()
        const token = await Token.createToken(user);

        const r = Request.buildJson("POST", "/oauth/token", organization.getApiHost(), {
            grant_type: "refresh_token",
            refresh_token: token.refreshToken
        });

        const response = await testServer.test(endpoint, r);
        expect(response.body).toBeDefined();

        if (!(response.body instanceof TokenStruct)) {
            throw new Error("Expected TokenStruct")
        }

        expect(response.body.accessToken).not.toEqual(token.accessToken)
        expect(response.body.refreshToken).not.toEqual(token.refreshToken)

        // Check token is valid
        const byAccess = await Token.getByAccessToken(response.body.accessToken)
        expect(byAccess).toBeDefined()

        const byRefresh = await Token.getByRefreshToken(response.body.refreshToken)
        expect(byRefresh).toBeDefined()
    });
});
