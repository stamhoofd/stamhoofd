import { beforeEach, describe, expect, it, vi } from 'vitest';
import { run, RunVerbosity } from './command-runner.js';
import { translate, translateCompress, translateKeys, translateMachine } from './translate.js';

vi.mock('./command-runner.js', async importOriginal => ({
    ...await importOriginal<typeof import('./command-runner.js')>(),
    run: vi.fn(),
}));
vi.mock('../context/project-path.js', () => ({ getProjectPath: () => '/repo/' }));

describe('translate scripts', () => {
    beforeEach(() => vi.clearAllMocks());

    it.each([
        [translateKeys, ['replace-keys', 'replace-keys']],
        [translateCompress, ['build', 'merge-duplicates', 'unused-keys']],
        [translateMachine, ['build', 'auto-translate']],
        [translate, ['replace-keys', 'replace-keys', 'build', 'merge-duplicates', 'unused-keys', 'build', 'auto-translate']],
    ])('runs the expected scripts in order', async (command, scripts) => {
        await command();
        expect(vi.mocked(run).mock.calls).toEqual(scripts.map(script => [
            'pnpm',
            ['--dir', script === 'build' ? 'shared/locales' : '.development/i18n-uuid', 'run', script],
            { cwd: '/repo/', verbosity: RunVerbosity.Output },
        ]));
    });

    it('stops at the first failed script', async () => {
        vi.mocked(run).mockRejectedValueOnce(new Error('failed'));
        await expect(translate()).rejects.toThrow('failed');
        expect(run).toHaveBeenCalledTimes(1);
    });
});
