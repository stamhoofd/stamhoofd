import { Request } from '@simonbackx/simple-endpoints';
import { Organization, OrganizationFactory } from '@stamhoofd/models';
import { v4 as uuidv4 } from 'uuid';

import { testServer } from '../../../../tests/helpers/TestServer';
import { SearchOrganizationEndpoint } from './SearchOrganizationEndpoint';

describe('Endpoint.SearchOrganization', () => {
    // Test endpoint
    const endpoint = new SearchOrganizationEndpoint();

    afterEach(async () => {
        await Organization.delete();
    });

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

    test('Search for a given organization on organization name by word should return best match first', async () => {
        const name = 'WAT?';

        for (let i = 0; i < 10; i++) {
            await new OrganizationFactory({
                name: 'Some other organization ' + (i + 1),
                city: 'Waterloo',
            }).create();
        }

        for (let i = 0; i < 10; i++) {
            await new OrganizationFactory({
                name: 'Some other organization 2 ' + (i + 1),
                city: 'Wats',
            }).create();
        }

        for (let i = 0; i < 5; i++) {
            await new OrganizationFactory({
                name: 'De Watten ' + (i + 1),
            }).create();
        }

        // should appear first in results
        const targetOrganization = await new OrganizationFactory({
            name,
        }).create();

        for (let i = 0; i < 3; i++) {
            await new OrganizationFactory({
                name: 'De Watten 2 ' + (i + 1),
            }).create();
        }

        const r = Request.buildJson('GET', '/v1/organizations/search');
        r.query = {
            query: name,
        };

        const response = await testServer.test(endpoint, r);
        expect(response.body).toBeDefined();
        expect(response.body).toHaveLength(15);
        expect(response.body[0].id).toEqual(targetOrganization.id);
    });

    test('Search for a given organization on organization name by sentence should return best match first', async () => {
        const query = 'Spaghetti Vreters';

        for (const name of ['De Spaghetti Eters', 'Vreters', 'Spaghetti', 'De Spaghetti', 'De Spaghetti Vretersschool']) {
            await new OrganizationFactory({
                name,
            }).create();
        }

        // should appear first in results
        const targetOrganization = await new OrganizationFactory({
            name: 'De Spaghetti Vreters',
        }).create();

        const r = Request.buildJson('GET', '/v1/organizations/search');
        r.query = {
            query,
        };

        const response = await testServer.test(endpoint, r);
        expect(response.body).toBeDefined();
        expect(response.body).toHaveLength(5);
        expect(response.body[0].id).toEqual(targetOrganization.id);
    });
});
