import { User } from "@stamhoofd-backend/app/src/users/models/User";
import { Request } from "@stamhoofd-backend/routing";
import { Sodium } from "@stamhoofd-common/crypto";
import { Formatter } from "@stamhoofd-common/formatting"; 

import { Token } from '../../users/models/Token';
import { TokenStruct } from '../../users/structs/TokenStruct';
import { Organization } from "../models/Organization";
import { CreateOrganizationEndpoint } from "./CreateOrganizationEndpoint";

describe("Endpoint.CreateOrganization", () => {
    // Test endpoint
    const endpoint = new CreateOrganizationEndpoint();

    test("Create an organization", async () => {
        const userKeyPair = await Sodium.boxKeyPair();
        const organizationKeyPair = await Sodium.signKeyPair();

        const r = Request.buildJson("POST", "/organizations", "todo-host.be", {
            // eslint-disable-next-line @typescript-eslint/camelcase
            name: "My endpoint test organization",
            publicKey: organizationKeyPair.publicKey,
            user: {
                email: "admin@domain.com",
                password: "My user password",
                publicKey: userKeyPair.publicKey,
                adminSignature: await Sodium.signMessage(
                    userKeyPair.publicKey,
                    Buffer.from(organizationKeyPair.privateKey, "base64")
                ),
            },
        });

        const response = await endpoint.getResponse(r, {});
        expect(response.body).toBeDefined();

        // Access token should be expired
        expect(response.body.accessTokenValidUntil).toBeBefore(new Date());
        expect(response.body).toBeInstanceOf(TokenStruct);

        expect(response.status).toEqual(200);

        const organization = await Organization.getByURI(Formatter.slug("My endpoint test organization"));
        expect(organization).toBeDefined();
        if (!organization) throw new Error("impossible");

        const token = await Token.getByAccessToken(response.body.accessToken);
        expect(token).toBeDefined();
        if (!token) throw new Error("impossible");
        expect(token.accessTokenValidUntil).toBeBefore(new Date());

        const user = await User.login(organization, "admin@domain.com", "My user password");
        expect(user).toBeDefined();
    });

    test("Organization already exists throws", async () => {
        const userKeyPair = await Sodium.boxKeyPair();
        const organizationKeyPair = await Sodium.signKeyPair();

        const r = Request.buildJson("POST", "/organizations", "todo-host.be", {
            // eslint-disable-next-line @typescript-eslint/camelcase
            name: "My endpoint test organization",
            publicKey: organizationKeyPair.publicKey,
            user: {
                email: "admin@domain.com",
                password: "My user password",
                publicKey: userKeyPair.publicKey,
                adminSignature: await Sodium.signMessage(
                    userKeyPair.publicKey,
                    Buffer.from(organizationKeyPair.privateKey, "base64")
                ),
            },
        });

        await expect(endpoint.getResponse(r, {})).rejects.toThrow(/name/);
    });

    test("Mising admin signature", async () => {
        const userKeyPair = await Sodium.boxKeyPair();
        const organizationKeyPair = await Sodium.signKeyPair();

        const r = Request.buildJson("POST", "/organizations", "todo-host.be", {
            // eslint-disable-next-line @typescript-eslint/camelcase
            name: "My endpoint test 2 organization",
            publicKey: organizationKeyPair.publicKey,
            user: {
                email: "admin@domain.com",
                password: "My user password",
                publicKey: userKeyPair.publicKey,
            },
        });

        await expect(endpoint.getResponse(r, {})).rejects.toThrow(/sign/);
    });

    test("Invalid admin signature", async () => {
        const userKeyPair = await Sodium.boxKeyPair();
        const organizationKeyPair = await Sodium.signKeyPair();
        const invalidKeyPair = await Sodium.signKeyPair();

        const r = Request.buildJson("POST", "/organizations", "todo-host.be", {
            // eslint-disable-next-line @typescript-eslint/camelcase
            name: "My endpoint test 3 organization",
            publicKey: organizationKeyPair.publicKey,
            user: {
                email: "admin@domain.com",
                password: "My user password",
                publicKey: userKeyPair.publicKey,
                adminSignature: await Sodium.signMessage(
                    userKeyPair.publicKey,
                    Buffer.from(invalidKeyPair.privateKey, "base64")
                ),
            },
        });

        await expect(endpoint.getResponse(r, {})).rejects.toThrow(/adminSignature/);
    });
});
