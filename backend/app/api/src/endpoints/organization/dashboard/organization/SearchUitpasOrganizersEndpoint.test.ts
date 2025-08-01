import { Request } from '@simonbackx/simple-endpoints';
import { SearchUitpasOrganizersEndpoint } from './SearchUitpasOrganizersEndpoint';
import { UitpasMocker } from '../../../../../tests/helpers/UitpasMocker';
import { testServer } from '../../../../../tests/helpers/TestServer';
import { OrganizationFactory, Token, UserFactory } from '@stamhoofd/models';
import { Permissions, PermissionLevel } from '@stamhoofd/structures';
import { STExpect } from '@stamhoofd/test-utils';
import { UitpasService } from '../../../../services/uitpas/UitpasService';

describe('Endpoint.SearchUitpasOrganizers', () => {
    // Test endpoint
    const useTestEnv = true;
    const clientId = 'platform-client-id';
    const clientSecret = 'platform-client-secret';
    const endpoint = new SearchUitpasOrganizersEndpoint();
    const mocker = new UitpasMocker();
    const orgId = 'test_id';
    const orgName = 'Test Organizer xxx';

    beforeAll(async () => {
        mocker.organizers.push({
            id: orgId,
            name: orgName,
            events: [],
        });
        mocker.start();
        mocker.addClientCredentials(
            clientId,
            [
                'ORGANIZERS_SEARCH',
                'PASSES_READ',
            ],
        );
    });

    afterAll(async () => {
        mocker.stop();
    });

    test('Search for a given UiTPAS organizer using name', async () => {
        expect(await UitpasService.storeIfValid(null, clientId, clientSecret, useTestEnv)).toBe(true);
        const organization = await new OrganizationFactory({}).create();
        const user = await new UserFactory({ organization, permissions: Permissions.create({ level: PermissionLevel.Full }) }).create();
        const token = await Token.createToken(user);
        const r = Request.buildJson('GET', '/organization/search-uitpas-organizers', organization.getApiHost());
        r.query = {
            name: orgName,
        };
        r.headers.authorization = 'Bearer ' + token.accessToken;

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
        expect(await UitpasService.storeIfValid(null, clientId, clientSecret, useTestEnv)).toBe(true);
        const organization = await new OrganizationFactory({}).create();
        const user = await new UserFactory({ organization, permissions: Permissions.create({ level: PermissionLevel.Full }) }).create();
        const token = await Token.createToken(user);
        const r = Request.buildJson('GET', '/organization/search-uitpas-organizers', organization.getApiHost());
        r.query = {
            name: orgId, // mocks pasting the ID directly into the search field
        };
        r.headers.authorization = 'Bearer ' + token.accessToken;

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

    test('Search for a given UiTPAS organizer by non-full access user', async () => {
        const organization = await new OrganizationFactory({}).create();
        const user = await new UserFactory({ organization, permissions: null }).create();
        const token = await Token.createToken(user);
        const r = Request.buildJson('GET', '/organization/search-uitpas-organizers', organization.getApiHost());
        r.query = {
            name: orgName,
        };
        r.headers.authorization = 'Bearer ' + token.accessToken;

        await expect(testServer.test(endpoint, r)).rejects.toThrow(
            STExpect.simpleError({ code: 'permission_denied' }),
        );
    });
});
