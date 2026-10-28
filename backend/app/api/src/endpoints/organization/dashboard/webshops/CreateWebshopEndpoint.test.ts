import { Request } from '@simonbackx/simple-endpoints';
import { OrganizationFactory, UserFactory, Webshop, WebshopFactory } from '@stamhoofd/models';
import { PermissionLevel } from '@stamhoofd/types/PermissionLevel';
import { Permissions, PrivateWebshop, WebshopMetaData } from '@stamhoofd/structures';
import { STExpect, TestUtils } from '@stamhoofd/test-utils';
import { SessionService } from '../../../../services/SessionService.js';

import { testServer } from '../../../../../tests/helpers/TestServer.js';
import { CreateWebshopEndpoint } from './CreateWebshopEndpoint.js';

describe('Endpoint.CreateWebshop', () => {
    const endpoint = new CreateWebshopEndpoint();

    beforeEach(async () => {
        TestUtils.setEnvironment('userMode', 'platform');
        TestUtils.setEnvironment('domains', {
            ...STAMHOOFD.domains,
            webshopCname: 'shop.stamhoofd.test',
        });
    });

    async function createAdminContext() {
        const organization = await new OrganizationFactory({}).create();
        const user = await new UserFactory({
            organization,
            permissions: Permissions.create({
                level: PermissionLevel.Full,
            }),
        }).create();
        const token = await SessionService.createSession(user);

        return { organization, token };
    }

    async function createWebshopWithActiveDomain(organizationId: string) {
        const domain = 'shop-' + Math.floor(Math.random() * 1_000_000_000) + '.example.test';
        const webshop = await new WebshopFactory({ organizationId }).create();
        webshop.domain = domain;
        webshop.domainUri = '';
        webshop.meta.domainActive = true;
        await webshop.save();
        return { domain, webshop };
    }

    function buildCreateRequest(organization: { getApiHost(): string }, token: { accessToken: string }, domain: string, domainUri: string | null) {
        const body = PrivateWebshop.create({
            meta: WebshopMetaData.create({
                name: 'Promo',
            }),
            domain,
            domainUri,
        });
        const request = Request.buildJson('POST', '/webshop', organization.getApiHost(), body);
        request.headers.authorization = 'Bearer ' + token.accessToken;
        return request;
    }

    describe('custom domains', () => {
        test.each([
            ['with a domain uri', 'promo'],
            ['without a domain uri', null],
        ])('cannot use an active domain of another organization %s', async (_, domainUri) => {
            const owner = await createAdminContext();
            const { domain } = await createWebshopWithActiveDomain(owner.organization.id);

            const { organization, token } = await createAdminContext();
            const request = buildCreateRequest(organization, token, domain, domainUri);

            await expect(testServer.test(endpoint, request)).rejects.toThrow(
                STExpect.simpleError({ code: 'domain_already_used' }),
            );

            const webshops = await Webshop.getByDomainOnly(domain);
            expect(webshops.map(w => w.organizationId)).toEqual([owner.organization.id]);
        });

        test('cannot use an active domain of another organization with different casing', async () => {
            const owner = await createAdminContext();
            const { domain } = await createWebshopWithActiveDomain(owner.organization.id);

            const { organization, token } = await createAdminContext();
            const request = buildCreateRequest(organization, token, domain.toUpperCase(), 'promo');

            await expect(testServer.test(endpoint, request)).rejects.toThrow(
                STExpect.simpleError({ code: 'domain_already_used' }),
            );
        });

        test('can add a webshop on an active domain of the same organization', async () => {
            const { organization, token } = await createAdminContext();
            const { domain } = await createWebshopWithActiveDomain(organization.id);

            const request = buildCreateRequest(organization, token, domain, 'promo');
            const response = await testServer.test(endpoint, request);

            expect(response.body.domain).toBe(domain);
            expect(response.body.domainUri).toBe('promo');
        });
    });
});
