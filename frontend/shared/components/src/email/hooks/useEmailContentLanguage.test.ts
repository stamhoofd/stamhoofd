import { Email, EmailContent } from '@stamhoofd/structures';
import { Language } from '@stamhoofd/types/Language';
import { describe, expect, test } from 'vitest';
import type { Ref } from 'vue';
import { ref } from 'vue';
import type { EmailContentHolder, EmailContentPatch } from './useEmailContentLanguage';
import { createAddLanguagePatch, createRemoveLanguagePatch, getChangedEmailContentLanguages, getEmailContentFor, getStaleEmailContentLanguages, useEmailContentLanguage } from './useEmailContentLanguage';

function buildContent(content: { subject?: string; json?: any } = {}): EmailContent {
    return EmailContent.create({
        subject: content.subject ?? 'Translated subject',
        html: '<p>html</p>',
        text: 'text',
        json: content.json ?? { type: 'doc' },
    });
}

function buildHolder(options: { subject?: string; json?: any; language?: Language | null; translations?: [Language, { subject?: string; json?: any }][] } = {}): EmailContentHolder {
    return {
        subject: options.subject ?? 'Default subject',
        html: '<p>html</p>',
        text: 'text',
        json: options.json ?? { type: 'doc' },
        language: options.language ?? null,
        translations: new Map((options.translations ?? []).map(([language, content]) => [language, buildContent(content)])),
    };
}

describe('getEmailContentFor', () => {
    test('null and the default language both read the root content', () => {
        const holder = buildHolder({ subject: 'Root subject', language: Language.Dutch, translations: [[Language.French, { subject: 'Sujet' }]] });
        expect(getEmailContentFor(holder, null).subject).toBe('Root subject');
        expect(getEmailContentFor(holder, Language.Dutch).subject).toBe('Root subject');
    });

    test('other languages read the translations map', () => {
        const holder = buildHolder({ language: Language.Dutch, translations: [[Language.French, { subject: 'Sujet' }]] });
        expect(getEmailContentFor(holder, Language.French).subject).toBe('Sujet');
    });

    test('a missing language returns empty content', () => {
        const holder = buildHolder({ language: Language.Dutch });
        expect(getEmailContentFor(holder, Language.French).subject).toBe('');
    });
});

describe('createAddLanguagePatch', () => {
    test('the first language only marks the content, without creating a translation', () => {
        const holder = buildHolder();
        const patch = createAddLanguagePatch(holder, getEmailContentFor(holder, null), Language.French);
        expect(patch).toEqual({ language: Language.French });
    });

    test('the next languages become translations seeded with the displayed content', () => {
        const holder = buildHolder({ subject: 'Root subject', language: Language.Dutch });
        const patch = createAddLanguagePatch(holder, getEmailContentFor(holder, Language.Dutch), Language.French);
        expect(patch.language).toBeUndefined();
        expect(patch.translations!.get(Language.French)).toMatchObject({ subject: 'Root subject' });
    });
});

describe('createRemoveLanguagePatch', () => {
    test('a translation is removed from the map', () => {
        const holder = buildHolder({ language: Language.Dutch, translations: [[Language.French, {}]] });
        const patch = createRemoveLanguagePatch(holder, Language.French);
        expect(patch.language).toBeUndefined();
        expect(patch.subject).toBeUndefined();
        expect([...patch.translations!.entries()]).toEqual([[Language.French, null]]);
    });

    test('removing the default language moves the first remaining translation into the default content', () => {
        const holder = buildHolder({ subject: 'Root subject', language: Language.Dutch, translations: [[Language.French, { subject: 'Sujet' }], [Language.English, { subject: 'English' }]] });
        const patch = createRemoveLanguagePatch(holder, Language.Dutch);
        expect(patch.language).toBe(Language.French);
        expect(patch.subject).toBe('Sujet');
        expect([...patch.translations!.entries()]).toEqual([[Language.French, null]]);
    });

    test('removing the last language keeps the content and only clears the language', () => {
        const holder = buildHolder({ subject: 'Root subject', language: Language.Dutch });
        const patch = createRemoveLanguagePatch(holder, Language.Dutch);
        expect(patch).toEqual({ language: null });
        expect(patch.subject).toBeUndefined();
    });
});

