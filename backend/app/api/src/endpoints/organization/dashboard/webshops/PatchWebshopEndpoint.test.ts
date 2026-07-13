import { Request } from '@simonbackx/simple-endpoints';
import { OrganizationFactory, Token, UserFactory, Webshop, WebshopFactory } from '@stamhoofd/models';
import { PermissionLevel, Permissions, PrivateWebshop, WebshopMetaData } from '@stamhoofd/structures';
import { Language } from '@stamhoofd/types/Language';
import { TestUtils } from '@stamhoofd/test-utils';

import { testServer } from '../../../../../tests/helpers/TestServer.js';
import { PatchWebshopEndpoint } from './PatchWebshopEndpoint.js';

describe('Endpoint.PatchWebshop', () => {
    const endpoint = new PatchWebshopEndpoint();

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

    test('defaultLanguage can be updated', async () => {
        const { organization, token } = await createAdminContext();
        const webshop = await new WebshopFactory({ organizationId: organization.id }).create();

        const patch = PrivateWebshop.patch({
            meta: WebshopMetaData.patch({
                defaultLanguage: Language.French,
            }),
        });
        const request = Request.buildJson('PATCH', '/webshop/' + webshop.id, organization.getApiHost(), patch);
        request.headers.authorization = 'Bearer ' + token.accessToken;

        const response = await testServer.test(endpoint, request);
        expect(response.body.meta.defaultLanguage).toBe(Language.French);

        // Persisted in the database
        const reloaded = await Webshop.getByID(webshop.id);
        expect(reloaded?.meta.defaultLanguage).toBe(Language.French);
    });
});
