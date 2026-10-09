import { Platform } from '@stamhoofd/models';
import { MailchimpCredential } from '@stamhoofd/models/models/MailchimpCredential.js';
import { PermissionLevel, Permissions } from '@stamhoofd/structures';
import type { MailchimpSettings } from '@stamhoofd/structures/mailchimp/MailchimpSettings.js';
import { STExpect, TestUtils } from '@stamhoofd/test-utils';
import type { MailchimpMocker } from '../../../../../tests/helpers/MailchimpMocker.js';
import { initAdmin } from '../../../../../tests/init/initAdmin.js';
import { initMailchimpApi } from '../../../../../tests/init/initMailchimpApi.js';
import { connectMailchimp, initMailchimpOrganization, mailchimpRequest } from '../../../../../tests/init/initMailchimpOrganization.js';
import { initPlatformAdmin } from '../../../../../tests/init/initPlatformAdmin.js';
import { ConnectMailchimpEndpoint } from './ConnectMailchimpEndpoint.js';

describe('Endpoint.ConnectMailchimp', () => {
    const endpoint = new ConnectMailchimpEndpoint();
    let mailchimp: MailchimpMocker;

    beforeEach(() => {
        TestUtils.setEnvironment('userMode', 'organization');
        mailchimp = initMailchimpApi();
        mailchimp.addList('list1', 'Nieuwsbrief Scouts Gent');
    });

    test('validates and stores the API key without returning it', async () => {
        const { organization, token, host } = await initMailchimpOrganization();

        await expect(mailchimpRequest(endpoint, 'POST', '/mailchimp/connect', host, token, { apiKey: 'not-a-key' }))
            .rejects.toThrow(STExpect.simpleError({ code: 'invalid_api_key' }));
        await expect(mailchimpRequest(endpoint, 'POST', '/mailchimp/connect', host, token, { apiKey: 'f'.repeat(32) + '-us21' }))
            .rejects.toThrow(STExpect.simpleError({ code: 'mailchimp_unauthorized' }));

        const response = await mailchimpRequest<MailchimpSettings>(endpoint, 'POST', '/mailchimp/connect', host, token, { apiKey: mailchimp.apiKey });
        expect(response.body).toMatchObject({ accountName: 'Scouts Gent', dataCenter: 'us21', audienceId: null });
        expect(JSON.stringify(response.body)).not.toContain(mailchimp.apiKey);
        expect((await MailchimpCredential.getFor(organization.id))?.apiKey).toBe(mailchimp.apiKey);
    });

    test('connecting again keeps the settings and a single credential', async () => {
        const context = await initMailchimpOrganization();
        await connectMailchimp(mailchimp, context);

        const response = await mailchimpRequest<MailchimpSettings>(endpoint, 'POST', '/mailchimp/connect', context.host, context.token, { apiKey: mailchimp.apiKey });
        expect(response.body.audienceId).toBe('list1');
        expect(await MailchimpCredential.select().where('organizationId', context.organization.id).count()).toBe(1);

        // The audience is cleared when it does not exist in the (new) account
        mailchimp.lists = [];
        const reconnected = await mailchimpRequest<MailchimpSettings>(endpoint, 'POST', '/mailchimp/connect', context.host, context.token, { apiKey: mailchimp.apiKey });
        expect(reconnected.body).toMatchObject({ audienceId: null, audienceName: null });
    });

    test('requires full access and the feature flag', async () => {
        const { organization, host } = await initMailchimpOrganization();
        const { adminToken: writeToken } = await initAdmin({ organization, permissions: Permissions.create({ level: PermissionLevel.Write }) });

        await expect(mailchimpRequest(endpoint, 'POST', '/mailchimp/connect', host, writeToken, { apiKey: mailchimp.apiKey }))
            .rejects.toThrow(STExpect.simpleError({ code: 'permission_denied' }));

        const other = await initMailchimpOrganization({ featureFlag: false });
        await expect(mailchimpRequest(endpoint, 'POST', '/mailchimp/connect', other.host, other.token, { apiKey: mailchimp.apiKey }))
            .rejects.toThrow(STExpect.simpleError({ code: 'not_available' }));
    });

    test('the platform has its own connection', async () => {
        TestUtils.setEnvironment('userMode', 'platform');
        const platform = await Platform.getForEditing();
        platform.config.featureFlags = [...platform.config.featureFlags, 'mailchimp'];
        await platform.save();

        try {
            const { adminToken } = await initPlatformAdmin();
            const response = await mailchimpRequest<MailchimpSettings>(endpoint, 'POST', '/mailchimp/connect', STAMHOOFD.domains.api, adminToken, { apiKey: mailchimp.apiKey });
            expect(response.body.accountName).toBe('Scouts Gent');
            expect((await MailchimpCredential.getFor(null))?.apiKey).toBe(mailchimp.apiKey);
            expect((await Platform.getSharedPrivateStruct()).privateConfig.mailchimp?.accountName).toBe('Scouts Gent');

            // An organization administrator cannot change the platform connection
            const { token } = await initMailchimpOrganization();
            await expect(mailchimpRequest(endpoint, 'POST', '/mailchimp/connect', STAMHOOFD.domains.api, token, { apiKey: mailchimp.apiKey }))
                .rejects.toThrow(STExpect.simpleError({ code: 'permission_denied' }));
        }
        finally {
            const editing = await Platform.getForEditing();
            editing.config.featureFlags = editing.config.featureFlags.filter(f => f !== 'mailchimp');
            editing.privateConfig.mailchimp = null;
            await editing.save();
            await (await MailchimpCredential.getFor(null))?.delete();
        }
    });
});
