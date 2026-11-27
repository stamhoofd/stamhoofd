import { Parser } from '@oclif/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import CheckFormat from './format.js';
import { createContext } from '../../context/create-context.js';
import { run, RunVerbosity } from '../../runtime/command-runner.js';

vi.mock('../../context/create-context.js', () => ({
    createContext: vi.fn(async () => ({ rootDir: '/repo' })),
}));
vi.mock('../../runtime/command-runner.js', async (importOriginal) => ({
    ...(await importOriginal<typeof import('../../runtime/command-runner.js')>()),
    run: vi.fn(),
}));

describe('check format', () => {
    beforeEach(() => vi.clearAllMocks());

    it.each([
        [[], '--check'],
        [['--fix'], '--write'],
    ])('runs the formatters for %j', async (args, mode) => {
        const command = new CheckFormat([], {} as never);
        (command as any).parse = vi.fn(
            async () => await Parser.parse(args, { flags: CheckFormat.flags }),
        );

        await command.run();

        expect(createContext).toHaveBeenCalledWith({
            env: 'stamhoofd',
            instanceName: undefined,
            verbose: false,
        });
        expect(run).toHaveBeenCalledWith('pnpm', ['exec', 'oxfmt', mode], {
            cwd: '/repo',
            verbosity: RunVerbosity.Output,
        });
        expect(run).toHaveBeenCalledWith(
            'node',
            ['/repo/shared/eslint/bin/format.mjs', ...(mode === '--write' ? ['--fix'] : [])],
            { cwd: '/repo', verbosity: RunVerbosity.Output },
        );
        expect(run).toHaveBeenCalledTimes(2);
    });

    it('passes the revision files explicitly when running inside jj run', async () => {
        vi.stubEnv('JJ_COMMIT_ID', 'abc');
        try {
            vi.mocked(run).mockResolvedValueOnce({
                stdout: [
                    '100644 package.json',
                    '100644 file with spaces.md',
                    '160000 submodule',
                    '',
                ].join('\0'),
                stderr: '',
                status: 0,
            });
            const command = new CheckFormat([], {} as never);
            (command as any).parse = vi.fn(() =>
                Parser.parse(['--fix'], { flags: CheckFormat.flags }),
            );
            await command.run();
            expect(run).toHaveBeenCalledWith(
                'pnpm',
                [
                    'exec',
                    'oxfmt',
                    '--write',
                    '--no-error-on-unmatched-pattern',
                    '--',
                    'package.json',
                    'file with spaces.md',
                ],
                { cwd: '/repo', verbosity: RunVerbosity.Output },
            );
        } finally {
            vi.unstubAllEnvs();
        }
    });
});
