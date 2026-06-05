import { Request } from '@simonbackx/simple-endpoints';
import { OrganizationFactory, Token, UserFactory, Webshop, WebshopFactory } from '@stamhoofd/models';
import { Permissions, PermissionLevel, PrivateWebshop, WebshopMetaData } from '@stamhoofd/structures';
import { STExpect, TestUtils } from '@stamhoofd/test-utils';

import { testServer } from '../../../../../tests/helpers/TestServer.js';
import { CreateWebshopEndpoint } from './CreateWebshopEndpoint.js';
import { GetWebshopUriAvailabilityEndpoint } from './GetWebshopUriAvailabilityEndpoint.js';
import { PatchWebshopEndpoint } from './PatchWebshopEndpoint.js';

describe('Endpoint.WebshopReservedPathSegments', () => {
    const checkUriEndpoint = new GetWebshopUriAvailabilityEndpoint();
    const patchEndpoint = new PatchWebshopEndpoint();
    const createEndpoint = new CreateWebshopEndpoint();

    beforeEach(async () => {
        TestUtils.setEnvironment('userMode', 'platform');
    });

    async function createAdminContext() {
        const organization = await new OrganizationFactory({}).create();
        const user = await new UserFactory({
            organization,
            permissions: Permissions.create({
                level: PermissionLevel.Full,
            }),
        }).create();
        const token = await Token.createToken(user);

        return { organization, token };
    }

    test('reserved webshop paths are not available as default URI', async () => {
        const { organization, token } = await createAdminContext();
        const webshop = await new WebshopFactory({ organizationId: organization.id }).create();

        const request = Request.get({
            path: '/webshop/' + webshop.id + '/check-uri',
            host: organization.getApiHost(),
            query: {
                uri: 'tickets',
            },
            headers: { authorization: 'Bearer ' + token.accessToken },
        });

        const response = await testServer.test(checkUriEndpoint, request);

        expect(response.body.available).toBe(false);
    });

    test('reserved webshop paths cannot be saved as default URI', async () => {
        const { organization, token } = await createAdminContext();
        const webshop = await new WebshopFactory({ organizationId: organization.id }).create();
        const patch = PrivateWebshop.patch({ uri: 'tickets' });
        const request = Request.buildJson('PATCH', '/webshop/' + webshop.id, organization.getApiHost(), patch);
        request.headers.authorization = 'Bearer ' + token.accessToken;

        await expect(testServer.test(patchEndpoint, request)).rejects.toThrow(
            STExpect.simpleError({ code: 'invalid_field', field: 'uri' }),
        );
    });

    test('reserved webshop paths cannot be saved as custom domain URI', async () => {
        const { organization, token } = await createAdminContext();
        const webshop = await new WebshopFactory({ organizationId: organization.id }).create();
        webshop.domain = 'shop.example.com';
        webshop.domainUri = 'valid';
        await webshop.save();

        const patch = PrivateWebshop.patch({ domainUri: 'tickets' });
        const request = Request.buildJson('PATCH', '/webshop/' + webshop.id, organization.getApiHost(), patch);
        request.headers.authorization = 'Bearer ' + token.accessToken;

        await expect(testServer.test(patchEndpoint, request)).rejects.toThrow(
            STExpect.simpleError({ code: 'invalid_field', field: 'customUrl' }),
        );
    });

    test('generated webshop URIs skip reserved webshop paths', async () => {
        const { organization, token } = await createAdminContext();
        const body = PrivateWebshop.create({
            meta: WebshopMetaData.create({
                name: 'Tickets',
            }),
        });
        const request = Request.buildJson('POST', '/webshop', organization.getApiHost(), body);
        request.headers.authorization = 'Bearer ' + token.accessToken;

        const response = await testServer.test(createEndpoint, request);
        const webshop = await Webshop.getByID(response.body.id);

        expect(response.body.uri).not.toBe('tickets');
        expect(webshop?.uri).not.toBe('tickets');
    });
});
