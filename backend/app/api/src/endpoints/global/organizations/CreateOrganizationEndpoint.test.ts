
import { Request } from "@simonbackx/simple-endpoints";
import { Organization, OrganizationFactory, RegisterCodeFactory, STCredit } from "@stamhoofd/models";
import { Address, Country, CreateOrganization, NewUser, Organization as OrganizationStruct, Version } from "@stamhoofd/structures";

import { testServer } from "../../../../tests/helpers/TestServer";
import { CreateOrganizationEndpoint } from "./CreateOrganizationEndpoint";

function expect_toBeDefined<T>(arg: T): asserts arg is NonNullable<T> {
  expect(arg).toBeDefined();
}

describe("Endpoint.CreateOrganization", () => {
    // Test endpoint
    const endpoint = new CreateOrganizationEndpoint();

    test("Can create a new organization", async () => {
        const r = Request.buildJson("POST", `/v${Version}/organizations`, "todo-host.be", CreateOrganization.create({
            organization: OrganizationStruct.create({
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

        const response = await testServer.test(endpoint, r);
        expect(response.body.token).not.toBeEmpty();
    });

    test("Creating an organization with an in-use URI throws", async () => {
        const r = Request.buildJson("POST", `/v${Version}/organizations`, "todo-host.be", CreateOrganization.create({
            organization: OrganizationStruct.create({
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
            })
        }).encode({version: Version}));

        await expect(testServer.test(endpoint, r)).rejects.toThrow(/name/);
    });

    test("Can create an organization with a register code and apply the discount", async () => {
        const otherOrganization =  await new OrganizationFactory({}).create();
        const code = await new RegisterCodeFactory({organization: otherOrganization}).create();
        const uri = 'my-organization-with-a-discount';

        const r = Request.buildJson(
            "POST", 
            "/organizations", 
            "todo-host.be", 
            CreateOrganization.create({
                organization: OrganizationStruct.create({
                    name: "My organization with a discount",
                    uri,
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
                registerCode: code.code
            })
        );

        const response = await testServer.test(endpoint, r);
        expect(response.body.token).not.toBeEmpty();

        const organization = await Organization.getByURI(uri);
        expect_toBeDefined(organization);

        // Check if this organization has an open register code
        const credits = await STCredit.getForOrganization(organization.id);
        expect(credits.length).toBe(1);
        expect(credits[0].change).toBe(code.value);
    });

});
