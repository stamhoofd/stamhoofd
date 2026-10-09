import { MailchimpSync } from '@stamhoofd/models/models/MailchimpSync.js';
import type { MailchimpSync as MailchimpSyncStruct } from '@stamhoofd/structures/mailchimp/MailchimpSync.js';
import { MailchimpSyncStatus } from '@stamhoofd/structures/mailchimp/MailchimpSync.js';
import { MailchimpSyncRequest } from '@stamhoofd/structures/mailchimp/MailchimpSyncRequest.js';
import { TestUtils } from '@stamhoofd/test-utils';
import { initMailchimpApi } from '../../../../../tests/init/initMailchimpApi.js';
import { initMailchimpOrganization, mailchimpRequest } from '../../../../../tests/init/initMailchimpOrganization.js';
import { GetMailchimpSyncsEndpoint } from './GetMailchimpSyncsEndpoint.js';

describe('Endpoint.GetMailchimpSyncs', () => {
    const endpoint = new GetMailchimpSyncsEndpoint();

    beforeEach(() => {
        TestUtils.setEnvironment('userMode', 'organization');
        initMailchimpApi();
    });

    test('returns the latest syncs of the organization, newest first', async () => {
        const context = await initMailchimpOrganization();
        const other = await initMailchimpOrganization();

        const created: MailchimpSync[] = [];
        for (let i = 0; i < 7; i++) {
            const sync = new MailchimpSync();
            sync.organizationId = context.organization.id;
            sync.request = MailchimpSyncRequest.create({ full: true });
            sync.status = MailchimpSyncStatus.Done;
            sync.createdAt = new Date(Date.UTC(2026, 9, 1 + i));
            await sync.save();
            created.push(sync);
        }
        const otherSync = new MailchimpSync();
        otherSync.organizationId = other.organization.id;
        otherSync.request = MailchimpSyncRequest.create({ full: true });
        await otherSync.save();

        const response = await mailchimpRequest<MailchimpSyncStruct[]>(endpoint, 'GET', '/mailchimp/syncs', context.host, context.token);
        expect(response.body.map(s => s.id)).toEqual(created.slice(2).reverse().map(s => s.id));
    });
});
