import { EmailAddress } from '@stamhoofd/email';
import { GroupFactory, MemberFactory, RegistrationFactory } from '@stamhoofd/models';
import { MemberDetails, Parent, RecordCategory, RecordCheckboxAnswer, RecordSettings, RecordType, TranslatedString, Version } from '@stamhoofd/structures';
import { MailchimpSettings } from '@stamhoofd/structures/mailchimp/MailchimpSettings.js';
import type { MailchimpSyncPreview } from '@stamhoofd/structures/mailchimp/MailchimpSyncPreview.js';
import { MailchimpSyncRequest } from '@stamhoofd/structures/mailchimp/MailchimpSyncRequest.js';
import { TestUtils } from '@stamhoofd/test-utils';
import type { MailchimpMocker } from '../../../../../tests/helpers/MailchimpMocker.js';
import { initMailchimpApi } from '../../../../../tests/init/initMailchimpApi.js';
import { connectMailchimp, initMailchimpOrganization, mailchimpRequest } from '../../../../../tests/init/initMailchimpOrganization.js';
import { PatchMailchimpSettingsEndpoint } from './PatchMailchimpSettingsEndpoint.js';
import { PreviewMailchimpSyncEndpoint } from './PreviewMailchimpSyncEndpoint.js';

describe('Endpoint.PreviewMailchimpSync', () => {
    const endpoint = new PreviewMailchimpSyncEndpoint();
    let mailchimp: MailchimpMocker;

    beforeEach(() => {
        TestUtils.setEnvironment('userMode', 'organization');
        mailchimp = initMailchimpApi();
        mailchimp.addList('list1', 'Nieuwsbrief Scouts Gent');
    });

    test('counts unique addresses without contacting Mailchimp', async () => {
        const context = await initMailchimpOrganization();
        await connectMailchimp(mailchimp, context);
        const group = await new GroupFactory({ organization: context.organization, name: TranslatedString.create('Welpen') }).create();

        for (const [firstName, email] of [['Emma', 'emma@example.com'], ['Lucas', 'invalid@'], ['Noor', 'unsubscribed@example.com']]) {
            const member = await new MemberFactory({
                organization: context.organization,
                details: MemberDetails.create({ firstName, lastName: 'Peeters', email, parents: [Parent.create({ firstName: 'An', lastName: 'Peeters', email: 'an@example.com' })] }),
            }).create();
            await new RegistrationFactory({ member, group }).create();
        }
        const address = await EmailAddress.getOrCreate('unsubscribed@example.com', context.organization.id);
        address.unsubscribedAll = true;
        await address.save();

        const requestsBefore = mailchimp.requests.length;
        const response = await mailchimpRequest<MailchimpSyncPreview>(endpoint, 'POST', '/mailchimp/syncs/preview', context.host, context.token, MailchimpSyncRequest.create({ full: true }).encode({ version: Version }));

        expect(response.body).toMatchObject({ contacts: 2, unsubscribed: 1, blocked: 1, withoutConsent: 0, usesNewsletterRecord: false });
        expect(mailchimp.requests.length).toBe(requestsBefore);
    });

    test('counts members without consent when a newsletter question is configured', async () => {
        const context = await initMailchimpOrganization();
        const { organization } = context;
        const newsletter = RecordSettings.create({ name: TranslatedString.create('Nieuwsbrief?'), type: RecordType.Checkbox });
        organization.meta.recordsConfiguration.recordCategories = [RecordCategory.create({ name: TranslatedString.create('Vragen'), records: [newsletter] })];
        await organization.save();
        await connectMailchimp(mailchimp, context);
        await mailchimpRequest(new PatchMailchimpSettingsEndpoint(), 'PATCH', '/mailchimp/settings', context.host, context.token, MailchimpSettings.patch({ newsletterRecordId: newsletter.id }).encode({ version: Version }));

        const group = await new GroupFactory({ organization, name: TranslatedString.create('Welpen') }).create();
        for (const [email, selected] of [['yes@example.com', true], ['no@example.com', false]] as const) {
            const member = await new MemberFactory({
                organization,
                details: MemberDetails.create({
                    firstName: 'Emma',
                    lastName: 'Peeters',
                    email,
                    recordAnswers: new Map([[newsletter.id, RecordCheckboxAnswer.create({ settings: newsletter, selected })]]),
                }),
            }).create();
            await new RegistrationFactory({ member, group }).create();
        }

        const response = await mailchimpRequest<MailchimpSyncPreview>(endpoint, 'POST', '/mailchimp/syncs/preview', context.host, context.token, MailchimpSyncRequest.create({ full: true }).encode({ version: Version }));
        expect(response.body).toMatchObject({ contacts: 1, withoutConsent: 1, usesNewsletterRecord: true });
    });
});
