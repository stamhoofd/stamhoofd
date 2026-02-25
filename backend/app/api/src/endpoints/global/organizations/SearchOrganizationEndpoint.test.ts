import { Request } from '@simonbackx/simple-endpoints';
import { OrganizationFactory } from '@stamhoofd/models';
import { v4 as uuidv4 } from 'uuid';

import { Database } from '@simonbackx/simple-database';
import { testServer } from '../../../../tests/helpers/TestServer.js';
import { SearchOrganizationEndpoint } from './SearchOrganizationEndpoint.js';

describe('Endpoint.SearchOrganization', () => {
    // Test endpoint
    const endpoint = new SearchOrganizationEndpoint();

    afterEach(async () => {
        await Database.update('UPDATE registration_periods set organizationId = null, customName = ? where organizationId is not null', ['delete']);
        await Database.delete('DELETE FROM `organizations`');
        await Database.delete('DELETE FROM `registration_periods` where customName = ?', ['delete']);
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

    test('Search organization by name using word should return best match first', async () => {
        const name = 'WAT?';

        for (let i = 0; i < 2; i++) {
            await new OrganizationFactory({
                name: 'Some other organization ' + (i + 1),
                city: 'Waterloo',
            }).create();
        }

        for (let i = 0; i < 2; i++) {
            await new OrganizationFactory({
                name: 'Some other organization 2 ' + (i + 1),
                city: 'Wats',
            }).create();
        }

        for (let i = 0; i < 2; i++) {
            await new OrganizationFactory({
                name: 'De Watten ' + (i + 1),
            }).create();
        }

        // should appear first in results
        const targetOrganization = await new OrganizationFactory({
            name,
        }).create();

        for (let i = 0; i < 2; i++) {
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
        expect(response.body).toHaveLength(9);
        expect(response.body[0].id).toEqual(targetOrganization.id);
    });

    test('Search on organization by name using sentence should return best match first', async () => {
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
        expect(response.body).toHaveLength(6);
        expect(response.body[0].id).toEqual(targetOrganization.id);
    });

    test('Search on organization by name using word should return organization with searchindex that starts with query first if limit reached', async () => {
        const query = 'Gent';

        for (let i = 0; i < 10; i++) {
            await new OrganizationFactory({
                name: 'Some other Gent organization ' + (i + 1),
                city: 'Gent',
            }).create();
        }

        for (let i = 0; i < 5; i++) {
            await new OrganizationFactory({
                name: 'De Gentenaars ' + (i + 1),
            }).create();
        }

        // should appear first in results
        const targetOrganization = await new OrganizationFactory({
            name: 'Gent',
        }).create();

        for (let i = 0; i < 3; i++) {
            await new OrganizationFactory({
                name: 'De Gentenaars 2 ' + (i + 1),
            }).create();
        }

        for (let i = 0; i < 10; i++) {
            await new OrganizationFactory({
                name: 'Some other organization 2 ' + (i + 1),
                city: 'Gent',
            }).create();
        }

        const r = Request.buildJson('GET', '/v1/organizations/search');
        r.query = {
            query,
        };

        const response = await testServer.test(endpoint, r);
        expect(response.body).toBeDefined();
        expect(response.body).toHaveLength(15);
        expect(response.body[0].name).toEqual(targetOrganization.name);
        expect(response.body[0].id).toEqual(targetOrganization.id);
    });

    test('Search on organization by name using sentence should return organization with name that starts with query first if limit reached', async () => {
        const query = 'De Spaghetti Vreters';

        // without the where like (if the limit is reached), 'Spaghetti Vreters Spaghetti Vreters' would come first ('De' is a stopword)
        for (const name of ['De Spaghetti Eters', 'Vreters', 'Spaghetti', 'De Spaghetti', 'Spaghetti Vreters', 'Spaghetti Vreters Spaghetti Vreters', 'De Spaghetti Vretersschool', 'Spaghetti 2', 'Spaghetti 3', 'Spaghetti 4', 'Spaghetti 5', 'Spaghetti 6', 'Spaghetti 7', 'Spaghetti 8', 'Spaghetti 9', 'Spaghetti 10']) {
            await new OrganizationFactory({
                name,
            }).create();
        }

        let i = 1;
        for (const city of ['De Spaghetti Eters', 'Vreters', 'Spaghetti', 'De Spaghetti', 'De Spaghetti Vretersschool']) {
            await new OrganizationFactory({
                name: 'name ' + i,
                city,
            }).create();
            i = i + 1;
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
        expect(response.body).toHaveLength(15);
        expect(response.body[0].name).toEqual(targetOrganization.name);
        expect(response.body[0].id).toEqual(targetOrganization.id);
    });

    test('Search on organization by name and city should return organization that matches city and name first', async () => {
        const query = 'De Spaghetti Vreters Gent';

        for (let i = 0; i < 5; i++) {
            await new OrganizationFactory({
                name: 'De Spaghetti Vreters ' + (i + 1),
                city: 'Wetteren',
            }).create();
        }

        // should appear first in results
        const targetOrganization = await new OrganizationFactory({
            name: 'De Spaghetti Vreters 16',
            city: 'Gent',
        }).create();

        const r = Request.buildJson('GET', '/v1/organizations/search');
        r.query = {
            query,
        };

        const response = await testServer.test(endpoint, r);
        expect(response.body).toBeDefined();
        expect(response.body).toHaveLength(6);
        expect(response.body[0].name).toEqual(targetOrganization.name);
        expect(response.body[0].id).toEqual(targetOrganization.id);
    });
});
