import fs from 'fs';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { unusedKeys } from './unused-keys.js';
import { mergeDuplicates } from './merge-duplicates.js';
import { getTranslationsWithPath } from './get-translations-with-path.js';
import { writeTranslation } from './write-translations.js';
import { findUnusedTranslationKeys } from './replace-keys-with-uuid.js';

vi.mock('fs', () => ({ default: { readFileSync: vi.fn(), writeFileSync: vi.fn() } }));
vi.mock('../shared/get-files-to-search.js', () => ({ getFilesToSearch: () => ['source.ts'], translatableFileTypes: [] }));
vi.mock('./get-translations-with-path.js', () => ({ getTranslationsWithPath: vi.fn() }));
vi.mock('./write-translations.js', () => ({ writeTranslation: vi.fn() }));

beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getTranslationsWithPath).mockReturnValue(new Map([['nl.json', { '%1': 'Save', '%2': 'Save' }]]));
    vi.mocked(fs.readFileSync).mockReturnValue("$t('%1')");
});

it('scans source files once across all languages and reports overall cleanup completion', async () => {
    vi.mocked(getTranslationsWithPath).mockReturnValue(new Map([
        ['nl.json', { '%1': 'Save', '%2': 'Remove' }],
        ['fr.json', { '%1': 'Enregistrer', '%2': 'Supprimer' }],
    ]));
    const progress = vi.fn();
    expect(await unusedKeys(progress)).toBe(2);
    expect(fs.readFileSync).toHaveBeenCalledTimes(1);
    expect(progress).toHaveBeenLastCalledWith(expect.objectContaining({
        phase: 'cleanup', completed: 2, total: 2, overallCompleted: 3, overallTotal: 3,
    }));
    const overall = progress.mock.calls.map(([event]) => event.overallCompleted);
    expect(overall).toEqual([...overall].sort((a, b) => a - b));
    expect(writeTranslation).toHaveBeenCalledWith('fr.json', { '%1': 'Enregistrer' });
});

it('preserves all supported literal key usages, including punctuation and multiline calls', async () => {
    const used = ['single', 'double', 'template', 'handlebars-single', 'handlebars-double', 'a.b+[c]?', 'quote\'inside', 'multiline', 'back\\slash'];
    vi.mocked(fs.readFileSync).mockReturnValue([
        "$t('single')", '$t("double")', '$t(`template`)', "{{$t 'handlebars-single'}}", '{{ $t\n "handlebars-double"}}',
        "$t('a.b+[c]?')", "$t(\"quote'inside\")", "$t('multiline'\n, {})", "$t('back\\slash')", "$t('prefix-extra')", '$translate("unused")',
    ].join('\n'));
    expect(await findUnusedTranslationKeys(new Set([...used, 'prefix', 'unused']), ['source.ts'])).toEqual(new Set(['prefix', 'unused']));
});

it('handles a large unused-key set across many source files', async () => {
    const keys = new Set(Array.from({ length: 1000 }, (_, i) => `%${i}`));
    vi.mocked(fs.readFileSync).mockReturnValue("const label = $t('%1');\n".repeat(10));
    const unused = await findUnusedTranslationKeys(keys, Array.from({ length: 100 }, (_, i) => `source-${i}.ts`));
    expect(unused.size).toBe(999);
    expect(unused.has('%1')).toBe(false);
    expect(fs.readFileSync).toHaveBeenCalledTimes(100);
});

it('keeps unchanged files and reserved metadata untouched', async () => {
    vi.mocked(getTranslationsWithPath).mockReturnValue(new Map<string, Record<string, string>>([
        ['nl.json', { '%1': 'Save', replacements: 'reserved', extends: 'reserved', 'consistent-words': 'reserved' }],
        ['fr.json', { '%2': 'Supprimer' }],
    ]));
    expect(await unusedKeys()).toBe(1);
    expect(writeTranslation).toHaveBeenCalledExactlyOnceWith('fr.json', {});
});

it('does not change any translation files when the shared scan fails', async () => {
    vi.mocked(fs.readFileSync).mockImplementationOnce(() => { throw new Error('unreadable source'); });
    await expect(unusedKeys()).rejects.toThrow('unreadable source');
    expect(writeTranslation).not.toHaveBeenCalled();
});

it('preserves conservative literal matching for quoted keys and overlapping source snippets', async () => {
    vi.mocked(fs.readFileSync).mockReturnValue("$t('short'long') $t('outer$t('inner')') $t('')");
    expect(await findUnusedTranslationKeys(new Set(['short', "short'long", "outer$t('inner')", 'inner', '', 'unused']), ['source.ts']))
        .toEqual(new Set(['unused']));
});
afterEach(() => vi.restoreAllMocks());

it('reports unused-key scan progress, yields to the CLI, and returns a removal summary', async () => {
    let yielded = false;
    const scheduled = new Promise<void>(resolve => setImmediate(() => { yielded = true; resolve(); }));
    const progress = vi.fn();
    const removed = await unusedKeys(progress);
    expect(yielded).toBe(true);
    await scheduled;
    expect(removed).toBe(1);
    expect(progress).toHaveBeenCalledWith(expect.objectContaining({ phase: 'scan', completed: 1, total: 1 }));
    expect(writeTranslation).toHaveBeenCalledWith('nl.json', { '%1': 'Save' });
});

it('returns a duplicate summary without printing manual command guidance', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    expect(await mergeDuplicates()).toBe(1);
    expect(log).not.toHaveBeenCalled();
});
