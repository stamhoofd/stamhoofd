import { beforeEach, describe, expect, it, vi } from 'vitest';
import { run, RunVerbosity } from './command-runner.js';
import { translate, translateCompress, translateKeys, translateMachine } from './translate.js';
import { replaceKeys } from 'i18n-uuid/replace-keys';
import { mergeDuplicates } from 'i18n-uuid/merge-duplicates';
import { unusedKeys } from 'i18n-uuid/unused-keys';
import { autoTranslate } from 'i18n-uuid/auto-translate';
import { resolveTranslationApiKey } from './translation-credentials.js';
import { TranslatorType } from 'i18n-uuid/translator-type';
import { step } from './ux.js';

const calls: string[] = [];
vi.mock('./command-runner.js', async importOriginal => ({
    ...await importOriginal<typeof import('./command-runner.js')>(),
    run: vi.fn(async () => { calls.push('build'); return { status: 0, stdout: '', stderr: '' }; }),
}));
vi.mock('../context/project-path.js', () => ({ getProjectPath: () => '/repo/' }));
vi.mock('i18n-uuid/replace-keys', () => ({ replaceKeys: vi.fn(async () => { calls.push('keys'); return 1; }) }));
vi.mock('i18n-uuid/merge-duplicates', () => ({ mergeDuplicates: vi.fn(async () => { calls.push('merge'); return 2; }) }));
vi.mock('i18n-uuid/unused-keys', () => ({ unusedKeys: vi.fn(async () => { calls.push('unused'); return 3; }) }));
vi.mock('i18n-uuid/auto-translate', () => ({ autoTranslate: vi.fn(async () => { calls.push('machine'); }) }));
vi.mock('i18n-uuid/globals', () => ({ globals: { TRANSLATOR: 'OpenAi', DEFAULT_LOCALE: 'nl-BE' } }));
vi.mock('./translation-credentials.js', () => ({ resolveTranslationApiKey: vi.fn() }));
vi.mock('./ux.js', () => ({ step: vi.fn(async (_message, action) => await action(vi.fn())) }));
vi.mock('i18n-uuid/translation-manager', () => ({ TranslationManager: class {
    locales = ['nl', 'nl-BE', 'en', 'fr'];
    getMappedLocale(locale: string) { return locale === 'nl' ? 'nl-BE' : locale; }
} }));
vi.spyOn(process, 'chdir').mockImplementation(() => {});

describe('translate pipeline', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        calls.length = 0;
        vi.mocked(resolveTranslationApiKey).mockResolvedValue('test-key');
    });

    it.each([
        [translateKeys, ['keys', 'keys']],
        [translateCompress, ['build', 'merge', 'unused']],
        [translateMachine, ['build', 'machine']],
        [translate, ['keys', 'keys', 'build', 'merge', 'unused', 'build', 'machine']],
    ])('runs the expected stages in order', async (command, stages) => {
        await command();
        expect(calls).toEqual(stages);
        expect(process.chdir).not.toHaveBeenCalled();
    });

    it('builds locales in the repo before cleanup and machine translation', async () => {
        await translateCompress();
        await translateMachine();
        expect(run).toHaveBeenCalledTimes(2);
        expect(run).toHaveBeenCalledWith('pnpm', ['--dir', 'shared/locales', 'run', 'build'], { cwd: '/repo/', verbosity: RunVerbosity.Quiet, capture: true, allowFailure: true });
        expect(mergeDuplicates).toHaveBeenCalledTimes(1);
        expect(unusedKeys).toHaveBeenCalledTimes(1);
        expect(autoTranslate).toHaveBeenCalledWith({ apiKey: 'test-key', onProgress: expect.any(Function) });
        expect(replaceKeys).not.toHaveBeenCalled();
    });

    it('does not change the working directory on failure', async () => {
        vi.mocked(autoTranslate).mockRejectedValueOnce(new Error('failed'));
        await expect(translateMachine()).rejects.toThrow('failed');
        expect(process.chdir).not.toHaveBeenCalled();
    });

    it('forwards machine options without running key or cleanup stages', async () => {
        const options = { fake: true, locales: ['fr'] };
        await translateMachine(options);
        expect(autoTranslate).toHaveBeenCalledWith({ ...options, apiKey: undefined, onProgress: expect.any(Function) });
        expect(resolveTranslationApiKey).not.toHaveBeenCalled();
        expect(calls).toEqual(['build', 'machine']);
    });

    it('skips machine translation when preparing translations offline', async () => {
        await translate({ skipMachine: true });
        expect(calls).toEqual(['keys', 'keys', 'build', 'merge', 'unused']);
        expect(autoTranslate).not.toHaveBeenCalled();
        expect(resolveTranslationApiKey).not.toHaveBeenCalled();
    });

    it('stops the remaining pipeline stages when a required build fails', async () => {
        vi.mocked(run).mockRejectedValueOnce(new Error('build failed'));
        await expect(translate()).rejects.toThrow('build failed');
        expect(mergeDuplicates).not.toHaveBeenCalled();
        expect(unusedKeys).not.toHaveBeenCalled();
        expect(autoTranslate).not.toHaveBeenCalled();
    });

    it.each(['credentials', 'locale'])('validates %s before any pipeline mutations', async (problem) => {
        if (problem === 'credentials') {
            vi.mocked(resolveTranslationApiKey).mockRejectedValueOnce(new Error('OPENAI_API_KEY is unavailable'));
        }
        await expect(translate({ machine: { locales: problem === 'locale' ? ['unknown'] : ['fr'] } })).rejects.toThrow(problem === 'locale' ? 'configured non-Dutch locale' : 'OPENAI_API_KEY');
        expect(calls).toEqual([]);
    });

    it('passes the selected provider and resolved key to the translation library', async () => {
        await translateMachine({ translatorType: TranslatorType.MistralSmall, locales: ['fr'] });
        expect(resolveTranslationApiKey).toHaveBeenCalledWith(TranslatorType.MistralSmall);
        expect(autoTranslate).toHaveBeenCalledWith({ translatorType: TranslatorType.MistralSmall, locales: ['fr'], apiKey: 'test-key', onProgress: expect.any(Function) });
    });

    it('shows separate steps for the slow cleanup operations', async () => {
        await translateCompress();
        expect(vi.mocked(step).mock.calls.map(([message]) => message)).toEqual([
            'Build translation locales', 'Merge duplicate translations', 'Remove unused translation keys',
        ]);
    });

    it('preserves build diagnostics when suppressing routine build output', async () => {
        vi.mocked(run).mockResolvedValueOnce({ status: 1, stdout: 'TypeScript error', stderr: 'Build failed' } as never);
        await expect(translateCompress()).rejects.toThrow('TypeScript error\nBuild failed');
        expect(mergeDuplicates).not.toHaveBeenCalled();
    });
});
