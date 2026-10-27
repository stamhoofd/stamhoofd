import { Request } from '@node/endpoints';
import { OrganizationFactory, WebshopFactory } from '@stamhoofd/models';
import { Version, WebshopPrivateMetaData } from '@stamhoofd/structures';
import { testServer } from '../../../../tests/helpers/TestServer.js';
import { GetWebshopFromDomainEndpoint } from './GetWebshopFromDomainEndpoint.js';

describe('Endpoint.GetWebshopFromDomain', () => {
    const endpoint = new GetWebshopFromDomainEndpoint();

    test('Webshop previews of a custom domain do not include private data', async () => {
        const organization = await new OrganizationFactory({}).create();
        const domain = 'shop-' + organization.id + '.example.com';

        for (const domainUri of ['first', 'second']) {
            const webshop = await new WebshopFactory({
                organizationId: organization.id,
                privateMeta: WebshopPrivateMetaData.create({
                    authorId: 'secret-author-id',
                    notificationEmails: ['secret@example.com'],
                    defaultEmailId: 'secret-email-id',
                }),
            }).create();
            webshop.domain = domain;
            webshop.domainUri = domainUri;
            await webshop.save();
        }

        const r = Request.buildJson('GET', `/v${Version}/webshop-from-domain?domain=${encodeURIComponent(domain)}`);
        const response = await testServer.test(endpoint, r);

        expect(response.body.webshop).toBeNull();
        expect(response.body.webshops).toHaveLength(2);

        const encoded = JSON.stringify(response.body.encode({ version: Version }));
        expect(encoded).not.toContain('secret');
    });
});
