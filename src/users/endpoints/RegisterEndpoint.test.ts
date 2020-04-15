import { Request } from "@/routing/classes/Request";
import { UserWithOrganization } from "../models/User";
import { TokenStruct } from "../structs/TokenStruct";
import { Organization } from "@/organizations/models/Organization";
import { OrganizationFactory } from "@/organizations/factories/OrganizationFactory";
import { UserFactory } from "../factories/UserFactory";
import { RegisterEndpoint } from "./RegisterEndpoint";

describe("Endpoint.Register", () => {
    // Test endpoint
    const endpoint = new RegisterEndpoint();
    let organization: Organization;
    let user: UserWithOrganization;
    const password = "my test password";

    beforeAll(async () => {
        organization = await new OrganizationFactory({}).create();

        // Create user
        user = await new UserFactory({ organization, password }).create();
        if (!user) {
            throw new Error("Could not register user for testing");
        }
    });

    test("Create an account", async () => {
        const r = Request.buildJson("POST", "/register", organization.getApiHost(), {
            // eslint-disable-next-line @typescript-eslint/camelcase
            email: user.email,
            password: password,
            publicKey: "TXkgcHVibGljIGtleQ==",
        });

        const response = await endpoint.getResponse(r, {});
        expect(response.body).toBeInstanceOf(TokenStruct);
        expect(response.body.accessToken.length).toBeGreaterThan(40);
        expect(response.body.refreshToken.length).toBeGreaterThan(40);
        expect(response.body.accessTokenValidUntil).toBeValidDate();
    });

    test("Invalid email address", async () => {
        const r = Request.buildJson("POST", "/register", organization.getApiHost(), {
            // eslint-disable-next-line @typescript-eslint/camelcase
            email: "invali@demailaddre@s.be",
            password: password,
            publicKey: "TXkgcHVibGljIGtleQ==",
        });

        await expect(endpoint.getResponse(r, {})).rejects.toThrow(/email/);
    });
});
