import { beforeEach, describe, expect, it, vi } from 'vitest';
import { run, RunVerbosity } from './command-runner.js';
import { translate, translateCompress, translateKeys, translateMachine } from './translate.js';
import { replaceKeys } from 'i18n-uuid/replace-keys';
import { mergeDuplicates } from 'i18n-uuid/merge-duplicates';
import { unusedKeys } from 'i18n-uuid/unused-keys';
import { autoTranslate } from 'i18n-uuid/auto-translate';

const calls: string[] = [];
vi.mock('./command-runner.js', async importOriginal => ({
    ...await importOriginal<typeof import('./command-runner.js')>(),
    run: vi.fn(async () => { calls.push('build'); }),
}));
vi.mock('../context/project-path.js', () => ({ getProjectPath: () => '/repo/' }));
vi.mock('i18n-uuid/replace-keys', () => ({ replaceKeys: vi.fn(() => { calls.push('keys'); }) }));
vi.mock('i18n-uuid/merge-duplicates', () => ({ mergeDuplicates: vi.fn(() => { calls.push('merge'); }) }));
vi.mock('i18n-uuid/unused-keys', () => ({ unusedKeys: vi.fn(() => { calls.push('unused'); }) }));
vi.mock('i18n-uuid/auto-translate', () => ({ autoTranslate: vi.fn(async () => { calls.push('machine'); }) }));
vi.spyOn(process, 'cwd').mockReturnValue('/previous');
vi.spyOn(process, 'chdir').mockImplementation(() => {});

describe('translate pipeline', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        calls.length = 0;
    });

    it.each([
        [translateKeys, ['keys', 'keys']],
        [translateCompress, ['build', 'merge', 'unused']],
        [translateMachine, ['build', 'machine']],
        [translate, ['keys', 'keys', 'build', 'merge', 'unused', 'build', 'machine']],
    ])('runs the expected stages in order', async (command, stages) => {
        await command();
        expect(calls).toEqual(stages);
        expect(process.chdir).toHaveBeenCalledWith('/repo/.development/i18n-uuid');
        expect(process.chdir).toHaveBeenLastCalledWith('/previous');
    });

    it('builds locales in the repo before cleanup and machine translation', async () => {
        await translateCompress();
        await translateMachine();
        expect(run).toHaveBeenCalledTimes(2);
        expect(run).toHaveBeenCalledWith('pnpm', ['--dir', 'shared/locales', 'run', 'build'], { cwd: '/repo/', verbosity: RunVerbosity.Output });
        expect(mergeDuplicates).toHaveBeenCalledTimes(1);
        expect(unusedKeys).toHaveBeenCalledTimes(1);
        expect(autoTranslate).toHaveBeenCalledWith({});
        expect(replaceKeys).not.toHaveBeenCalled();
    });

    it('restores the working directory after a failure', async () => {
        vi.mocked(autoTranslate).mockRejectedValueOnce(new Error('failed'));
        await expect(translateMachine()).rejects.toThrow('failed');
        expect(process.chdir).toHaveBeenLastCalledWith('/previous');
    });

    it('forwards machine options without running key or cleanup stages', async () => {
        const options = { fake: true, locales: ['fr'] };
        await translateMachine(options);
        expect(autoTranslate).toHaveBeenCalledWith(options);
        expect(calls).toEqual(['build', 'machine']);
    });
});
