import fs from 'fs';
import { afterEach, expect, it, vi } from 'vitest';
import { TranslationManager } from './TranslationManager.js';

afterEach(() => vi.restoreAllMocks());

it('reads only string replacements into a map', () => {
    vi.spyOn(fs, 'existsSync').mockReturnValue(true);
    vi.spyOn(fs, 'readFileSync').mockReturnValue(JSON.stringify({ replacements: { lid: 'deelnemer', ignored: [] } }));

    expect(TranslationManager.readReplacementsAllowNull('locale.json')).toEqual(new Map([['lid', 'deelnemer']]));
});

it('reads consistent words into a map at the JSON boundary', () => {
    vi.spyOn(fs, 'existsSync').mockReturnValue(true);
    vi.spyOn(fs, 'readFileSync').mockReturnValue(JSON.stringify({ lid: 'member', groep: 'group' }));

    expect(TranslationManager.getConsistentWordsHelper('en', 'stamhoofd')).toEqual(new Map([
        ['lid', 'member'],
        ['groep', 'group'],
    ]));
});

it('keeps an empty consistent-word file absent', () => {
    vi.spyOn(fs, 'existsSync').mockReturnValue(true);
    vi.spyOn(fs, 'readFileSync').mockReturnValue('{}');

    expect(TranslationManager.getConsistentWordsHelper('en', 'stamhoofd')).toBeNull();
});
