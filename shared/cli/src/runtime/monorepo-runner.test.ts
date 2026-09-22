import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CliContext } from '../context/create-context.js';
import { run, RunVerbosity } from './command-runner.js';
import { buildShared, lint, sharedBuildReadyCommand, sharedBuildWatchCommand, typecheck } from './monorepo-runner.js';

vi.mock('./command-runner.js', async importOriginal => ({ ...await importOriginal<typeof import('./command-runner.js')>(), run: vi.fn() }));

const context: CliContext = {
    rootDir: '/repo',
    generatedDir: '/repo/.development/cli/generated',
    env: 'stamhoofd',
    workspace: 'default',
    verbose: true,
    instance: { name: 'stamhoofd', prefix: '', primary: true, portOffset: 0 },
};

describe('shared build orchestration', () => {
    beforeEach(() => {
        vi.resetAllMocks();
    });

    it('uses the canonical shared build command once', async () => {
        await buildShared(context);

        expect(run).toHaveBeenCalledExactlyOnceWith('pnpm', ['run', 'build:shared'], { cwd: '/repo', verbose: true });
    });

    it('propagates a failed shared build', async () => {
        vi.mocked(run).mockRejectedValueOnce(new Error('Compilation failed'));

        await expect(buildShared(context)).rejects.toThrow('Compilation failed');
    });

    it.each([
        ['lint', lint],
        ['typecheck', typecheck],
    ] as const)('uses the root %s command and propagates failures', async (script, check) => {
        vi.mocked(run).mockRejectedValueOnce(new Error('Check failed'));

        await expect(check(context)).rejects.toThrow('Check failed');
        expect(run).toHaveBeenCalledExactlyOnceWith('pnpm', ['run', script], { cwd: '/repo', verbosity: RunVerbosity.Output });
    });

    it('only publishes readiness after a successful build and keeps watching after errors', () => {
        const readyFile = sharedBuildReadyCommand().split(' ')[1];
        const watch = sharedBuildWatchCommand();

        expect(watch).toContain(`rm -f ${readyFile}`);
        expect(watch).toContain(`--exec 'pnpm run build:shared && touch ${readyFile} || exit 0'`);
        expect(watch).toContain('--signal SIGTERM');
        expect(watch).toContain('--watch shared --watch backend/shared');
        expect(watch).toContain('--watch turbo.json');
        expect(watch).toContain("--ignore './shared/*/dist/' --ignore './backend/shared/*/dist/'");
    });
});
