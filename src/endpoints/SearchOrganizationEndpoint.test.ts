import { Request } from "@simonbackx/simple-endpoints";
import { Organization } from '@stamhoofd/structures';
import { v4 as uuidv4 } from "uuid";

import { OrganizationFactory } from '../factories/OrganizationFactory';
import { SearchOrganizationEndpoint } from "./SearchOrganizationEndpoint";

describe("Endpoint.SearchOrganization", () => {
    // Test endpoint
    const endpoint = new SearchOrganizationEndpoint();

    test("Search for a given organization using exact search", async () => {
        const organization = await new OrganizationFactory({
            name: uuidv4()
        }).create()

        const r = Request.buildJson("GET", "/v1/organizations/search");
        r.query = {
            query: organization.name
        };

        const response = await endpoint.test(r);
        expect(response.body).toBeDefined();
        expect(response.body).toHaveLength(1)

        // Access token should be expired
        expect(response.body[0]).toBeInstanceOf(Organization);
        expect(response.status).toEqual(200);
        expect(response.body[0]).toMatchObject({
            id: organization.id,
            name: organization.name,
            publicKey: organization.publicKey
        })
    });

    test("Search for a given organization on city name using exact search", async () => {
        const city = uuidv4()
        const organizations = await new OrganizationFactory({
            city
        }).createMultiple(2)

        const r = Request.buildJson("GET", "/v1/organizations/search");
        r.query = {
            query: city
        };

        const response = await endpoint.test(r);
        expect(response.body).toBeDefined();
        expect(response.body).toHaveLength(2)

        // Access token should be expired
        expect(response.body[0]).toBeInstanceOf(Organization);
        expect(response.body[1]).toBeInstanceOf(Organization);
        expect(response.status).toEqual(200);
        expect(response.body.map(o => o.id).sort()).toEqual(organizations.map(o => o.id).sort())
    });
});
