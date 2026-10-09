import { RecordCategory, RecordChoice, RecordSettings, RecordType, TranslatedString, Version } from '@stamhoofd/structures';
import { MailchimpSettings } from '@stamhoofd/structures/mailchimp/MailchimpSettings.js';
import { STExpect, TestUtils } from '@stamhoofd/test-utils';
import type { MailchimpMocker } from '../../../../../tests/helpers/MailchimpMocker.js';
import { initMailchimpApi } from '../../../../../tests/init/initMailchimpApi.js';
import { connectMailchimp, initMailchimpOrganization, mailchimpRequest } from '../../../../../tests/init/initMailchimpOrganization.js';
import { PatchMailchimpSettingsEndpoint } from './PatchMailchimpSettingsEndpoint.js';

describe('Endpoint.PatchMailchimpSettings', () => {
    const endpoint = new PatchMailchimpSettingsEndpoint();
    let mailchimp: MailchimpMocker;

    beforeEach(() => {
        TestUtils.setEnvironment('userMode', 'organization');
        mailchimp = initMailchimpApi();
        mailchimp.addList('list1', 'Nieuwsbrief Scouts Gent');
    });

    function patchSettings(context: { host: string; token: any }, patch: ReturnType<typeof MailchimpSettings.patch>) {
        return mailchimpRequest<MailchimpSettings>(endpoint, 'PATCH', '/mailchimp/settings', context.host, context.token, patch.encode({ version: Version }));
    }

    test('only accepts audiences of the connected account', async () => {
        const context = await initMailchimpOrganization();
        await expect(patchSettings(context, MailchimpSettings.patch({ audienceId: 'list1' })))
            .rejects.toThrow(STExpect.simpleError({ code: 'mailchimp_not_connected' }));

        await connectMailchimp(mailchimp, context);
        await expect(patchSettings(context, MailchimpSettings.patch({ audienceId: 'unknown' })))
            .rejects.toThrow(STExpect.simpleError({ code: 'invalid_field', field: 'audienceId' }));

        // Account details cannot be changed by a patch
        const response = await patchSettings(context, MailchimpSettings.patch({ audienceId: 'list1', accountName: 'Other' }));
        expect(response.body).toMatchObject({ audienceId: 'list1', audienceName: 'Nieuwsbrief Scouts Gent', accountName: 'Scouts Gent' });
    });

    test('only accepts non-sensitive checkbox and choice records of the organization', async () => {
        const context = await initMailchimpOrganization();
        const yes = RecordChoice.create({ name: TranslatedString.create('Per e-mail') });
        const newsletter = RecordSettings.create({ name: TranslatedString.create('Hoe wil je de nieuwsbrief ontvangen?'), type: RecordType.ChooseOne, choices: [yes, RecordChoice.create({ name: TranslatedString.create('Niet') })] });
        const sensitive = RecordSettings.create({ name: TranslatedString.create('Allergieën'), type: RecordType.Checkbox, sensitive: true });
        const text = RecordSettings.create({ name: TranslatedString.create('Opmerkingen'), type: RecordType.Text });
        context.organization.meta.recordsConfiguration.recordCategories = [RecordCategory.create({ name: TranslatedString.create('Vragen'), records: [newsletter, sensitive, text] })];
        await context.organization.save();
        await connectMailchimp(mailchimp, context);

        for (const record of [sensitive, text, RecordSettings.create({ type: RecordType.Checkbox })]) {
            await expect(patchSettings(context, MailchimpSettings.patch({ newsletterRecordId: record.id })))
                .rejects.toThrow(STExpect.simpleError({ code: 'invalid_field', field: 'newsletterRecordId' }));
            const tagPatch = MailchimpSettings.patch({});
            tagPatch.tagRecordIds.addPut(record.id);
            await expect(patchSettings(context, tagPatch))
                .rejects.toThrow(STExpect.simpleError({ code: 'invalid_field', field: 'tagRecordIds' }));
        }

        // A choice record needs at least one choice that means yes
        await expect(patchSettings(context, MailchimpSettings.patch({ newsletterRecordId: newsletter.id })))
            .rejects.toThrow(STExpect.simpleError({ code: 'invalid_field', field: 'newsletterChoiceIds' }));

        const patch = MailchimpSettings.patch({ newsletterRecordId: newsletter.id });
        patch.newsletterChoiceIds.addPut(yes.id);
        patch.tagRecordIds.addPut(newsletter.id);
        const response = await patchSettings(context, patch);
        expect(response.body).toMatchObject({ newsletterRecordId: newsletter.id, newsletterChoiceIds: [yes.id], tagRecordIds: [newsletter.id] });

        const cleared = await patchSettings(context, MailchimpSettings.patch({ newsletterRecordId: null }));
        expect(cleared.body).toMatchObject({ newsletterRecordId: null, newsletterChoiceIds: [] });
    });
});
