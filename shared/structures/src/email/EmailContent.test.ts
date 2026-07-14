import type { AutoEncoderPatchType, Decoder, PatchableArrayAutoEncoder } from '@simonbackx/simple-encoding';
import { ObjectData, PatchableArray, PatchableArrayDecoder, PatchMap, StringDecoder } from '@simonbackx/simple-encoding';
import { Language } from '@stamhoofd/types/Language';
import { Version } from '../Version.js';
import { Email, EmailRecipient } from './Email.js';
import { EmailContent, getEmailContentForLanguage } from './EmailContent.js';
import { EmailTemplate } from './EmailTemplate.js';

describe('EmailContent', () => {
    describe('getEmailContentForLanguage', () => {
        const defaultContent = EmailContent.create({ subject: 'Default', html: '<p>Default</p>', text: 'Default' });
        const french = EmailContent.create({ subject: 'Français', html: '<p>Français</p>', text: 'Français' });
        const translations = new Map([[Language.French, french]]);

        it('returns the translation if it exists', () => {
            expect(getEmailContentForLanguage(defaultContent, translations, Language.French)).toBe(french);
        });

        it('returns the default content for a missing language', () => {
            expect(getEmailContentForLanguage(defaultContent, translations, Language.English)).toBe(defaultContent);
        });

        it('returns the default content when no language is set', () => {
            expect(getEmailContentForLanguage(defaultContent, translations, null)).toBe(defaultContent);
        });
    });

    describe('EmailTemplate.translations encoding', () => {
        it('encodes and decodes translations at the latest version', () => {
            const template = EmailTemplate.create({
                subject: 'Default',
                html: '<p>Default</p>',
                text: 'Default',
                translations: new Map([[Language.French, EmailContent.create({ subject: 'Français', html: '<p>Français</p>', text: 'Français' })]]),
            });

            const encoded = JSON.parse(JSON.stringify(template.encode({ version: Version })));
            const decoded = new ObjectData(encoded, { version: Version }).decode(EmailTemplate as Decoder<EmailTemplate>);

            expect(decoded.translations.size).toBe(1);
            expect(decoded.translations.get(Language.French)!.subject).toBe('Français');
            expect(decoded.getContentForLanguage(Language.French).subject).toBe('Français');
            expect(decoded.getContentForLanguage(Language.English).subject).toBe('Default');
            expect(decoded.getContentForLanguage(null).subject).toBe('Default');
        });

        it('strips translations for old clients', () => {
            const template = EmailTemplate.create({
                subject: 'Default',
                translations: new Map([[Language.French, EmailContent.create({ subject: 'Français' })]]),
            });

            // The translations field is added at the (unreleased) NextVersion = current Version, so
            // every older version should not receive it
            const encoded = JSON.parse(JSON.stringify(template.encode({ version: Version - 1 }))) as Record<string, unknown>;
            expect(encoded.translations).toBeUndefined();

            const decoded = new ObjectData(encoded, { version: Version - 1 }).decode(EmailTemplate as Decoder<EmailTemplate>);
            expect(decoded.translations.size).toBe(0);
        });

        it('supports a translations PatchMap inside a PatchableArray', () => {
            const decoder = new PatchableArrayDecoder(EmailTemplate as Decoder<EmailTemplate>, EmailTemplate.patchType() as Decoder<AutoEncoderPatchType<EmailTemplate>>, StringDecoder);

            const patchableArray: PatchableArrayAutoEncoder<EmailTemplate> = new PatchableArray();
            patchableArray.addPatch(EmailTemplate.patch({
                id: 'template-id',
                translations: new PatchMap([[Language.French, EmailContent.create({ subject: 'Français' })]]),
            }));

            // Encode and decode the patchable array (as it would be sent to the backend)
            const encoded = JSON.parse(JSON.stringify(patchableArray.encode({ version: Version })));
            const decoded = new ObjectData(encoded, { version: Version }).decode(decoder);

            const template = EmailTemplate.create({
                id: 'template-id',
                subject: 'Default',
                translations: new Map([[Language.English, EmailContent.create({ subject: 'English' })]]),
            });

            const patched = decoded.applyTo([template]);
            expect(patched[0].translations.size).toBe(2);
            expect(patched[0].translations.get(Language.French)!.subject).toBe('Français');
            expect(patched[0].translations.get(Language.English)!.subject).toBe('English');

            // Deleting a language
            const deleteArray: PatchableArrayAutoEncoder<EmailTemplate> = new PatchableArray();
            deleteArray.addPatch(EmailTemplate.patch({
                id: 'template-id',
                translations: new PatchMap([[Language.English, null]]),
            }));
            const encodedDelete = JSON.parse(JSON.stringify(deleteArray.encode({ version: Version })));
            const decodedDelete = new ObjectData(encodedDelete, { version: Version }).decode(decoder);

            const afterDelete = decodedDelete.applyTo(patched);
            expect(afterDelete[0].translations.size).toBe(1);
            expect(afterDelete[0].translations.get(Language.English)).toBeUndefined();
        });
    });

    describe('Email per recipient language', () => {
        const email = Email.create({
            subject: 'Default {{firstName}}',
            text: 'This is the default text of this email with enough length to show a snippet',
            html: '<p>Default</p>',
            translations: new Map([[Language.French, EmailContent.create({
                subject: 'Français {{firstName}}',
                text: 'Ceci est le texte français de cet e-mail avec une longueur suffisante pour un extrait',
                html: '<p>Français</p>',
            })]]),
        });

        it('uses the translation for the subject and snippet of a recipient with a translated language', () => {
            const recipient = EmailRecipient.create({ email: 'test@example.com', language: Language.French });
            expect(email.getSubjectFor(recipient)).toBe('Français {{firstName}}');
            expect(email.getSnippetFor(recipient)).toContain('français');
        });

        it('uses the default content for a recipient without language or with a missing language', () => {
            expect(email.getSubjectFor(null)).toBe('Default {{firstName}}');
            expect(email.getSubjectFor(EmailRecipient.create({ email: 'test@example.com', language: Language.English }))).toBe('Default {{firstName}}');
            expect(email.getSnippetFor(EmailRecipient.create({ email: 'test@example.com' }))).toContain('default text');
        });
    });
});
