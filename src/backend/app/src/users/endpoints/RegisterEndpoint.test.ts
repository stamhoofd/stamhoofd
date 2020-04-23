import { OrganizationFactory } from "@stamhoofd-backend/app/src/organizations/factories/OrganizationFactory";
import { Organization } from "@stamhoofd-backend/app/src/organizations/models/Organization";
import { Request } from "@stamhoofd-backend/routing";
import { Sodium } from "@stamhoofd-common/crypto";

import { UserFactory } from "../factories/UserFactory";
import { UserWithOrganization } from "../models/User";
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
        const keyPair = await Sodium.boxKeyPair();
        const r = Request.buildJson("POST", "/register", organization.getApiHost(), {
            // eslint-disable-next-line @typescript-eslint/camelcase
            email: "endpoint-register-email@domain.be",
            password: password,
            publicKey: keyPair.publicKey,
        });

        const response = await endpoint.getResponse(r, {});
        expect(response.body).toBeUndefined();
        expect(response.status).toEqual(200);
    });

    test("Invalid email address", async () => {
        const keyPair = await Sodium.boxKeyPair();
        const r = Request.buildJson("POST", "/register", organization.getApiHost(), {
            // eslint-disable-next-line @typescript-eslint/camelcase
            email: "invali@demailaddre@s.be",
            password: password,
            publicKey: keyPair.publicKey,
        });

        await expect(endpoint.getResponse(r, {})).rejects.toThrow(/email/);
    });

    test("User already exists returns success", async () => {
        const keyPair = await Sodium.boxKeyPair();
        const r = Request.buildJson("POST", "/register", organization.getApiHost(), {
            // eslint-disable-next-line @typescript-eslint/camelcase
            email: user.email,
            password: password,
            publicKey: keyPair.publicKey,
        });

        // Exactly the same response, since a password recovery email will get send, instead of a registration
        // This is to prevent user enumeration attacks
        const response = await endpoint.getResponse(r, {});
        expect(response.body).toBeUndefined();
        expect(response.status).toEqual(200);
    });
});
