import { S3Client } from '@aws-sdk/client-s3';
import { EmailMocker } from '@stamhoofd/email';
import { EmailContent, EmailTemplateType, File, Recipient, Replacement } from '@stamhoofd/structures';
import { Country } from '@stamhoofd/types/Country';
import { Language } from '@stamhoofd/types/Language';
import { TestUtils } from '@stamhoofd/test-utils';
import type { Organization, RegistrationPeriod } from '@stamhoofd/models';
import { Email, EmailTemplateFactory, OrganizationFactory, RegistrationPeriodFactory } from '@stamhoofd/models';
import { FileSignService } from '../services/FileSignService.js';
import type { EmailBuilderOptions } from './EmailBuilder.js';
import { getEmailBuilder, removeUnusedReplacements, sendEmailTemplate } from './EmailBuilder.js';

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
            language: Language.Dutch,
            translations: new Map([
                [Language.French, EmailContent.create({ subject: 'Sujet français', html: '<p>Français</p>', text: 'Français' })],
            ]),
        }).create();

        await sendEmailTemplate(organization, {
            recipients: [
                Recipient.create({ email: 'french@example.com', language: Language.French }),
                Recipient.create({ email: 'dutch@example.com', language: Language.Dutch }),
                Recipient.create({ email: 'english@example.com', language: Language.English }),
                Recipient.create({ email: 'unknown@example.com' }),
            ],
            template: { type },
            type: 'transactional',
        });

        const emails = await EmailMocker.transactional.getSucceededEmails();
        expect(emails).toHaveLength(4);

        const french = emails.find(e => e.to.includes('french@example.com'))!;
        expect(french.subject).toBe('Sujet français');
        expect(french.html).toContain('Français');

        // Dutch is the default language: its content lives in the default content, not in the translations
        const dutch = emails.find(e => e.to.includes('dutch@example.com'))!;
        expect(dutch.subject).toBe('Default subject');
        expect(dutch.html).toContain('Default html');

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
            language: Language.Dutch,
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

    test('setFromTemplate copies only the default language of the template onto the email if no language chosen for email', async () => {
        await new EmailTemplateFactory({
            organization,
            type: EmailTemplateType.SavedMembersEmail,
            subject: 'Default subject',
            html: '<p>Default html</p>',
            text: 'Default text',
            language: Language.Dutch,
            translations: new Map([
                [Language.French, EmailContent.create({ subject: 'Sujet français', html: '<p>Français</p>', text: 'Français' })],
            ]),
        }).create();

        const email = new Email();
        email.organizationId = organization.id;
        expect(await email.setFromTemplate(EmailTemplateType.SavedMembersEmail)).toBe(true);

        expect(email.subject).toBe('Default subject');
        expect(email.language).toBe(null);
        expect(email.translations.size).toBe(0);
    });

    test('setFromTemplate copies only the correct language of the template onto the email', async () => {
        await new EmailTemplateFactory({
            organization,
            type: EmailTemplateType.SavedMembersEmail,
            subject: 'Default subject',
            html: '<p>Default html</p>',
            text: 'Default text',
            language: Language.Dutch,
            translations: new Map([
                [Language.French, EmailContent.create({ subject: 'Sujet français', html: '<p>Français</p>', text: 'Français' })],
            ]),
        }).create();

        const email = new Email();
        email.language = Language.French;
        email.organizationId = organization.id;
        expect(await email.setFromTemplate(EmailTemplateType.SavedMembersEmail)).toBe(true);

        expect(email.subject).toBe('Sujet français');
        expect(email.language).toBe(Language.French);
        expect(email.translations.size).toBe(0);
    });

    test('setFromTemplate copies only the default language of the template onto the email if languages match', async () => {
        await new EmailTemplateFactory({
            organization,
            type: EmailTemplateType.SavedMembersEmail,
            subject: 'Default subject',
            html: '<p>Default html</p>',
            text: 'Default text',
            language: Language.Dutch,
            translations: new Map([
                [Language.French, EmailContent.create({ subject: 'Sujet français', html: '<p>Français</p>', text: 'Français' })],
            ]),
        }).create();

        const email = new Email();
        email.language = Language.Dutch;
        email.organizationId = organization.id;
        expect(await email.setFromTemplate(EmailTemplateType.SavedMembersEmail)).toBe(true);

        expect(email.subject).toBe('Default subject');
        expect(email.language).toBe(Language.Dutch);
        expect(email.translations.size).toBe(0);
    });

    test('replaceAll is applied to the html of every language, not only the default', async () => {
        await new EmailTemplateFactory({
            organization,
            type,
            subject: 'Subject',
            // The same placeholder appears in both the default and the translated html
            html: '<p>Default __PLACEHOLDER__</p>',
            text: 'Default __PLACEHOLDER__',
            language: Language.Dutch,
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

describe('getEmailBuilder replacement file attachments', () => {
    const from = { email: 'sender@example.com' };

    const buildFile = (data: { id?: string; name?: string; size?: number; isPrivate?: boolean }) => {
        return new File({
            id: data.id ?? 'file-1',
            server: 'https://files.example.com',
            path: 'users/1/abc/attest.pdf',
            name: data.name ?? 'Attest 2024.pdf',
            size: data.size ?? 100,
            isPrivate: data.isPrivate ?? false,
            contentType: 'application/pdf',
        });
    };

    const buildEmail = async (options: { html: string; replacements: Replacement[]; attachments?: EmailBuilderOptions['attachments'] }) => {
        const builder = await getEmailBuilder(null, {
            recipients: [
                Recipient.create({ email: 'customer@example.com', replacements: options.replacements }),
            ],
            from,
            subject: 'Subject',
            html: options.html,
            attachments: options.attachments,
        });
        const email = builder();
        expect(email).toBeDefined();
        return email!;
    };

    test('files of a replacement used in the html body are attached', async () => {
        const email = await buildEmail({
            html: '<p>{{orderDetailsTable}}</p>',
            replacements: [
                Replacement.create({ token: 'orderDetailsTable', html: '<table></table>', files: [buildFile({})] }),
            ],
        });

        expect(email.attachments).toEqual([
            {
                filename: 'attest-2024.pdf',
                href: 'https://files.example.com/users/1/abc/attest.pdf',
                contentType: 'application/pdf',
            },
        ]);
        expect(email.attachments![0].cid).toBeUndefined();
    });

    test('a file referenced with its inline src in the html is attached inline with a content id', async () => {
        const file = buildFile({ id: 'inline-image', name: 'logo.png' });
        const email = await buildEmail({
            html: '<p>{{header}}</p>',
            replacements: [
                Replacement.create({ token: 'header', html: '<img src="' + file.inlineEmailSrc + '">', files: [file] }),
            ],
        });

        expect(email.attachments).toHaveLength(1);
        expect(email.attachments![0].cid).toBe('inline-image');
        expect(email.html).toContain('src="cid:inline-image"');
    });

    test('files of a replacement that is not used in the html body are not attached', async () => {
        const email = await buildEmail({
            html: '<p>No replacements</p>',
            replacements: [
                Replacement.create({ token: 'orderDetailsTable', html: '<table></table>', files: [buildFile({})] }),
            ],
        });

        expect(email.attachments ?? []).toEqual([]);
    });

    test('files of a replacement inserted through another replacement are attached', async () => {
        const email = await buildEmail({
            html: '<p>{{outer}}</p>',
            replacements: [
                Replacement.create({ token: 'inner', html: '<table></table>', files: [buildFile({})] }),
                Replacement.create({ token: 'outer', html: '<div>{{inner}}</div>' }),
            ],
        });

        expect(email.attachments).toHaveLength(1);
    });

    test('existing attachments are kept and files that would exceed the total size limit are skipped', async () => {
        const email = await buildEmail({
            html: '<p>{{orderDetailsTable}}</p>',
            replacements: [
                Replacement.create({
                    token: 'orderDetailsTable',
                    html: '<table></table>',
                    files: [
                        buildFile({ id: 'too-big', name: 'big.pdf', size: 6 * 1024 * 1024 }),
                        buildFile({ id: 'small', name: 'small.pdf', size: 100 }),
                    ],
                }),
            ],
            attachments: [
                { filename: 'existing.pdf', content: Buffer.alloc(5 * 1024 * 1024), contentType: 'application/pdf' },
            ],
        });

        // 5MB + 6MB > 9.5MB, so the big file is skipped; the small file still fits
        expect(email.attachments!.map(a => a.filename)).toEqual(['existing.pdf', 'small.pdf']);
    });

    test('a private file is attached with a signed url', async () => {
        TestUtils.setEnvironment('SPACES_BUCKET', 'test-bucket');
        const originalClient = FileSignService.s3;
        FileSignService.s3 = new S3Client({
            forcePathStyle: false,
            endpoint: 'https://test.digitaloceanspaces.com',
            credentials: {
                accessKeyId: 'test-key',
                secretAccessKey: 'test-secret',
            },
            region: 'eu-west-1',
        });

        try {
            const file = buildFile({ isPrivate: true });
            await file.sign();

            const email = await buildEmail({
                html: '<p>{{orderDetailsTable}}</p>',
                replacements: [
                    Replacement.create({ token: 'orderDetailsTable', html: '<table></table>', files: [file] }),
                ],
            });

            expect(email.attachments).toHaveLength(1);
            const query = new URL(email.attachments![0].href!).searchParams;
            expect(query.get('X-Amz-Signature')).toBeTruthy();
        } finally {
            FileSignService.s3 = originalClient;
        }
    });

    test('a private file without a valid signature is not attached', async () => {
        const email = await buildEmail({
            html: '<p>{{orderDetailsTable}}</p>',
            replacements: [
                Replacement.create({ token: 'orderDetailsTable', html: '<table></table>', files: [buildFile({ isPrivate: true })] }),
            ],
        });

        expect(email.attachments ?? []).toEqual([]);
    });
});
