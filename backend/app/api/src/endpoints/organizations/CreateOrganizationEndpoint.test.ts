
import { CreateOrganizationEndpoint } from "./CreateOrganizationEndpoint";

describe("Endpoint.CreateOrganization", () => {
    // Test endpoint
    const endpoint = new CreateOrganizationEndpoint();


    /*test("Organization already exists throws", async () => {
        const userKeyPair = await Sodium.boxKeyPair();
        const organizationKeyPair = await Sodium.signKeyPair();

        const r = Request.buildJson("POST", "/v1/organizations", "todo-host.be", {
            // eslint-disable-next-line @typescript-eslint/camelcase
            name: "My endpoint test organization",
            publicKey: organizationKeyPair.publicKey,
            user: {
                email: "admin@domain.com",
                password: "My user password",
                publicKey: userKeyPair.publicKey,
                adminSignature: await Sodium.signMessage(
                    userKeyPair.publicKey,
                    organizationKeyPair.privateKey
                ),
            },
        });

        await expect(endpoint.test(r)).rejects.toThrow(/name/);
    });

    test("Mising admin signature", async () => {
        const userKeyPair = await Sodium.boxKeyPair();
        const organizationKeyPair = await Sodium.signKeyPair();

        const r = Request.buildJson("POST", "/v1/organizations", "todo-host.be", {
            // eslint-disable-next-line @typescript-eslint/camelcase
            name: "My endpoint test 2 organization",
            publicKey: organizationKeyPair.publicKey,
            user: {
                email: "admin@domain.com",
                password: "My user password",
                publicKey: userKeyPair.publicKey,
            },
        });

        await expect(endpoint.test(r)).rejects.toThrow(/sign/);
    });

    test("Invalid admin signature", async () => {
        const userKeyPair = await Sodium.boxKeyPair();
        const organizationKeyPair = await Sodium.signKeyPair();
        const invalidKeyPair = await Sodium.signKeyPair();

        const r = Request.buildJson("POST", "/v1/organizations", "todo-host.be", {
            // eslint-disable-next-line @typescript-eslint/camelcase
            name: "My endpoint test 3 organization",
            publicKey: organizationKeyPair.publicKey,
            user: {
                email: "admin@domain.com",
                password: "My user password",
                publicKey: userKeyPair.publicKey,
                adminSignature: await Sodium.signMessage(
                    userKeyPair.publicKey,
                    invalidKeyPair.privateKey,
                ),
            },
        });

        await expect(endpoint.test(r)).rejects.toThrow(/adminSignature/);
    });*/
});
