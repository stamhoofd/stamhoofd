import { CreateTokenEndpoint } from "./CreateTokenEndpoint";
import { Request } from "@/routing/classes/Request";
import { UserWithOrganization } from "../models/User";
import { TokenStruct } from "../structs/TokenStruct";
import { Organization } from "@/organizations/models/Organization";
import { OrganizationFactory } from "@/organizations/factories/OrganizationFactory";
import { UserFactory } from "../factories/UserFactory";

describe("Endpoint.CreateToken", () => {
    // Test endpoint
    const endpoint = new CreateTokenEndpoint();
    let organization: Organization;
    let otherOrganization: Organization;
    let user: UserWithOrganization;
    const password = "my test password";

    beforeAll(async () => {
        organization = await new OrganizationFactory({}).create();
        otherOrganization = await new OrganizationFactory({}).create();

        // Create user
        user = await new UserFactory({ organization, password }).create();
        if (!user) {
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
});