describe('useEmailContentLanguage', () => {
    function createHook(initial: Email) {
        const email: Ref<Email> = ref(initial);
        const hook = useEmailContentLanguage({
            editor: () => null,
            patched: () => email.value,
            addPatch: (patch: EmailContentPatch) => {
                email.value = email.value.patch(Email.patch(patch));
            },
        });
        return { email, hook };
    }

    test('selecting the first language stores it as the default language without translations', async () => {
        const { email, hook } = createHook(Email.create({ subject: 'Root subject', json: { type: 'doc' } }));
        expect(hook.currentLanguage.value).toBeNull();
        expect(hook.languages.value).toEqual([]);

        await hook.addLanguage(Language.Dutch);

        expect(email.value.language).toBe(Language.Dutch);
        expect(email.value.translations.size).toBe(0);
        expect(email.value.subject).toBe('Root subject');
        expect(hook.currentLanguage.value).toBe(Language.Dutch);
        expect(hook.languages.value).toEqual([Language.Dutch]);
    });

    test('the second language becomes a translation seeded with the displayed content', async () => {
        const { email, hook } = createHook(Email.create({ subject: 'Root subject', json: { type: 'doc' }, language: Language.Dutch }));
        expect(hook.currentLanguage.value).toBe(Language.Dutch);

        await hook.addLanguage(Language.French);

        expect(email.value.language).toBe(Language.Dutch);
        expect(email.value.translations.get(Language.French)!.subject).toBe('Root subject');
        expect(hook.currentLanguage.value).toBe(Language.French);
        expect(hook.languages.value).toEqual([Language.Dutch, Language.French]);
    });

    test('editing the default language writes to the root fields, other languages to the map', async () => {
        const { email, hook } = createHook(Email.create({ subject: 'Root subject', json: { type: 'doc' }, language: Language.Dutch }));

        hook.subject.value = 'Nieuw onderwerp';
        expect(email.value.subject).toBe('Nieuw onderwerp');
        expect(email.value.translations.size).toBe(0);

        await hook.addLanguage(Language.French);
        hook.subject.value = 'Sujet français';
        expect(email.value.subject).toBe('Nieuw onderwerp');
        expect(email.value.translations.get(Language.French)!.subject).toBe('Sujet français');
    });

    test('an untouched seeded language is removed again when switching away', async () => {
        const { email, hook } = createHook(Email.create({ subject: 'Root subject', json: { type: 'doc' }, language: Language.Dutch }));

        await hook.addLanguage(Language.French);
        expect(email.value.translations.has(Language.French)).toBe(true);

        // Switch back without changing anything: the French copy should not linger
        await hook.switchTo(Language.Dutch);
        expect(email.value.translations.has(Language.French)).toBe(false);
        expect(hook.currentLanguage.value).toBe(Language.Dutch);
    });

    test('a changed seeded language is kept when switching away', async () => {
        const { email, hook } = createHook(Email.create({ subject: 'Root subject', json: { type: 'doc' }, language: Language.Dutch }));

        await hook.addLanguage(Language.French);
        hook.subject.value = 'Sujet français';

        await hook.switchTo(Language.Dutch);
        expect(email.value.translations.get(Language.French)!.subject).toBe('Sujet français');
    });

    test('adding another language also cleans up an untouched seeded language', async () => {
        const { email, hook } = createHook(Email.create({ subject: 'Root subject', json: { type: 'doc' }, language: Language.Dutch }));

        await hook.addLanguage(Language.French);
        await hook.addLanguage(Language.English);

        // French was never changed: only the English copy remains, seeded with the displayed content
        expect(email.value.translations.has(Language.French)).toBe(false);
        expect(email.value.translations.get(Language.English)!.subject).toBe('Root subject');
        expect(hook.currentLanguage.value).toBe(Language.English);
    });

    test('a language that was seeded, changed and reverted is still removed when switching away', async () => {
        const { email, hook } = createHook(Email.create({ subject: 'Root subject', json: { type: 'doc' }, language: Language.Dutch }));

        await hook.addLanguage(Language.French);
        hook.subject.value = 'Sujet français';
        hook.subject.value = 'Root subject';

        await hook.switchTo(Language.Dutch);
        expect(email.value.translations.has(Language.French)).toBe(false);
    });

    test('switching to null goes to the default language', async () => {
        const { hook } = createHook(Email.create({ subject: 'Root subject', json: { type: 'doc' }, language: Language.Dutch, translations: new Map([[Language.French, buildContent()]]) }));

        await hook.switchTo(Language.French);
        expect(hook.currentLanguage.value).toBe(Language.French);

        // The stale-translations review uses null for the default content
        await hook.switchTo(null);
        expect(hook.currentLanguage.value).toBe(Language.Dutch);
    });

    test('an existing translation is never cleaned up on switching', async () => {
        const { email, hook } = createHook(Email.create({ subject: 'Root subject', json: { type: 'doc' }, language: Language.Dutch, translations: new Map([[Language.French, buildContent({ subject: 'Sujet' })]]) }));

        await hook.switchTo(Language.French);
        await hook.switchTo(Language.Dutch);
        expect(email.value.translations.get(Language.French)!.subject).toBe('Sujet');
    });
});

