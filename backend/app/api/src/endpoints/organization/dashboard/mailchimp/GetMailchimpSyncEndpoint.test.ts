import { MailchimpSync } from '@stamhoofd/models/models/MailchimpSync.js';
import { MailchimpSyncStatus } from '@stamhoofd/structures/mailchimp/MailchimpSync.js';
import type { MailchimpSync as MailchimpSyncStruct } from '@stamhoofd/structures/mailchimp/MailchimpSync.js';
import { MailchimpSyncRequest } from '@stamhoofd/structures/mailchimp/MailchimpSyncRequest.js';
import { STExpect, TestUtils } from '@stamhoofd/test-utils';
import { initMailchimpApi } from '../../../../../tests/init/initMailchimpApi.js';
import { initMailchimpOrganization, mailchimpRequest } from '../../../../../tests/init/initMailchimpOrganization.js';
import { GetMailchimpSyncEndpoint } from './GetMailchimpSyncEndpoint.js';

describe('Endpoint.GetMailchimpSync', () => {
    const endpoint = new GetMailchimpSyncEndpoint();

    beforeEach(() => {
        TestUtils.setEnvironment('userMode', 'organization');
        initMailchimpApi();
    });

    async function createSync(organizationId: string | null, status: MailchimpSyncStatus) {
        const sync = new MailchimpSync();
        sync.organizationId = organizationId;
        sync.request = MailchimpSyncRequest.create({ full: true });
        sync.status = status;
        await sync.save();
        return sync;
    }

    test('reports a sync that stopped without finishing as failed', async () => {
        const context = await initMailchimpOrganization();
        const sync = await createSync(context.organization.id, MailchimpSyncStatus.Running);

        const response = await mailchimpRequest<MailchimpSyncStruct>(endpoint, 'GET', `/mailchimp/syncs/${sync.id}`, context.host, context.token);
        expect(response.body.status).toBe(MailchimpSyncStatus.Failed);
        expect(response.body.errorMessage).toBeTruthy();
    });

    test('cannot read syncs of another organization or of the platform', async () => {
        const context = await initMailchimpOrganization();
        const other = await initMailchimpOrganization();
        const otherSync = await createSync(other.organization.id, MailchimpSyncStatus.Done);
        const platformSync = await createSync(null, MailchimpSyncStatus.Done);

        for (const sync of [otherSync, platformSync]) {
            await expect(mailchimpRequest(endpoint, 'GET', `/mailchimp/syncs/${sync.id}`, context.host, context.token))
                .rejects.toThrow(STExpect.simpleError({ code: 'not_found' }));
        }
    });
});
