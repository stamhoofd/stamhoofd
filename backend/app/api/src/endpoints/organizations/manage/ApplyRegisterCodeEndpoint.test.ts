
import { Request } from "@simonbackx/simple-endpoints";
import { OrganizationFactory, RegisterCodeFactory, STCredit, Token, UserFactory } from "@stamhoofd/models";
import { PermissionLevel, Permissions } from "@stamhoofd/structures";

import { ApplyRegisterCodeEndpoint } from "./ApplyRegisterCodeEndpoint";

describe("Endpoint.ApplyRegisterCodeEndpoint", () => {
    // Test endpoint
    const endpoint = new ApplyRegisterCodeEndpoint();

    test("Cannot apply a register code if not platform admin", async () => {
        const otherOrganization =  await new OrganizationFactory({}).create();
        const code = await new RegisterCodeFactory({organization: otherOrganization}).create();

        const organization =  await new OrganizationFactory({}).create();
        const user = await new UserFactory({ organization, permissions: Permissions.create({ level: PermissionLevel.Full }) }).create()
        const token = await Token.createToken(user)

        const r = Request.buildJson(
            "POST", 
            "/organization/register-code", 
            organization.getApiHost(), 
            {
                registerCode: code.code,
            }
        );
        r.headers.authorization = "Bearer "+token.accessToken

        await expect(endpoint.test(r)).rejects.toThrow("You do not have permissions for this endpoint");
    });

    test("Can apply a register code and apply the discount", async () => {
        const otherOrganization =  await new OrganizationFactory({}).create();
        const code = await new RegisterCodeFactory({organization: otherOrganization}).create();

        const organization =  await new OrganizationFactory({}).create();
        const user = await new UserFactory({ 
            organization,
            permissions: Permissions.create({ level: PermissionLevel.Full }),
            email: 'admin@stamhoofd.be'
        }).create()
        const token = await Token.createToken(user)

        const r = Request.buildJson(
            "POST", 
            "/organization/register-code", 
            organization.getApiHost(), 
            {
                registerCode: code.code,
            }
        );
        r.headers.authorization = "Bearer "+token.accessToken

        const response = await endpoint.test(r);
        expect(response.body).toBeUndefined();

        // Check if this organization has an open register code
        const credits = await STCredit.getForOrganization(organization.id);
        expect(credits.length).toBe(1);
        expect(credits[0].change).toBe(code.value);
    });
});
