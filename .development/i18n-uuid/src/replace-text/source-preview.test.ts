import fs from 'fs';
import { beforeEach, expect, it, vi } from 'vitest';
import { fileCache } from './FileCache.js';
import { translateTypescriptFileHelper } from './translate-typescript-files.js';
import type { TranslateTypescriptFileOptions } from './translate-typescript-files.js';
import type { TranslateVueFileOptions } from './translate-vue-template.js';
import { translateVueFileHelper } from './translate-vue-files.js';
import { eslintFormatter } from './eslint-formatter.js';

let deferred = false;
vi.mock('fs', async original => ({ ...await original<typeof import('fs')>(), default: { ...await original<typeof import('fs')>(), readFileSync: vi.fn(), writeFileSync: vi.fn() } }));
vi.mock('./FileCache.js', () => ({ fileCache: { addFile: vi.fn(), doubtFile: vi.fn() } }));
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
