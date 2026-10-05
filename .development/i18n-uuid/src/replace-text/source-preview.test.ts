import fs from 'fs';
import { beforeEach, expect, it, vi } from 'vitest';
import { fileCache } from './FileCache.js';
import { translateTypescriptFileHelper, translateTypescriptFiles } from './translate-typescript-files.js';
import { getFilesToSearch } from '../shared/get-files-to-search.js';
import { globals } from '../shared/globals.js';
import { getChangedFiles } from './git-helper.js';
import type { TranslateTypescriptFileOptions } from './translate-typescript-files.js';
import type { TranslateVueFileOptions } from './translate-vue-template.js';
import { translateVueFileHelper } from './translate-vue-files.js';
import { eslintFormatter } from './eslint-formatter.js';

let deferred = false;
vi.mock('fs', async original => ({ ...await original<typeof import('fs')>(), default: { ...await original<typeof import('fs')>(), readFileSync: vi.fn(), writeFileSync: vi.fn() } }));
vi.mock('./FileCache.js', () => ({ fileCache: { addFile: vi.fn(), doubtFile: vi.fn(), hasFile: vi.fn(() => false) } }));
vi.mock('../shared/get-files-to-search.js', () => ({ getFilesToSearch: vi.fn() }));
vi.mock('./git-helper.js', () => ({ getChangedFiles: vi.fn() }));
vi.mock('./eslint-formatter.js', () => ({ eslintFormatter: { tryFixFile: vi.fn() } }));
vi.mock('./typescript-translator.js', () => ({ translateTypescript: vi.fn(async (_text: string, options: TranslateTypescriptFileOptions) => {
    if (deferred) options.onPromptDoubt?.();
    return "$t('Opslaan')";
}), getTotalMatchCount: vi.fn() }));
vi.mock('./translate-vue-template.js', () => ({ translateVueTemplate: vi.fn(async (_text: string, options: TranslateVueFileOptions) => {
    if (deferred) options.onPromptDoubt?.();
    return "<template>{{ $t('Opslaan') }}</template>";
}), getVueTemplateMatchCount: vi.fn() }));

beforeEach(() => vi.clearAllMocks());

it.each([false, true])('excludes locale configuration from source migration (changes only: %s)', async (replaceChangesOnly) => {
    const config = `${globals.I18NUUID_LOCALES_ROOT}/src/index.ts`;
    const nestedConfig = `${globals.I18NUUID_LOCALES_ROOT}/src/nested/config.ts`;
    const source = `${globals.I18NUUID_ROOT}/frontend/example.ts`;
    const similarName = `${globals.I18NUUID_LOCALES_ROOT}-ui/example.ts`;
    const files = [config, nestedConfig, source, similarName];
    vi.mocked(getFilesToSearch).mockReturnValue(files);
    vi.mocked(getChangedFiles).mockReturnValue(new Set(files));
    vi.mocked(fs.readFileSync).mockReturnValue("const label = 'Opslaan';");
    deferred = false;
    await translateTypescriptFiles({ replaceChangesOnly, doPrompt: false });
    expect(vi.mocked(fs.readFileSync).mock.calls.map(([file]) => file)).toEqual([source, similarName]);
    expect(vi.mocked(fs.writeFileSync).mock.calls.map(([file]) => file)).toEqual([source, similarName]);
    expect(fileCache.addFile).not.toHaveBeenCalledWith(config);
    expect(fileCache.addFile).not.toHaveBeenCalledWith(nestedConfig);
});

it.each([
    ['Vue', translateVueFileHelper, false],
    ['Vue', translateVueFileHelper, true],
    ['TypeScript', translateTypescriptFileHelper, false],
    ['TypeScript', translateTypescriptFileHelper, true],
] as const)('does not write files or cache during %s preview', async (_format, translateFile, doubt) => {
    deferred = doubt;
    vi.mocked(fs.readFileSync).mockReturnValue('<template>Opslaan</template>');
    await translateFile('/example', { dryRun: true, doFix: true });
    expect(fs.writeFileSync).not.toHaveBeenCalled();
    expect(fileCache.addFile).not.toHaveBeenCalled();
    expect(fileCache.doubtFile).not.toHaveBeenCalled();
    expect(eslintFormatter.tryFixFile).not.toHaveBeenCalled();
});
