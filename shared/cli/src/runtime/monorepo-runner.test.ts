import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CliContext } from '../context/create-context.js';
import { run, RunVerbosity } from './command-runner.js';
import { buildAll, buildShared, coverageTestPackages, lint, migrate, runUnitTests, sharedBuildReadyCommand, sharedBuildWatchCommand, typecheck } from './monorepo-runner.js';

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

        expect(run).toHaveBeenCalledExactlyOnceWith('pnpm', ['run', 'build:shared'], { cwd: '/repo', verbosity: RunVerbosity.Output });
    });

    it('propagates a failed shared build', async () => {
        vi.mocked(run).mockRejectedValueOnce(new Error('Compilation failed'));

        await expect(buildShared(context)).rejects.toThrow('Compilation failed');
    });

    it('builds app packages with explicit Turbo filters and the selected environment', async () => {
        await buildAll(context);

        expect(run).toHaveBeenNthCalledWith(1, 'pnpm', ['run', 'build:shared'], { cwd: '/repo', verbosity: RunVerbosity.Output });
        expect(run).toHaveBeenNthCalledWith(2, 'pnpm', [
            'exec',
            'turbo',
            'run',
            'build',
            '--env-mode=loose',
            '--filter=@stamhoofd/backend',
            '--filter=@stamhoofd/backend-renderer',
            '--filter=@stamhoofd/backend-statistics-syncer',
            '--filter=@stamhoofd/web-app',
            '--filter=@stamhoofd/webshop',
        ], { cwd: '/repo', env: { STAMHOOFD_ENV: 'stamhoofd' }, verbosity: RunVerbosity.Output });
    });

    it('uses the canonical migration command and propagates failures', async () => {
        vi.mocked(run).mockRejectedValueOnce(new Error('Migration failed'));

        await expect(migrate(context)).rejects.toThrow('Migration failed');
        expect(run).toHaveBeenCalledExactlyOnceWith('pnpm', ['run', 'migrate'], {
            cwd: '/repo',
            env: expect.objectContaining({ STAMHOOFD_ENV: 'stamhoofd' }),
            verbosity: RunVerbosity.Output,
        });
    });

    it('runs the coverage inventory through Vitest coverage without Nx environment', async () => {
        expect(coverageTestPackages.map(pkg => pkg.name)).toEqual([
            'i18n-uuid',
            'metabase',
            'structures',
            'object-differ',
            'utility',
            'queues',
            'models',
            'vies',
            'sql',
            'renderer',
            'redirecter',
            'statistics-syncer',
            'api',
        ]);

        await runUnitTests(context, {
            packages: [{ name: 'utility', path: 'shared/utility', needsDatabase: false }],
            skipBuild: true,
            coverage: true,
        });

        expect(run).toHaveBeenCalledExactlyOnceWith('pnpm', ['exec', 'vitest', 'run', '--coverage'], {
            cwd: '/repo/shared/utility',
            env: { CI: undefined, DB_PORT: undefined },
            verbosity: RunVerbosity.Output,
        });
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
