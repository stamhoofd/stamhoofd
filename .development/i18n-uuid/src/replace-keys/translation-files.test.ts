import fs from 'fs';
import { afterEach, expect, it, vi } from 'vitest';
import { readTranslations } from './read-translations.js';
import { writeTranslation } from './write-translations.js';
import { getTranslationsWithPath } from './get-translations-with-path.js';
import { replaceKeysWithUuid } from './replace-keys-with-uuid.js';

vi.mock('./get-translations-with-path.js', () => ({ getTranslationsWithPath: vi.fn() }));
vi.mock('../shared/get-files-to-search.js', () => ({ getFilesToSearch: () => [], translatableFileTypes: [] }));

afterEach(() => vi.restoreAllMocks());

it('round-trips locale text, nested entries and reserved metadata through maps', () => {
    const locale = { extends: ['nl'], replacements: { lid: 'member' }, nested: { greeting: 'Hallo' }, '%2': 'Dag' };
    vi.spyOn(fs, 'readFileSync').mockReturnValue(JSON.stringify(locale));
    const write = vi.spyOn(fs, 'writeFileSync').mockImplementation(() => {});

    const translations = readTranslations('locale.json');
    expect(translations).toBeInstanceOf(Map);
    expect(translations.get('%2')).toBe('Dag');
    writeTranslation('locale.json', translations);

    expect(JSON.parse(write.mock.calls[0][1] as string)).toEqual(locale);
    expect(Object.keys(JSON.parse(write.mock.calls[0][1] as string)).slice(0, 2)).toEqual(['extends', 'replacements']);
});

it('flattens nested locale entries to shared IDs while preserving metadata', async () => {
    const write = vi.spyOn(fs, 'writeFileSync').mockImplementation(() => {});
    vi.mocked(getTranslationsWithPath).mockReturnValue(new Map([
        ['nl.json', new Map<string, unknown>([['extends', ['base']], ['nested', { greeting: 'Hallo' }]])],
        ['en.json', new Map<string, unknown>([['nested', { greeting: 'Hello' }]])],
    ]));

    await replaceKeysWithUuid();

    expect(write).toHaveBeenCalledTimes(2);
    const dutch = JSON.parse(write.mock.calls[0][1] as string);
    const english = JSON.parse(write.mock.calls[1][1] as string);
    const [id] = Object.keys(english);
    expect(dutch).toEqual({ extends: ['base'], [id]: 'Hallo' });
    expect(english).toEqual({ [id]: 'Hello' });
});
