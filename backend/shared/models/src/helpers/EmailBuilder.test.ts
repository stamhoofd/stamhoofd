import { EmailMocker } from '@stamhoofd/email';
import { EmailContent, EmailTemplateType, Recipient, Replacement } from '@stamhoofd/structures';
import { Country } from '@stamhoofd/types/Country';
import { Language } from '@stamhoofd/types/Language';
import { TestUtils } from '@stamhoofd/test-utils';
import { EmailTemplateFactory } from '../factories/EmailTemplateFactory.js';
import { OrganizationFactory } from '../factories/OrganizationFactory.js';
import { RegistrationPeriodFactory } from '../factories/RegistrationPeriodFactory.js';
import { Email } from '../models/Email.js';
import type { Organization } from '../models/Organization.js';
import type { RegistrationPeriod } from '../models/RegistrationPeriod.js';
import { removeUnusedReplacements, sendEmailTemplate } from './EmailBuilder.js';

describe('sendEmailTemplate with translations', () => {
    let period: RegistrationPeriod;
    let organization: Organization;

    beforeAll(async () => {
        period = await new RegistrationPeriodFactory({
            startDate: new Date(2023, 0, 1),
            endDate: new Date(2023, 11, 31),
        }).create();
    });

    beforeEach(async () => {
        organization = await new OrganizationFactory({ period }).create();
    });

    const type = EmailTemplateType.ForgotPassword;

    test('each recipient receives the content in its own language, with the default as fallback', async () => {
        await new EmailTemplateFactory({
            organization,
            type,
            subject: 'Default subject',
            html: '<p>Default html</p>',
            text: 'Default text',
            translations: new Map([
                [Language.French, EmailContent.create({ subject: 'Sujet français', html: '<p>Français</p>', text: 'Français' })],
            ]),
        }).create();

        await sendEmailTemplate(organization, {
            recipients: [
                Recipient.create({ email: 'french@example.com', language: Language.French }),
                Recipient.create({ email: 'english@example.com', language: Language.English }),
                Recipient.create({ email: 'unknown@example.com' }),
            ],
            template: { type },
            type: 'transactional',
        });

        const emails = await EmailMocker.transactional.getSucceededEmails();
        expect(emails).toHaveLength(3);

        const french = emails.find(e => e.to.includes('french@example.com'))!;
        expect(french.subject).toBe('Sujet français');
        expect(french.html).toContain('Français');

        // English has no translation: falls back to the default content
        const english = emails.find(e => e.to.includes('english@example.com'))!;
        expect(english.subject).toBe('Default subject');
        expect(english.html).toContain('Default html');

        const unknown = emails.find(e => e.to.includes('unknown@example.com'))!;
        expect(unknown.subject).toBe('Default subject');
    });

    test('generates recipient replacements in the recipient language', async () => {
        // French must be a valid locale, otherwise it gets corrected to the default language
        TestUtils.setEnvironment('locales', { [Country.Belgium]: [Language.Dutch, Language.French] });

        // The unsubscribe URL is localized per recipient (it is not part of the translatable content)
        await new EmailTemplateFactory({
            organization,
            type,
            subject: 'Subject',
            html: '<p>{{greeting}} {{unsubscribeUrl}}</p>',
            text: '{{greeting}} {{unsubscribeUrl}}',
        }).create();

        await sendEmailTemplate(organization, {
            recipients: [
                Recipient.create({ email: 'french@example.com', language: Language.French }),
                Recipient.create({ email: 'dutch@example.com', language: Language.Dutch }),
                Recipient.create({ email: 'unknown@example.com' }),
            ],
            template: { type },
            type: 'transactional',
        });

        const emails = await EmailMocker.transactional.getSucceededEmails();
        const french = emails.find(e => e.to.includes('french@example.com'))!;
        const dutch = emails.find(e => e.to.includes('dutch@example.com'))!;
        const unknown = emails.find(e => e.to.includes('unknown@example.com'))!;

        // The unsubscribe page URL points to the recipient's localized page
        expect(french.html).toContain('/fr-BE/unsubscribe');
        expect(dutch.html).toContain('/nl-BE/unsubscribe');
        // No language set: falls back to the ambient (default) locale
        expect(unknown.html).toContain('/nl-BE/unsubscribe');
    });

    test('a missing language never falls back to the translation of a different template', async () => {
        // Platform level template with a French translation
        await new EmailTemplateFactory({
            type,
            subject: 'Platform subject',
            html: '<p>Platform html</p>',
            text: 'Platform text',
            translations: new Map([
                [Language.French, EmailContent.create({ subject: 'Sujet plateforme', html: '<p>Plateforme</p>', text: 'Plateforme' })],
            ]),
        }).create();

        // Organization level template without any translations
        await new EmailTemplateFactory({
            organization,
            type,
            subject: 'Organization subject',
            html: '<p>Organization html</p>',
            text: 'Organization text',
        }).create();

        await sendEmailTemplate(organization, {
            recipients: [
                Recipient.create({ email: 'french@example.com', language: Language.French }),
            ],
            template: { type },
            type: 'transactional',
        });

        const emails = await EmailMocker.transactional.getSucceededEmails();
        expect(emails).toHaveLength(1);

        // The organization template wins, and its default content is used for French:
        // never the French translation of the platform template
        expect(emails[0].subject).toBe('Organization subject');
        expect(emails[0].html).toContain('Organization html');
    });

    test('setFromTemplate copies the translations of the template onto the email', async () => {
        await new EmailTemplateFactory({
            organization,
            type: EmailTemplateType.SavedMembersEmail,
            subject: 'Default subject',
            html: '<p>Default html</p>',
            text: 'Default text',
            translations: new Map([
                [Language.French, EmailContent.create({ subject: 'Sujet français', html: '<p>Français</p>', text: 'Français' })],
            ]),
        }).create();

        const email = new Email();
        email.organizationId = organization.id;
        expect(await email.setFromTemplate(EmailTemplateType.SavedMembersEmail)).toBe(true);

        expect(email.subject).toBe('Default subject');
        expect(email.translations.size).toBe(1);
        expect(email.translations.get(Language.French)!.subject).toBe('Sujet français');
    });

    test('replaceAll is applied to the html of every language, not only the default', async () => {
        await new EmailTemplateFactory({
            organization,
            type,
            subject: 'Subject',
            // The same placeholder appears in both the default and the translated html
            html: '<p>Default __PLACEHOLDER__</p>',
            text: 'Default __PLACEHOLDER__',
            translations: new Map([
                [Language.French, EmailContent.create({ subject: 'Sujet', html: '<p>Français __PLACEHOLDER__</p>', text: 'Français __PLACEHOLDER__' })],
            ]),
        }).create();

        await sendEmailTemplate(organization, {
            recipients: [
                Recipient.create({ email: 'french@example.com', language: Language.French }),
                Recipient.create({ email: 'default@example.com' }),
            ],
            template: { type },
            type: 'transactional',
            replaceAll: [{ from: '__PLACEHOLDER__', to: 'REPLACED' }],
        });

        const emails = await EmailMocker.transactional.getSucceededEmails();
        const french = emails.find(e => e.to.includes('french@example.com'))!;
        const fallback = emails.find(e => e.to.includes('default@example.com'))!;

        // The replaceAll must reach the translated html too, otherwise the placeholder leaks
        expect(french.html).toContain('Français REPLACED');
        expect(french.html).not.toContain('__PLACEHOLDER__');
        expect(fallback.html).toContain('Default REPLACED');
        expect(fallback.html).not.toContain('__PLACEHOLDER__');
    });
});

