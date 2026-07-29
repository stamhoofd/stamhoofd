import { I18n } from '@stamhoofd/backend-i18n/I18n';
import type { Member, Organization, RegistrationPeriod, User } from '@stamhoofd/models';
import { Email, EmailRecipient, MemberFactory, OrganizationFactory, RegistrationPeriodFactory, UserFactory } from '@stamhoofd/models';
import { EmailContent, EmailStatus, Replacement } from '@stamhoofd/structures';
import { TestUtils } from '@stamhoofd/test-utils';
import { Country } from '@stamhoofd/types/Country';
import { Language } from '@stamhoofd/types/Language';
import { EmailPreviewService } from './EmailPreviewService.js';

describe('EmailPreviewService', () => {
    let period: RegistrationPeriod;
    let organization: Organization;
    let user: User;
    let member: Member;

    beforeAll(async () => {
        TestUtils.setPermanentEnvironment('userMode', 'platform');

        period = await new RegistrationPeriodFactory({
            startDate: new Date(2023, 0, 1),
            endDate: new Date(2023, 11, 31),
        }).create();

        organization = await new OrganizationFactory({ period }).create();

        user = await new UserFactory({ organization }).create();
        member = await new MemberFactory({ organization, user }).create();
    });

    afterEach(async () => {
        await Email.delete();
    });

    /**
     * A sent email that is visible in the member portal.
     */
    const createSentEmail = async (data: { html: string; text?: string; subject?: string } & Partial<Email>) => {
        const email = new Email();
        email.subject = data.subject ?? 'Test subject';
        email.status = EmailStatus.Sent;
        email.html = data.html;
        email.text = data.text ?? 'Test text';
        email.json = {};
        email.language = data.language ?? null;
        email.translations = data.translations ?? new Map();
        email.organizationId = organization.id;
        email.showInMemberPortal = true;
        email.sentAt = new Date();
        await email.save();
        return email;
    };

    const createRecipient = async (email: Email, data: Partial<EmailRecipient> & { memberId: string }) => {
        const recipient = new EmailRecipient();
        recipient.emailId = email.id;
        recipient.memberId = data.memberId;
        recipient.userId = data.userId ?? null;
        recipient.email = data.email ?? null;
        recipient.firstName = data.firstName ?? 'Test';
        recipient.lastName = data.lastName ?? 'Test';
        recipient.language = data.language ?? null;
        recipient.replacements = data.replacements ?? [];
        recipient.sentAt = new Date();
        await recipient.save();
        return recipient;
    };

    describe('getStructureForUser', () => {
        test('strips the sensitive replacements that were stored for another recipient', async () => {
            // The signInUrl of another user is a login link: it may never end up in the structure
            // that is returned to this user.
            const secret = 'private-signin-token-67890';
            const otherUser = await new UserFactory({ organization }).create();

            const email = await createSentEmail({
                subject: 'Privacy boundary',
                // The token has to be used in the content, otherwise removeUnusedReplacements
                // drops it and the leak would not be observable
                html: '<p>Sign in here: {{signInUrl}}</p>',
                text: 'Sign in here: {{signInUrl}}',
            });

            // A recipient of the same member, but belonging to a different user
            await createRecipient(email, {
                memberId: member.id,
                userId: otherUser.id,
                email: otherUser.email,
                replacements: [
                    Replacement.create({
                        token: 'signInUrl',
                        value: 'https://example.com/login?token=' + secret,
                    }),
                ],
            });

            const structure = await EmailPreviewService.getStructureForUser(email, user, [member.id]);

            expect(structure.recipients).toHaveLength(1);
            const recipient = structure.recipients[0];

            // The stored replacements of the other user are gone
            expect(JSON.stringify(recipient.replacements)).not.toContain(secret);

            // ...and replaced by a sign in url generated for the user that is viewing the email
            const signInUrl = recipient.replacements.find(r => r.token === 'signInUrl');
            expect(signInUrl).toBeDefined();
            expect(signInUrl!.value).toContain(encodeURIComponent(user.email));
        });

        test('renders the replacements in the language of the recipient, not in the ambient locale', async () => {
            TestUtils.setEnvironment('locales', { BE: [Language.Dutch, Language.French] });

            // The web greeting is looked up in shared/locales/dist/locales/digit/fr-BE.json,
            // hardcoded on purpose so we don't verify $t with the same $t machinery we're testing
            const frenchGreeting = 'Bonjour,';

            const email = await createSentEmail({
                subject: 'Nederlands onderwerp',
                html: '<p>{{greeting}} Nederlandse inhoud</p>',
                text: '{{greeting}} Nederlandse tekst',
                language: Language.Dutch,
                translations: new Map([
                    [Language.French, EmailContent.create({
                        subject: 'Sujet français',
                        html: '<p>{{greeting}} Contenu français</p>',
                        text: 'Texte français',
                    })],
                ]),
            });

            await createRecipient(email, {
                memberId: member.id,
                userId: user.id,
                email: user.email,
                language: Language.French,
            });

            // The caller is viewing in Dutch, the recipient received the email in French
            const structure = await I18n.runWithLocale(
                new I18n(Language.Dutch, Country.Belgium),
                async () => await EmailPreviewService.getStructureForUser(email, user, [member.id]),
            );

            expect(structure.recipients).toHaveLength(1);
            const recipient = structure.recipients[0];

            expect(recipient.language).toBe(Language.French);
            expect(recipient.replacements.find(r => r.token === 'greeting')?.value).toBe(frenchGreeting);
            expect(structure.getSubjectFor(recipient)).toBe('Sujet français');
            expect(structure.getHtmlFor(recipient)).toBe(`<p>${frenchGreeting} Contenu français</p>`);
        });

        test('merges the recipients of different members when their replacements are equal', async () => {
            const secondMember = await new MemberFactory({ organization, user }).create();

            const email = await createSentEmail({
                subject: 'Equal content',
                html: '<p>Hello {{memberFirstName}}</p>',
            });

            for (const memberId of [member.id, secondMember.id]) {
                await createRecipient(email, {
                    memberId,
                    userId: user.id,
                    email: user.email,
                    replacements: [
                        Replacement.create({ token: 'memberFirstName', value: 'Same name' }),
                    ],
                });
            }

            const structure = await EmailPreviewService.getStructureForUser(email, user, [member.id, secondMember.id]);

            expect(structure.recipients).toHaveLength(1);
            expect(structure.recipients[0].replacements.find(r => r.token === 'memberFirstName')?.value).toBe('Same name');
        });

        test('keeps the recipients of different members separate when their replacements differ', async () => {
            const secondMember = await new MemberFactory({ organization, user }).create();

            const email = await createSentEmail({
                subject: 'Different content',
                html: '<p>Hello {{memberFirstName}}</p>',
            });

            await createRecipient(email, {
                memberId: member.id,
                userId: user.id,
                email: user.email,
                replacements: [Replacement.create({ token: 'memberFirstName', value: 'Alice' })],
            });

            await createRecipient(email, {
                memberId: secondMember.id,
                userId: user.id,
                email: user.email,
                replacements: [Replacement.create({ token: 'memberFirstName', value: 'Bob' })],
            });

            const structure = await EmailPreviewService.getStructureForUser(email, user, [member.id, secondMember.id]);

            expect(structure.recipients).toHaveLength(2);
            const names = structure.recipients.map(r => r.replacements.find(rr => rr.token === 'memberFirstName')?.value);
            expect(names).toIncludeSameMembers(['Alice', 'Bob']);
        });
    });

    describe('getPreviewStructure', () => {
        test('returns an example recipient for every language of a translated email', async () => {
            TestUtils.setEnvironment('locales', { BE: [Language.Dutch, Language.French] });

            const email = await createSentEmail({
                subject: 'Nederlands onderwerp',
                html: '<p>{{greeting}} Nederlandse inhoud</p>',
                language: Language.Dutch,
                translations: new Map([
                    [Language.French, EmailContent.create({
                        subject: 'Sujet français',
                        html: '<p>{{greeting}} Contenu français</p>',
                        text: 'Texte français',
                    })],
                ]),
            });

            const preview = await EmailPreviewService.getPreviewStructure(email, { allLanguages: true });

            expect(preview.exampleRecipient).not.toBeNull();
            expect([...preview.exampleRecipients.keys()]).toIncludeSameMembers([Language.Dutch, Language.French]);
            expect(preview.exampleRecipients.get(Language.French)!.language).toBe(Language.French);
            expect(preview.exampleRecipients.get(Language.Dutch)!.language).toBe(Language.Dutch);

            // The replacements are regenerated per language, so the greeting differs
            const dutchGreeting = preview.exampleRecipients.get(Language.Dutch)!.replacements.find(r => r.token === 'greeting')?.value;
            const frenchGreeting = preview.exampleRecipients.get(Language.French)!.replacements.find(r => r.token === 'greeting')?.value;
            expect(typeof dutchGreeting).toBe('string');
            expect(typeof frenchGreeting).toBe('string');
            expect(frenchGreeting).not.toBe(dutchGreeting);
        });

        test('returns no per-language example recipients for an email with a single language', async () => {
            TestUtils.setEnvironment('locales', { BE: [Language.Dutch, Language.French] });

            const email = await createSentEmail({
                subject: 'Nederlands onderwerp',
                html: '<p>{{greeting}} Nederlandse inhoud</p>',
                language: Language.Dutch,
            });

            const preview = await EmailPreviewService.getPreviewStructure(email, { allLanguages: true });

            expect(preview.exampleRecipient).not.toBeNull();
            expect(preview.exampleRecipients.size).toBe(0);
        });

        test('the allLanguages option is not read: the example recipients only depend on the languages of the email', async () => {
            // Documents the current behaviour. Moving this code has to be a strict no-op, so the
            // option is kept as it is even though it is not used.
            TestUtils.setEnvironment('locales', { BE: [Language.Dutch, Language.French] });

            const email = await createSentEmail({
                subject: 'Nederlands onderwerp',
                html: '<p>{{greeting}} Nederlandse inhoud</p>',
                language: Language.Dutch,
                translations: new Map([
                    [Language.French, EmailContent.create({
                        subject: 'Sujet français',
                        html: '<p>{{greeting}} Contenu français</p>',
                        text: 'Texte français',
                    })],
                ]),
            });

            const withOption = await EmailPreviewService.getPreviewStructure(email, { allLanguages: true });
            const withoutOption = await EmailPreviewService.getPreviewStructure(email);

            expect([...withOption.exampleRecipients.keys()]).toIncludeSameMembers([Language.Dutch, Language.French]);
            expect([...withoutOption.exampleRecipients.keys()]).toIncludeSameMembers([Language.Dutch, Language.French]);
        });

        test('uses a stored recipient as the example recipient when the email has one', async () => {
            const email = await createSentEmail({
                subject: 'With a recipient',
                html: '<p>Hello {{memberFirstName}}</p>',
            });

            await createRecipient(email, {
                memberId: member.id,
                userId: user.id,
                email: user.email,
                firstName: 'Stored',
                lastName: 'Recipient',
                replacements: [Replacement.create({ token: 'memberFirstName', value: 'Stored' })],
            });

            const preview = await EmailPreviewService.getPreviewStructure(email, { allLanguages: true });

            expect(preview.exampleRecipient).not.toBeNull();
            expect(preview.exampleRecipient!.firstName).toBe('Stored');
            expect(preview.exampleRecipient!.replacements.find(r => r.token === 'memberFirstName')?.value).toBe('Stored');
        });
    });
});
