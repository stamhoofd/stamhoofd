import { OrganizationFactory } from "@stamhoofd-backend/app/src/organizations/factories/OrganizationFactory";
import { Organization } from "@stamhoofd-backend/app/src/organizations/models/Organization";
import { Request } from "@stamhoofd-backend/routing";

import { UserFactory } from "../factories/UserFactory";
import { Token } from '../models/Token';
import { User,UserWithOrganization } from "../models/User";
import { TokenStruct } from "../structs/TokenStruct";
import { CreateTokenEndpoint } from "./CreateTokenEndpoint";

describe("Endpoint.CreateToken", () => {
    // Test endpoint
    const endpoint = new CreateTokenEndpoint();
    let organization: Organization;
    let otherOrganization: Organization;
    let user: UserWithOrganization;
    let unverifiedUser: UserWithOrganization;
    const password = "my test password";

    beforeAll(async () => {
        organization = await new OrganizationFactory({}).create();
        otherOrganization = await new OrganizationFactory({}).create();

        // Create user
        user = await new UserFactory({ organization, password }).create();
        if (!user) {
            throw new Error("Could not register user for testing");
        }

        unverifiedUser = await new UserFactory({ organization, password, verified: false }).create();
        if (!unverifiedUser) {
            throw new Error("Could not register user for testing");
        }
    });

    test("Log a user in", async () => {
        const r = Request.buildJson("POST", "/oauth/token", organization.getApiHost(), {
            // eslint-disable-next-line @typescript-eslint/camelcase
            grant_type: "password",
            username: user.email,
            password: password,
            deviceName: "iPhone of Tim",
        });

        const response = await endpoint.getResponse(r, {});
        expect(response.body).toBeInstanceOf(TokenStruct);
        expect(response.body.accessToken.length).toBeGreaterThan(40);
        expect(response.body.refreshToken.length).toBeGreaterThan(40);
        expect(response.body.accessTokenValidUntil).toBeValidDate();
        expect(response.body.accessTokenValidUntil).toBeAfter(new Date());
    });

    test("Log a unverified user in", async () => {
        const r = Request.buildJson("POST", "/oauth/token", organization.getApiHost(), {
            // eslint-disable-next-line @typescript-eslint/camelcase
            grant_type: "password",
            username: unverifiedUser.email,
            password: password,
            deviceName: "iPhone of Tim",
        });

        // The access token should be expired
        const response = await endpoint.getResponse(r, {});
        expect(response.body).toBeInstanceOf(TokenStruct);
        expect(response.body.accessToken.length).toBeGreaterThan(40);
        expect(response.body.refreshToken.length).toBeGreaterThan(40);
        expect(response.body.accessTokenValidUntil).toBeValidDate();
        expect(response.body.accessTokenValidUntil).toBeBefore(new Date());
    });

    test("Login wrong organization", async () => {
        const r = Request.buildJson("POST", "/oauth/token", otherOrganization.getApiHost(), {
            // eslint-disable-next-line @typescript-eslint/camelcase
            grant_type: "password",
            username: user.email,
            password: password,
            deviceName: "iPhone of Tim",
        });

        await expect(endpoint.getResponse(r, {})).rejects.toThrow(/Invalid username or password/);
    });

    test("Login invalid organization", async () => {
        const r = Request.buildJson("POST", "/oauth/token", "invalid94558451sd5f65sd.stamhoofd.be", {
            // eslint-disable-next-line @typescript-eslint/camelcase
            grant_type: "password",
            username: user.email,
            password: password,
            deviceName: "iPhone of Tim",
        });

        await expect(endpoint.getResponse(r, {})).rejects.toThrow(/Unknown organization/);
    });

    test("Login with a wrong password", async () => {
        const r = Request.buildJson("POST", "/oauth/token", organization.getApiHost(), {
            // eslint-disable-next-line @typescript-eslint/camelcase
            grant_type: "password",
            username: user.email,
            password: "my test passwor",
            deviceName: "iPhone of Tim",
        });

        await expect(endpoint.getResponse(r, {})).rejects.toThrow(/Invalid username or password/);
    });

    test("Login with non existing email", async () => {
        const r = Request.buildJson("POST", "/oauth/token", organization.getApiHost(), {
            // eslint-disable-next-line @typescript-eslint/camelcase
            grant_type: "password",
            username: "create-token95959451218181@domain.com",
            password: password,
            deviceName: "iPhone of Tim",
        });

        await expect(endpoint.getResponse(r, {})).rejects.toThrow(/Invalid username or password/);
    });

    test("Refresh a token", async () => {
        const token = await Token.createExpiredToken(user)
        const r = Request.buildJson("POST", "/oauth/token", organization.getApiHost(), {
            // eslint-disable-next-line @typescript-eslint/camelcase
            grant_type: "refresh_token",
            // eslint-disable-next-line @typescript-eslint/camelcase
            refresh_token: token.refreshToken
        });

        const response = await endpoint.getResponse(r, {});
        expect(response.body).toBeInstanceOf(TokenStruct);
        expect(response.body.accessToken.length).toBeGreaterThan(40);
        expect(response.body.refreshToken.length).toBeGreaterThan(40);
        expect(response.body.accessToken).not.toEqual(token.accessToken)
        expect(response.body.refreshToken).not.toEqual(token.refreshToken)
        expect(response.body.accessTokenValidUntil).toBeValidDate();

        // Check if our old refresh token is still valid, in case of a network error, but only for maximum one hour
        // And the access token should be invalid
        const oldToken = await Token.getByAccessToken(token.accessToken, true)
        expect(oldToken).toBeDefined()
        if (!oldToken) throw new Error("unexpected")
        expect(oldToken?.accessTokenValidUntil).toBeBefore(new Date())
        expect(oldToken?.refreshTokenValidUntil).toBeAfter(new Date())

        expect(oldToken.accessToken).toEqual(token.accessToken)
        expect(oldToken.refreshToken).toEqual(token.refreshToken)
        
    });

    test("Refresh an expired token", async () => {
        const token = await Token.createUnsavedToken(user)
        // Warning: set at least one second back, since saved in database without milliseconds! 
        token.refreshTokenValidUntil = new Date(Date.now() - 1000); 
        await token.save()
        const r = Request.buildJson("POST", "/oauth/token", organization.getApiHost(), {
            // eslint-disable-next-line @typescript-eslint/camelcase
            grant_type: "refresh_token",
            // eslint-disable-next-line @typescript-eslint/camelcase
            refresh_token: token.refreshToken
        });

        await expect(endpoint.getResponse(r, {})).rejects.toThrow(/Invalid refresh/);

        // Await and check if the token is deleted (warning: this happens async from the endpoint)
        const oldToken = await Token.getByAccessToken(token.accessToken, true)
        expect(oldToken).not.toBeDefined()
    });

    test("Refresh when a user is not yet verified", async () => {
        const token = await Token.createExpiredToken(unverifiedUser)
        const r = Request.buildJson("POST", "/oauth/token", organization.getApiHost(), {
            // eslint-disable-next-line @typescript-eslint/camelcase
            grant_type: "refresh_token",
            // eslint-disable-next-line @typescript-eslint/camelcase
            refresh_token: token.refreshToken
        });

        await expect(endpoint.getResponse(r, {})).rejects.toThrow(/verified/);

        // Await and check if the token is not deleted
        const oldToken = await Token.getByAccessToken(token.accessToken, true)
        expect(oldToken).toBeDefined()
    });
});
