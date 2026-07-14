import { EmailContent } from '@stamhoofd/structures';
import { Language } from '@stamhoofd/types/Language';
import { describe, expect, test } from 'vitest';
import type { EmailContentHolder } from './useEmailContentLanguage';
import { getChangedEmailContentLanguages, getStaleEmailContentLanguages } from './useEmailContentLanguage';

function buildHolder(options: { subject?: string; json?: any; translations?: [Language, { subject?: string; json?: any }][] } = {}): EmailContentHolder {
    return {
        subject: options.subject ?? 'Default subject',
        html: '<p>html</p>',
        text: 'text',
        json: options.json ?? { type: 'doc' },
        translations: new Map((options.translations ?? []).map(([language, content]) => [language, EmailContent.create({
            subject: content.subject ?? 'Translated subject',
            html: '<p>html</p>',
            text: 'text',
            json: content.json ?? { type: 'doc' },
        })])),
    };
}

describe('getChangedEmailContentLanguages', () => {
    test('returns nothing when nothing changed', () => {
        const original = buildHolder({ translations: [[Language.French, {}]] });
        const patched = buildHolder({ translations: [[Language.French, {}]] });
        expect(getChangedEmailContentLanguages(original, patched)).toEqual([]);
    });

    test('detects a changed default subject as null', () => {
        const original = buildHolder();
        const patched = buildHolder({ subject: 'Other subject' });
        expect(getChangedEmailContentLanguages(original, patched)).toEqual([null]);
    });

    test('detects changed, added and removed translations', () => {
        const original = buildHolder({ translations: [[Language.French, {}], [Language.English, {}]] });
        const patched = buildHolder({ translations: [[Language.French, { subject: 'Nouveau sujet' }], [Language.Dutch, {}]] });
        expect(getChangedEmailContentLanguages(original, patched).sort()).toEqual([Language.Dutch, Language.English, Language.French].sort());
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
        const original = buildHolder({ translations: [[Language.French, {}]] });
        const patched = buildHolder({ translations: [[Language.French, {}]] });
        expect(getStaleEmailContentLanguages(original, patched)).toEqual([]);
    });

    test('reports untouched translations when only the default content changed', () => {
        const original = buildHolder({ translations: [[Language.French, {}]] });
        const patched = buildHolder({ subject: 'Updated default', translations: [[Language.French, {}]] });
        expect(getStaleEmailContentLanguages(original, patched)).toEqual([Language.French]);
    });

    test('reports the default content when only a translation changed', () => {
        const original = buildHolder({ translations: [[Language.French, {}]] });
        const patched = buildHolder({ translations: [[Language.French, { subject: 'Nouveau sujet' }]] });
        expect(getStaleEmailContentLanguages(original, patched)).toEqual([null]);
    });

    test('empty when every existing language was updated', () => {
        const original = buildHolder({ translations: [[Language.French, {}]] });
        const patched = buildHolder({ subject: 'Updated default', translations: [[Language.French, { subject: 'Nouveau sujet' }]] });
        expect(getStaleEmailContentLanguages(original, patched)).toEqual([]);
    });

    test('adding a new translation does not make other languages stale', () => {
        const original = buildHolder({ translations: [[Language.French, {}]] });
        const patched = buildHolder({ translations: [[Language.French, {}], [Language.English, {}]] });
        expect(getStaleEmailContentLanguages(original, patched)).toEqual([]);
    });

    test('removing a translation does not make other languages stale', () => {
        const original = buildHolder({ translations: [[Language.French, {}], [Language.English, {}]] });
        const patched = buildHolder({ translations: [[Language.French, {}]] });
        expect(getStaleEmailContentLanguages(original, patched)).toEqual([]);
    });

    test('changing the default and adding a translation still reports untouched translations', () => {
        const original = buildHolder({ translations: [[Language.French, {}]] });
        const patched = buildHolder({ subject: 'Updated default', translations: [[Language.French, {}], [Language.English, {}]] });
        expect(getStaleEmailContentLanguages(original, patched)).toEqual([Language.French]);
    });
});
