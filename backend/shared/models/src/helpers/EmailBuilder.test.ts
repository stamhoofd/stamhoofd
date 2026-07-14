import { EmailMocker } from '@stamhoofd/email';
import { EmailContent, EmailTemplateType, Recipient } from '@stamhoofd/structures';
import { Language } from '@stamhoofd/types/Language';
import { EmailTemplateFactory } from '../factories/EmailTemplateFactory.js';
import { OrganizationFactory } from '../factories/OrganizationFactory.js';
import { RegistrationPeriodFactory } from '../factories/RegistrationPeriodFactory.js';
import { Email } from '../models/Email.js';
import type { Organization } from '../models/Organization.js';
import type { RegistrationPeriod } from '../models/RegistrationPeriod.js';
import { sendEmailTemplate } from './EmailBuilder.js';

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
});
