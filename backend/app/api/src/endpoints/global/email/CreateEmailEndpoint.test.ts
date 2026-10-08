import { Database } from '@simonbackx/simple-database';
import { Request } from '@simonbackx/simple-endpoints';
import type { Organization, Token } from '@stamhoofd/models';
import { OrganizationFactory, UserFactory, WebshopFactory } from '@stamhoofd/models';
import { EmailRecipientFilter, EmailRecipientSubfilter, EmailStatus, Email as EmailStruct, OrganizationEmail, PermissionLevel, Permissions, Version } from '@stamhoofd/structures';
import { EmailRecipientFilterType } from '@stamhoofd/structures/email/EmailRecipientFilterType.js';
import { TestUtils } from '@stamhoofd/test-utils';
import fs from 'node:fs';

import '../../../email-recipient-loaders/discount-codes.js';
import { SessionService } from '../../../services/SessionService.js';
import { testServer } from '../../../../tests/helpers/TestServer.js';
import { CreateEmailEndpoint } from './CreateEmailEndpoint.js';

describe('Endpoint.CreateEmailEndpoint', () => {
    const endpoint = new CreateEmailEndpoint();
    let organization: Organization;
    let token: Token;
    let sender: OrganizationEmail;

    beforeAll(async () => {
        TestUtils.setEnvironment('userMode', 'platform');

        organization = await new OrganizationFactory({}).create();
        sender = OrganizationEmail.create({ email: 'wafels@voorbeeld.com', name: 'Wafelverkoop' });
        organization.privateMeta.emails.push(sender);
        await organization.save();

        const user = await new UserFactory({
            organization,
            permissions: Permissions.create({ level: PermissionLevel.Full }),
        }).create();
        token = await SessionService.createSession(user);
    });

    test('a new email to discount codes starts from the default discount code template', async () => {
        // The test database does not contain the default templates: insert the one of the migration
        await Database.statement(fs.readFileSync(import.meta.dirname + '/../../../migrations/1782333025-default-webshop-discount-codes-email-template.sql', 'utf-8'));

        const webshop = await new WebshopFactory({ organizationId: organization.id }).create();

        const request = Request.buildJson('POST', `/v${Version}/email`, organization.getApiHost(), EmailStruct.create({
            senderId: sender.id,
            status: EmailStatus.Draft,
            recipientFilter: EmailRecipientFilter.create({
                filters: [
                    EmailRecipientSubfilter.create({
                        type: EmailRecipientFilterType.WebshopDiscountCodes,
                        filter: { webshopId: webshop.id },
                    }),
                ],
            }),
        }));
        request.headers.authorization = 'Bearer ' + token.accessToken;

        const response = await testServer.test(endpoint, request);
        expect(response.body.subject).toBe('Je persoonlijke kortingscode');
        expect(response.body.html).toContain('discountCode');
    });
});