describe('Email.getCombinedHtml', () => {
    test('combines the default html with the html of every translation', () => {
        const email = new Email();
        email.html = '<p>Default {{signInUrl}}</p>';
        email.translations = new Map([
            [Language.French, EmailContent.create({ html: '<p>Français {{balanceTable}}</p>' })],
        ]);

        const combined = email.getCombinedHtml();
        expect(combined).toContain('{{signInUrl}}');
        expect(combined).toContain('{{balanceTable}}');
    });

    test('keeps a replacement that is only used inside a translation', () => {
        const email = new Email();
        // The default html uses signInUrl, only the French translation uses balanceTable
        email.html = '<p>Default {{signInUrl}}</p>';
        email.translations = new Map([
            [Language.French, EmailContent.create({ html: '<p>Français {{balanceTable}}</p>' })],
        ]);

        const replacements = [
            Replacement.create({ token: 'signInUrl', value: 'https://example.com' }),
            Replacement.create({ token: 'balanceTable', value: '', html: '<table></table>' }),
            Replacement.create({ token: 'outstandingBalance', value: '€ 10' }),
        ];

        // Using only the default html would wrongly strip balanceTable (used only by the translation)
        const usingDefaultHtml = removeUnusedReplacements(email.html ?? '', replacements).map(r => r.token);
        expect(usingDefaultHtml).not.toContain('balanceTable');

        // Using the combined html keeps every replacement that any language needs, and still drops the truly unused one
        const usingCombinedHtml = removeUnusedReplacements(email.getCombinedHtml(), replacements).map(r => r.token);
        expect(usingCombinedHtml).toContain('signInUrl');
        expect(usingCombinedHtml).toContain('balanceTable');
        expect(usingCombinedHtml).not.toContain('outstandingBalance');
    });
});
