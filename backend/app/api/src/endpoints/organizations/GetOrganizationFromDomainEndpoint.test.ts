import { Request } from "@simonbackx/simple-endpoints";
import { GroupFactory } from '@stamhoofd/models';
import { OrganizationFactory } from '@stamhoofd/models';
import { UserFactory } from '@stamhoofd/models';
import { Token } from '@stamhoofd/models';
import { Organization } from '@stamhoofd/structures';

import { GetOrganizationFromDomainEndpoint } from './GetOrganizationFromDomainEndpoint';

describe("Endpoint.GetOrganizationFromDomain", () => {
    // Test endpoint
    const endpoint = new GetOrganizationFromDomainEndpoint();

    test("Get organization from default uri", async () => {
        const organization = await new OrganizationFactory({}).create()
        const groups = await new GroupFactory({ organization }).createMultiple(2)

        const r = Request.buildJson("GET", "/v2/organization-from-domain");
        r.query = {
            "domain": organization.uri+".stamhoofd.dev",
        }

        const response = await endpoint.test(r);
        expect(response.body).toBeDefined();

        if (!(response.body instanceof Organization)) {
            throw new Error("Expected Organization")
        }

        expect(response.body.id).toEqual(organization.id)
        expect(response.body.groups.map(g => g.id).sort()).toEqual(groups.map(g => g.id).sort())
    });

    test("Get organization from custom domain", async () => {
        const organization = await new OrganizationFactory({ domain: "inschrijven.mijnscouts.be"}).create()
        const groups = await new GroupFactory({ organization }).createMultiple(2)

        const r = Request.buildJson("GET", "/v2/organization-from-domain");
        r.query = {
            "domain": "inschrijven.mijnscouts.be",
        }

        const response = await endpoint.test(r);
        expect(response.body).toBeDefined();

        if (!(response.body instanceof Organization)) {
            throw new Error("Expected Organization")
        }

        expect(response.body.id).toEqual(organization.id)
        expect(response.body.groups.map(g => g.id).sort()).toEqual(groups.map(g => g.id).sort())
    });

});
