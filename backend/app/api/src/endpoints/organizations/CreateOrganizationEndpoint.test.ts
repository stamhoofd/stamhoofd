
import { Request } from "@simonbackx/simple-endpoints";
import { Address, Country, CreateOrganization, NewUser, Organization, Version } from "@stamhoofd/structures";

import { CreateOrganizationEndpoint } from "./CreateOrganizationEndpoint";

describe("Endpoint.CreateOrganization", () => {
    // Test endpoint
    const endpoint = new CreateOrganizationEndpoint();

    test("Can create a new organization", async () => {
        const r = Request.buildJson("POST", `/v${Version}/organizations`, "todo-host.be", CreateOrganization.create({
            organization: Organization.create({
                name: "My endpoint test organization",
                uri: "my-endpoint-test-organization",
                address: Address.create({
                    street: "My street",
                    number: "1",
                    postalCode: "9000",
                    city: "Gent",
                    country: Country.Belgium
                }),
                
            }),
            user: NewUser.create({
                email: "voorbeeld@stamhoofd.be",
                password: "My user password",
            }),
        }).encode({version: Version}));

        const response = await endpoint.test(r);
        expect(response.body.token).not.toBeEmpty();
    });

    test("Creating an organization with an in-use URI throws", async () => {
        const r = Request.buildJson("POST", `/v${Version}/organizations`, "todo-host.be", CreateOrganization.create({
            organization: Organization.create({
                name: "My endpoint test organization",
                uri: "my-endpoint-test-organization",
                address: Address.create({
                    street: "My street",
                    number: "1",
                    postalCode: "9000",
                    city: "Gent",
                    country: Country.Belgium
                }),
                
            }),
            user: NewUser.create({
                email: "voorbeeld@stamhoofd.be",
                password: "My user password",
            }),
        }).encode({version: Version}));

        await expect(endpoint.test(r)).rejects.toThrow(/name/);
    });

    /*
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
