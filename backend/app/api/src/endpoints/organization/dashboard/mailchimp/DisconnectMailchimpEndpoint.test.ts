import { Organization } from '@stamhoofd/models';
import { MailchimpCredential } from '@stamhoofd/models/models/MailchimpCredential.js';
import { QueueHandler } from '@stamhoofd/queues';
import { STExpect, TestUtils } from '@stamhoofd/test-utils';
import type { MailchimpMocker } from '../../../../../tests/helpers/MailchimpMocker.js';
import { initMailchimpApi } from '../../../../../tests/init/initMailchimpApi.js';
import { connectMailchimp, initMailchimpOrganization, mailchimpRequest } from '../../../../../tests/init/initMailchimpOrganization.js';
import { MailchimpService } from '../../../../services/mailchimp/MailchimpService.js';
import { DisconnectMailchimpEndpoint } from './DisconnectMailchimpEndpoint.js';

describe('Endpoint.DisconnectMailchimp', () => {
    const endpoint = new DisconnectMailchimpEndpoint();
    let mailchimp: MailchimpMocker;

    beforeEach(() => {
        TestUtils.setEnvironment('userMode', 'organization');
        mailchimp = initMailchimpApi();
        mailchimp.addList('list1', 'Nieuwsbrief Scouts Gent');
    });

    test('removes the API key and the settings', async () => {
        const context = await initMailchimpOrganization();
        await connectMailchimp(mailchimp, context);
        expect(context.organization.privateMeta.mailchimp?.audienceId).toBe('list1');

        await mailchimpRequest(endpoint, 'DELETE', '/mailchimp/connect', context.host, context.token);

        expect(await MailchimpCredential.getFor(context.organization.id)).toBeNull();
        expect((await Organization.getByID(context.organization.id))?.privateMeta.mailchimp).toBeNull();
    });

    test('is refused while a synchronisation runs', async () => {
        const context = await initMailchimpOrganization();
        await connectMailchimp(mailchimp, context);

        let release!: () => void;
        const running = QueueHandler.schedule(MailchimpService.getQueueName(context.organization), () => new Promise<void>((resolve) => {
            release = resolve;
        }));

        try {
            await expect(mailchimpRequest(endpoint, 'DELETE', '/mailchimp/connect', context.host, context.token))
                .rejects.toThrow(STExpect.simpleError({ code: 'sync_running' }));
        }
        finally {
            release();
            await running;
        }
        expect(await MailchimpCredential.getFor(context.organization.id)).not.toBeNull();
    });
});
