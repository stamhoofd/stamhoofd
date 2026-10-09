import { EmailAddress } from '@stamhoofd/email';
import { GroupFactory, MemberFactory, OrderFactory, Organization, OrganizationFactory, Platform, RegistrationFactory, RegistrationPeriod, WebshopFactory } from '@stamhoofd/models';
import { MailchimpCredential } from '@stamhoofd/models/models/MailchimpCredential.js';
import { QueueHandler } from '@stamhoofd/queues';
import { MemberDetails, OrderStatus, Parent, PermissionLevel, Permissions, RecordCategory, RecordCheckboxAnswer, RecordSettings, RecordType, TranslatedString, Version } from '@stamhoofd/structures';
import { MailchimpSettings } from '@stamhoofd/structures/mailchimp/MailchimpSettings.js';
import { MailchimpSyncIssueReason, MailchimpSyncStatus } from '@stamhoofd/structures/mailchimp/MailchimpSync.js';
import { MailchimpSyncRequest, MailchimpSyncType } from '@stamhoofd/structures/mailchimp/MailchimpSyncRequest.js';
import { STExpect, TestUtils } from '@stamhoofd/test-utils';
import type { MailchimpMocker } from '../../../../../tests/helpers/MailchimpMocker.js';
import { initAdmin } from '../../../../../tests/init/initAdmin.js';
import { initMailchimpApi } from '../../../../../tests/init/initMailchimpApi.js';
import { connectMailchimp, initMailchimpOrganization, mailchimpRequest, runMailchimpSync } from '../../../../../tests/init/initMailchimpOrganization.js';
import { initPlatformAdmin } from '../../../../../tests/init/initPlatformAdmin.js';
import { MailchimpService } from '../../../../services/mailchimp/MailchimpService.js';
import { MailchimpTags } from '../../../../services/mailchimp/MailchimpTags.js';
import { PatchMailchimpSettingsEndpoint } from './PatchMailchimpSettingsEndpoint.js';
import { StartMailchimpSyncEndpoint } from './StartMailchimpSyncEndpoint.js';

