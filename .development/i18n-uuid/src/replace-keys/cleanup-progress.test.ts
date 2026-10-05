import fs from 'fs';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { unusedKeys } from './unused-keys.js';
import { mergeDuplicates } from './merge-duplicates.js';
import { getTranslationsWithPath } from './get-translations-with-path.js';
import { writeTranslation } from './write-translations.js';

vi.mock('fs', () => ({ default: { readFileSync: vi.fn(), writeFileSync: vi.fn() } }));
vi.mock('../shared/get-files-to-search.js', () => ({ getFilesToSearch: () => ['source.ts'], translatableFileTypes: [] }));
vi.mock('./get-translations-with-path.js', () => ({ getTranslationsWithPath: vi.fn() }));
vi.mock('./write-translations.js', () => ({ writeTranslation: vi.fn() }));

beforeEach(() => {
    vi.mocked(getTranslationsWithPath).mockReturnValue(new Map([['nl.json', { '%1': 'Save', '%2': 'Save' }]]));
    vi.mocked(fs.readFileSync).mockReturnValue("$t('%1')");
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
