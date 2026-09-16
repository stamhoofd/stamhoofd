import { Request } from '@simonbackx/simple-endpoints';
import { OrganizationFactory, UserFactory, Webshop, WebshopFactory } from '@stamhoofd/models';
import { PermissionLevel, Permissions, PrivateWebshop, WebshopMetaData } from '@stamhoofd/structures';
import { Language } from '@stamhoofd/types/Language';
import { STExpect, TestUtils } from '@stamhoofd/test-utils';
import { SessionService } from '../../../../services/SessionService.js';

import { testServer } from '../../../../../tests/helpers/TestServer.js';
import { PatchWebshopEndpoint } from './PatchWebshopEndpoint.js';

describe('Endpoint.PatchWebshop', () => {
    const endpoint = new PatchWebshopEndpoint();

    beforeEach(async () => {
        TestUtils.setEnvironment('userMode', 'platform');
    });

    async function createAdminContext(options?: {
        isStamhoofd?: boolean;
    }) {
        const organization = await new OrganizationFactory({}).create();
        const user = await new UserFactory({
            organization,
            isStamhoofd: options?.isStamhoofd ?? false,
            permissions: Permissions.create({
                level: PermissionLevel.Full,
            }),
        }).create();
        const token = await SessionService.createSession(user);

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

    describe('meta', () => {
        test('meta.noServiceFee can be set by @stamhoofd.be user', async () => {
            const { organization, token } = await createAdminContext({
                isStamhoofd: true,
            });
            const webshop = await new WebshopFactory({ organizationId: organization.id }).create();

            const patch = PrivateWebshop.patch({
                meta: WebshopMetaData.patch({
                    noServiceFees: true,
                }),
            });
            const request = Request.buildJson('PATCH', '/webshop/' + webshop.id, organization.getApiHost(), patch);
            request.headers.authorization = 'Bearer ' + token.accessToken;

            const response = await testServer.test(endpoint, request);
            expect(response.body.meta.noServiceFees).toBe(true);

            // Persisted in the database
            const reloaded = await Webshop.getByID(webshop.id);
            expect(reloaded?.meta.noServiceFees).toBe(true);
        });

        test('meta.noServiceFee can\'t be set by non-@stamhoofd.be user', async () => {
            const { organization, token } = await createAdminContext();
            const webshop = await new WebshopFactory({ organizationId: organization.id }).create();

            const patch = PrivateWebshop.patch({
                meta: WebshopMetaData.patch({
                    noServiceFees: true,
                }),
            });
            const request = Request.buildJson('PATCH', '/webshop/' + webshop.id, organization.getApiHost(), patch);
            request.headers.authorization = 'Bearer ' + token.accessToken;

            await expect(testServer.test(endpoint, request)).rejects.toThrow(STExpect.errorWithCode('permission_denied'));

            // Persisted in the database
            const reloaded = await Webshop.getByID(webshop.id);
            expect(reloaded?.meta.noServiceFees).not.toBe(true);
        });
    });
});