describe('Endpoint.StartMailchimpSync', () => {
    const endpoint = new StartMailchimpSyncEndpoint();
    let mailchimp: MailchimpMocker;
    let tags: MailchimpTags;

    beforeEach(async () => {
        TestUtils.setEnvironment('userMode', 'organization');
        mailchimp = initMailchimpApi();
        mailchimp.addList('list1', 'Nieuwsbrief Scouts Gent');
        tags = await MailchimpTags.forScope(null);
    });

    function start(context: { host: string; token: any }, request: MailchimpSyncRequest) {
        return mailchimpRequest(endpoint, 'POST', '/mailchimp/syncs', context.host, context.token, request.encode({ version: Version }));
    }

    describe('Members', () => {
        async function setupMembers() {
            const context = await initMailchimpOrganization();
            const { organization } = context;

            const newsletter = RecordSettings.create({ name: TranslatedString.create('Wil je de nieuwsbrief ontvangen?'), type: RecordType.Checkbox });
            const camp = RecordSettings.create({ name: TranslatedString.create('Mee op kamp'), type: RecordType.Checkbox });
            organization.meta.recordsConfiguration.recordCategories = [RecordCategory.create({ name: TranslatedString.create('Vragen'), records: [newsletter, camp] })];
            await organization.save();

            const welpen = await new GroupFactory({ organization, name: TranslatedString.create('Welpen') }).create();
            const kapoenen = await new GroupFactory({ organization, name: TranslatedString.create('Kapoenen') }).create();
            const answers = (values: [RecordSettings, boolean][]) => new Map(values.map(([settings, selected]) => [settings.id, RecordCheckboxAnswer.create({ settings, selected })]));

            const emma = await new MemberFactory({
                organization,
                details: MemberDetails.create({
                    firstName: 'Emma',
                    lastName: 'Peeters',
                    parents: [Parent.create({ firstName: 'An', lastName: 'Peeters', email: 'an@example.com' })],
                    recordAnswers: answers([[newsletter, true], [camp, true]]),
                }),
            }).create();
            await new RegistrationFactory({ member: emma, group: kapoenen }).create();

            const lucas = await new MemberFactory({
                organization,
                details: MemberDetails.create({
                    firstName: 'Lucas',
                    lastName: 'Peeters',
                    email: 'lucas@example.com',
                    parents: [Parent.create({ firstName: 'An', lastName: 'Peeters', email: 'AN@example.com' })],
                    recordAnswers: answers([[newsletter, false]]),
                }),
            }).create();
            await new RegistrationFactory({ member: lucas, group: welpen }).create();

            // Not registered in the current period
            await new MemberFactory({ organization, details: MemberDetails.create({ firstName: 'Old', lastName: 'Member', email: 'old-member@example.com' }) }).create();

            await connectMailchimp(mailchimp, context);
            return { ...context, newsletter, camp };
        }

        test('a full sync adds, tags, unsubscribes and cleans up contacts', async () => {
            const context = await setupMembers();
            mailchimp.addMember('list1', { email: 'lucas@example.com', tags: [tags.member, tags.group('Kapoenen')] });
            mailchimp.addMember('list1', { email: 'gone@example.com', tags: [tags.parent, 'Eigen tag'] });
            mailchimp.addMember('list1', { email: 'gone-customer@example.com', tags: [tags.member, tags.customer] });
            mailchimp.addMember('list1', { email: 'external@example.com', tags: ['Eigen tag'] });

            const patch = MailchimpSettings.patch({ newsletterRecordId: context.newsletter.id });
            patch.tagRecordIds.addPut(context.camp.id);
            await mailchimpRequest(new PatchMailchimpSettingsEndpoint(), 'PATCH', '/mailchimp/settings', context.host, context.token, patch.encode({ version: Version }));

            const result = await runMailchimpSync(context, MailchimpSyncRequest.create({ full: true, archiveRemoved: true }));
            expect(result.status).toBe(MailchimpSyncStatus.Done);
            expect(result.result).toMatchObject({ added: 1, updated: 1, removed: 2, archived: 1, skipped: 0, failed: 0 });

            // One contact for the shared parent address, with the union of both members
            const parent = mailchimp.getMember('list1', 'an@example.com')!;
            expect(parent.status).toBe('subscribed');
            expect(parent.mergeFields).toEqual({ FNAME: 'An', LNAME: 'Peeters', SH_LEDEN: 'Emma, Lucas', SH_GROEPEN: 'Kapoenen, Welpen' });
            expect(parent.tags).toEqual(expect.arrayContaining([tags.parent, tags.group('Kapoenen'), tags.group('Welpen'), tags.record('Mee op kamp')]));

            // Lucas did not opt in: unsubscribed, and his old group tag was removed
            const lucas = mailchimp.getMember('list1', 'lucas@example.com')!;
            expect(lucas.status).toBe('unsubscribed');
            expect(lucas.tags).toEqual([tags.member, tags.group('Welpen')]);

            expect(mailchimp.getMember('list1', 'gone@example.com')).toMatchObject({ status: 'archived', tags: ['Eigen tag', tags.removed] });
            // Customers are never archived
            expect(mailchimp.getMember('list1', 'gone-customer@example.com')).toMatchObject({ status: 'subscribed', tags: [tags.customer, tags.removed] });
            expect(mailchimp.getMember('list1', 'external@example.com')!.tags).toEqual(['Eigen tag']);
            expect(mailchimp.getMember('list1', 'old-member@example.com')).toBeUndefined();
            expect(mailchimp.lists[0].mergeFields.map(f => f.tag)).toEqual(['FNAME', 'LNAME', 'SH_LEDEN', 'SH_GROEPEN']);
        });

        test('a selection adds and updates, respects unsubscribes in Stamhoofd and reports refusals', async () => {
            const context = await setupMembers();
            mailchimp.addMember('list1', { email: 'lucas@example.com', tags: [tags.group('Kapoenen')] });
            mailchimp.forgotten.add('old-member@example.com');

            for (const email of ['lucas@example.com', 'an@example.com']) {
                const address = await EmailAddress.getOrCreate(email, context.organization.id);
                address.unsubscribedMarketing = true;
                await address.save();
            }

            await expect(start(context, MailchimpSyncRequest.create({ filter: {} })))
                .rejects.toThrow(STExpect.simpleError({ code: 'consent_required' }));

            const result = await runMailchimpSync(context, MailchimpSyncRequest.create({ filter: {}, confirmedConsent: true }));
            expect(result.result).toMatchObject({ added: 0, updated: 1, skipped: 1, failed: 1 });
            expect(result.result.issues.map(i => [i.email, i.reason])).toEqual([
                ['an@example.com', MailchimpSyncIssueReason.Unsubscribed],
                ['old-member@example.com', MailchimpSyncIssueReason.Rejected],
            ]);

            // Existing contacts that unsubscribed in Stamhoofd are unsubscribed, a selection never removes tags
            expect(mailchimp.getMember('list1', 'lucas@example.com')).toMatchObject({ status: 'unsubscribed', tags: [tags.group('Kapoenen'), tags.group('Welpen'), tags.member] });
        });

        test('a tag record that became sensitive after it was chosen is no longer sent', async () => {
            const context = await setupMembers();
            const patch = MailchimpSettings.patch({});
            patch.tagRecordIds.addPut(context.camp.id);
            await mailchimpRequest(new PatchMailchimpSettingsEndpoint(), 'PATCH', '/mailchimp/settings', context.host, context.token, patch.encode({ version: Version }));

            // Existing answers still carry a snapshot with sensitive = false
            const organization = await Organization.getByID(context.organization.id);
            organization!.meta.recordsConfiguration.recordCategories[0].records.find(r => r.id === context.camp.id)!.sensitive = true;
            await organization!.save();

            const result = await runMailchimpSync(context, MailchimpSyncRequest.create({ full: true, confirmedConsent: true }));
            expect(result.status).toBe(MailchimpSyncStatus.Done);
            expect(mailchimp.getMember('list1', 'an@example.com')!.tags).not.toContain(tags.record('Mee op kamp'));
            expect(mailchimp.getMember('list1', 'an@example.com')!.tags).toContain(tags.parent);
        });

        test('contacts archived in Mailchimp are reported as skipped instead of silently staying archived', async () => {
            const context = await setupMembers();
            mailchimp.addMember('list1', { email: 'an@example.com', status: 'archived', tags: [tags.parent] });

            const result = await runMailchimpSync(context, MailchimpSyncRequest.create({ filter: {}, confirmedConsent: true }));
            // Lucas and the old member are added, the archived parent address is left alone
            expect(result.result).toMatchObject({ added: 2, updated: 0, skipped: 1, failed: 0 });
            expect(result.result.issues.map(i => [i.email, i.reason])).toEqual([
                ['an@example.com', MailchimpSyncIssueReason.ArchivedInMailchimp],
            ]);
            expect(mailchimp.getMember('list1', 'an@example.com')).toMatchObject({ status: 'archived', tags: [tags.parent] });
            expect(mailchimp.getMember('list1', 'lucas@example.com')?.status).toBe('subscribed');
        });

        test('a removed newsletter question blocks synchronising instead of unsubscribing everyone', async () => {
            const context = await setupMembers();
            mailchimp.addMember('list1', { email: 'an@example.com' });

            const patch = MailchimpSettings.patch({ newsletterRecordId: context.newsletter.id });
            patch.tagRecordIds.addPut(context.camp.id);
            await mailchimpRequest(new PatchMailchimpSettingsEndpoint(), 'PATCH', '/mailchimp/settings', context.host, context.token, patch.encode({ version: Version }));

            context.organization.meta.recordsConfiguration.recordCategories = [];
            await context.organization.save();

            await expect(start(context, MailchimpSyncRequest.create({ full: true })))
                .rejects.toThrow(STExpect.simpleError({ code: 'newsletter_record_missing' }));
            expect(mailchimp.getMember('list1', 'an@example.com')?.status).toBe('subscribed');

            // The removed tag record does not block changing the newsletter question
            const response = await mailchimpRequest<MailchimpSettings>(new PatchMailchimpSettingsEndpoint(), 'PATCH', '/mailchimp/settings', context.host, context.token, MailchimpSettings.patch({ newsletterRecordId: null }).encode({ version: Version }));
            expect(response.body.newsletterRecordId).toBeNull();
        });

        test('requires full access', async () => {
            const context = await setupMembers();
            const { adminToken } = await initAdmin({ organization: context.organization, permissions: Permissions.create({ level: PermissionLevel.Write }) });

            await expect(start({ host: context.host, token: adminToken }, MailchimpSyncRequest.create({ full: true, confirmedConsent: true })))
                .rejects.toThrow(STExpect.simpleError({ code: 'permission_denied' }));
        });

        test('only one sync runs at a time and members require the members package', async () => {
            const context = await initMailchimpOrganization();
            await connectMailchimp(mailchimp, context);

            let release!: () => void;
            const running = QueueHandler.schedule(MailchimpService.getQueueName(context.organization), () => new Promise<void>((resolve) => {
                release = resolve;
            }));
            try {
                await expect(start(context, MailchimpSyncRequest.create({ full: true, confirmedConsent: true })))
                    .rejects.toThrow(STExpect.simpleError({ code: 'sync_running' }));
            }
            finally {
                release();
                await running;
            }

            const webshopsOnly = await initMailchimpOrganization({ members: false });
            await connectMailchimp(mailchimp, webshopsOnly);
            await expect(start(webshopsOnly, MailchimpSyncRequest.create({ full: true, confirmedConsent: true })))
                .rejects.toThrow(STExpect.simpleError({ code: 'not_available' }));
        });

        test('the platform syncs members of all organizations in the platform period', async () => {
            TestUtils.setEnvironment('userMode', 'platform');
            const platform = await Platform.getForEditing();
            const period = await RegistrationPeriod.getByID(platform.periodId);
            platform.config.featureFlags = [...platform.config.featureFlags, 'mailchimp'];
            await platform.save();

            try {
                const organization = await new OrganizationFactory({ name: 'Scouts Gent', period: period! }).create();
                const group = await new GroupFactory({ organization, period: period!, name: TranslatedString.create('Welpen') }).create();
                const member = await new MemberFactory({ organization, details: MemberDetails.create({ firstName: 'Emma', lastName: 'Peeters', email: 'emma-platform@example.com' }) }).create();
                await new RegistrationFactory({ member, group }).create();

                const { adminToken } = await initPlatformAdmin();
                const context = { organization: null, token: adminToken, host: STAMHOOFD.domains.api };
                await connectMailchimp(mailchimp, context);

                const result = await runMailchimpSync(context, MailchimpSyncRequest.create({ full: true, confirmedConsent: true }));
                expect(result.status).toBe(MailchimpSyncStatus.Done);

                const contact = mailchimp.getMember('list1', 'emma-platform@example.com')!;
                expect(contact.mergeFields).toMatchObject({ SH_LEDEN: 'Emma', SH_GROEPEN: 'Welpen', SH_VERENIG: 'Scouts Gent' });
                expect(contact.tags).toEqual(expect.arrayContaining([tags.member, tags.group('Welpen'), tags.organization('Scouts Gent')]));
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

    describe('Orders', () => {
        test('requires consent and adds customers of active orders of the webshop', async () => {
            const context = await initMailchimpOrganization();
            await connectMailchimp(mailchimp, context);

            const webshop = await new WebshopFactory({ organizationId: context.organization.id, name: 'Wafelbak' }).create();
            await new OrderFactory({ webshop, email: 'klant@example.com', firstName: 'Kim', lastName: 'Klant' }).create();
            await new OrderFactory({ webshop, email: 'canceled@example.com', status: OrderStatus.Canceled }).create();
            const otherWebshop = await new WebshopFactory({ organizationId: context.organization.id }).create();
            await new OrderFactory({ webshop: otherWebshop, email: 'other@example.com' }).create();

            const request = MailchimpSyncRequest.create({ type: MailchimpSyncType.Orders, webshopId: webshop.id, filter: {} });
            await expect(start(context, request)).rejects.toThrow(STExpect.simpleError({ code: 'consent_required' }));

            request.confirmedConsent = true;
            request.doubleOptIn = true;
            const result = await runMailchimpSync(context, request);
            expect(result.result).toMatchObject({ added: 1, updated: 0, skipped: 0 });

            const customer = mailchimp.getMember('list1', 'klant@example.com')!;
            expect(customer).toMatchObject({ status: 'pending', mergeFields: { FNAME: 'Kim', LNAME: 'Klant' } });
            expect(customer.tags).toEqual([tags.customer, tags.webshop('Wafelbak')]);
            expect(mailchimp.getMember('list1', 'canceled@example.com')).toBeUndefined();
            expect(mailchimp.getMember('list1', 'other@example.com')).toBeUndefined();
        });

        test('rejects option combinations that only make sense for the other sync type', async () => {
            const context = await initMailchimpOrganization();
            await connectMailchimp(mailchimp, context);
            const webshop = await new WebshopFactory({ organizationId: context.organization.id }).create();

            await expect(start(context, MailchimpSyncRequest.create({ filter: {}, archiveRemoved: true, confirmedConsent: true })))
                .rejects.toThrow(STExpect.simpleError({ code: 'invalid_field', field: 'archiveRemoved' }));
            await expect(start(context, MailchimpSyncRequest.create({ type: MailchimpSyncType.Orders, webshopId: webshop.id, full: true, confirmedConsent: true })))
                .rejects.toThrow(STExpect.simpleError({ code: 'invalid_field', field: 'full' }));
        });

        test('the platform cannot sync orders', async () => {
            TestUtils.setEnvironment('userMode', 'platform');
            const platform = await Platform.getForEditing();
            platform.config.featureFlags = [...platform.config.featureFlags, 'mailchimp'];
            await platform.save();

            try {
                const { adminToken } = await initPlatformAdmin();
                const context = { organization: null, token: adminToken, host: STAMHOOFD.domains.api };
                await connectMailchimp(mailchimp, context);
                await expect(start(context, MailchimpSyncRequest.create({ type: MailchimpSyncType.Orders, webshopId: 'x', confirmedConsent: true })))
                    .rejects.toThrow(STExpect.simpleError({ code: 'not_available' }));
            }
            finally {
                const editing = await Platform.getForEditing();
                editing.config.featureFlags = editing.config.featureFlags.filter(f => f !== 'mailchimp');
                editing.privateConfig.mailchimp = null;
                await editing.save();
                await (await MailchimpCredential.getFor(null))?.delete();
            }
        });

        test('cannot sync orders of a webshop of another organization', async () => {
            const context = await initMailchimpOrganization();
            await connectMailchimp(mailchimp, context);
            const other = await initMailchimpOrganization();
            const webshop = await new WebshopFactory({ organizationId: other.organization.id }).create();
            await new OrderFactory({ webshop, email: 'secret@example.com' }).create();

            const result = await runMailchimpSync(context, MailchimpSyncRequest.create({ type: MailchimpSyncType.Orders, webshopId: webshop.id, confirmedConsent: true }));
            expect(result.status).toBe(MailchimpSyncStatus.Failed);
            expect(mailchimp.getMember('list1', 'secret@example.com')).toBeUndefined();
        });
    });
});
