import { Request } from '@simonbackx/simple-endpoints';
import { OrganizationFactory } from '@stamhoofd/models';
import { v4 as uuidv4 } from 'uuid';

import { testServer } from '../../../../tests/helpers/TestServer';
import { SearchOrganizationEndpoint } from './SearchOrganizationEndpoint';

describe('Endpoint.SearchOrganization', () => {
    // Test endpoint
    const endpoint = new SearchOrganizationEndpoint();

    test('Search for a given organization using exact search', async () => {
        const organization = await new OrganizationFactory({
            name: (uuidv4()).replace(/-/g, ''),
        }).create();

        const r = Request.buildJson('GET', '/v19/organizations/search');
        r.query = {
            query: organization.name,
        };

        const response = await testServer.test(endpoint, r);
        expect(response.body).toBeDefined();
        expect(response.body).toHaveLength(1);

        // Access token should be expired
        expect(response.status).toEqual(200);
        expect(response.body[0]).toMatchObject({
            id: organization.id,
            name: organization.name,
            address: organization.address,
        });
    });

    test('Search for a given organization on city name using exact search', async () => {
        const city = uuidv4();
        const organizations = await new OrganizationFactory({
            city,
        }).createMultiple(2);

        const r = Request.buildJson('GET', '/v1/organizations/search');
        r.query = {
            query: city,
        };

        const response = await testServer.test(endpoint, r);
        expect(response.body).toBeDefined();
        expect(response.body).toHaveLength(2);

        // Access token should be expired
        expect(response.status).toEqual(200);
        expect(response.body.map(o => o.id).sort()).toEqual(organizations.map(o => o.id).sort());
    });
});
