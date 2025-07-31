import { Request } from '@simonbackx/simple-endpoints';
import { SearchUitpasOrganizersEndpoint } from '../organization/SearchUitpasOrganizersEndpoint';
import { UitpasMocker } from '../../../../../tests/helpers/UitpasMocker';
import { testServer } from '../../../../../tests/helpers/TestServer';

describe('Endpoint.SearchUitpasOrganizers', () => {
    // Test endpoint
    const endpoint = new SearchUitpasOrganizersEndpoint();
    const mocker = new UitpasMocker(true);
    const orgId = 'test_id';
    const orgName = 'Test Organizer xxx';

    beforeEach(() => {
        mocker.organizers.push({
            id: orgId,
            name: orgName,
            events: [],
        });
        mocker.start();
    });

    afterEach(async () => {
        mocker.stop();
    });

    test('Search for a given UiTPAS organizer using name', async () => {
        const r = Request.buildJson('GET', '/organizations/search');
        r.query = {
            name: orgName,
        };

        const response = await testServer.test(endpoint, r);
        expect(response.body).toBeDefined();
        expect(response.body).toHaveLength(1);

        // Access token should be expired
        expect(response.status).toEqual(200);
        expect(response.body[0]).toMatchObject({
            id: orgId,
            name: orgName,
        });
    });

    test('Search for a given UiTPAS organizer using id', async () => {
        mocker.organizers.push({
            id: orgId,
            name: orgName,
            events: [],
        });
        const r = Request.buildJson('GET', '/organizations/search');
        r.query = {
            name: orgId, // mocks pasting the ID directly into the search field
        };

        const response = await testServer.test(endpoint, r);
        expect(response.body).toBeDefined();
        expect(response.body).toHaveLength(1);

        // Access token should be expired
        expect(response.status).toEqual(200);
        expect(response.body[0]).toMatchObject({
            id: orgId,
            name: orgName,
        });
    });
});