describe('getChangedEmailContentLanguages', () => {
    test('returns nothing when nothing changed', () => {
        const original = buildHolder({ language: Language.Dutch, translations: [[Language.French, {}]] });
        const patched = buildHolder({ language: Language.Dutch, translations: [[Language.French, {}]] });
        expect(getChangedEmailContentLanguages(original, patched)).toEqual([]);
    });

    test('detects a changed default subject as null', () => {
        const original = buildHolder();
        const patched = buildHolder({ subject: 'Other subject' });
        expect(getChangedEmailContentLanguages(original, patched)).toEqual([null]);
    });

    test('only marking the first language does not count as a change', () => {
        const original = buildHolder();
        const patched = buildHolder({ language: Language.Dutch });
        expect(getChangedEmailContentLanguages(original, patched)).toEqual([]);
    });

    test('detects changed, added and removed translations', () => {
        const original = buildHolder({ language: Language.Dutch, translations: [[Language.French, {}], [Language.English, {}]] });
        const patched = buildHolder({ language: Language.Dutch, translations: [[Language.French, { subject: 'Nouveau sujet' }]] });
        expect(getChangedEmailContentLanguages(original, patched).sort()).toEqual([Language.English, Language.French].sort());
    });

    test('ignores html and text differences: only subject and json are compared', () => {
        const original = buildHolder();
        const patched = buildHolder();
        patched.html = '<p>different derived html</p>';
        patched.text = 'different derived text';
        expect(getChangedEmailContentLanguages(original, patched)).toEqual([]);
    });
});

describe('getStaleEmailContentLanguages', () => {
    test('empty when nothing changed', () => {
        const original = buildHolder({ language: Language.Dutch, translations: [[Language.French, {}]] });
        const patched = buildHolder({ language: Language.Dutch, translations: [[Language.French, {}]] });
        expect(getStaleEmailContentLanguages(original, patched)).toEqual([]);
    });

    test('reports untouched translations when only the default content changed', () => {
        const original = buildHolder({ language: Language.Dutch, translations: [[Language.French, {}]] });
        const patched = buildHolder({ subject: 'Updated default', language: Language.Dutch, translations: [[Language.French, {}]] });
        expect(getStaleEmailContentLanguages(original, patched)).toEqual([Language.French]);
    });

    test('reports the default content when only a translation changed', () => {
        const original = buildHolder({ language: Language.Dutch, translations: [[Language.French, {}]] });
        const patched = buildHolder({ language: Language.Dutch, translations: [[Language.French, { subject: 'Nouveau sujet' }]] });
        expect(getStaleEmailContentLanguages(original, patched)).toEqual([null]);
    });

    test('empty when every existing language was updated', () => {
        const original = buildHolder({ language: Language.Dutch, translations: [[Language.French, {}]] });
        const patched = buildHolder({ subject: 'Updated default', language: Language.Dutch, translations: [[Language.French, { subject: 'Nouveau sujet' }]] });
        expect(getStaleEmailContentLanguages(original, patched)).toEqual([]);
    });

    test('adding a new translation does not make other languages stale', () => {
        const original = buildHolder({ language: Language.Dutch, translations: [[Language.French, {}]] });
        const patched = buildHolder({ language: Language.Dutch, translations: [[Language.French, {}], [Language.English, {}]] });
        expect(getStaleEmailContentLanguages(original, patched)).toEqual([]);
    });

    test('removing a translation does not make other languages stale', () => {
        const original = buildHolder({ language: Language.Dutch, translations: [[Language.French, {}], [Language.English, {}]] });
        const patched = buildHolder({ language: Language.Dutch, translations: [[Language.French, {}]] });
        expect(getStaleEmailContentLanguages(original, patched)).toEqual([]);
    });

    test('removing the default language with a move-over does not make other languages stale', () => {
        // Dutch (default) is removed: French moves into the default content and becomes the default language
        const original = buildHolder({ subject: 'Root subject', language: Language.Dutch, translations: [[Language.French, { subject: 'Sujet' }]] });
        const patched = buildHolder({ subject: 'Sujet', language: Language.French });
        expect(getStaleEmailContentLanguages(original, patched)).toEqual([]);
    });

    test('changing the default and adding a translation still reports untouched translations', () => {
        const original = buildHolder({ language: Language.Dutch, translations: [[Language.French, {}]] });
        const patched = buildHolder({ subject: 'Updated default', language: Language.Dutch, translations: [[Language.French, {}], [Language.English, {}]] });
        expect(getStaleEmailContentLanguages(original, patched)).toEqual([Language.French]);
    });
});

describe('EmailContentPatch on the Email structure', () => {
    test('a move-over patch applies atomically', () => {
        const email = Email.create({
            subject: 'Root subject',
            json: { type: 'doc' },
            language: Language.Dutch,
            translations: new Map([[Language.French, buildContent({ subject: 'Sujet' })]]),
        });

        const patch = createRemoveLanguagePatch(email, Language.Dutch);
        const patched = email.patch(Email.patch(patch));

        expect(patched.language).toBe(Language.French);
        expect(patched.subject).toBe('Sujet');
        expect(patched.translations.size).toBe(0);
    });
});
