import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CliContext } from '../context/create-context.js';
import { run, RunVerbosity } from './command-runner.js';
import { buildAll, buildShared, coverageTestPackages, lint, migrate, runUnitTests, sharedBuildReadyCommand, sharedBuildWatchCommand, testE2e, typecheck, unitTestPackages } from './monorepo-runner.js';
import { isPortListening } from './port-probe.js';
import { CaddyService } from '../services/definitions/caddy-service.js';

vi.mock('./command-runner.js', async importOriginal => ({ ...await importOriginal<typeof import('./command-runner.js')>(), run: vi.fn() }));
vi.mock('./port-probe.js', () => ({ isPortListening: vi.fn() }));
vi.mock('../services/shared-services.js', () => ({ startSharedServices: vi.fn() }));
vi.mock('../services/definitions/caddy-service.js', () => ({ CaddyService: { reload: vi.fn() } }));

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

    it.each([undefined, '3/4'])('passes shard %s to Playwright without changing its reserved worker count', async (shard) => {
        vi.mocked(isPortListening).mockResolvedValue(true);

        await testE2e(context, { ci: true, clear: false, ui: false, skipBuild: true, localDb: true, workers: 2, shard });

        expect(run).toHaveBeenCalledExactlyOnceWith('pnpm', [
            '--dir', 'tests/playwright', 'run', 'test', '--workers', '2', ...(shard === undefined ? [] : ['--shard', shard]),
        ], expect.objectContaining({ env: expect.objectContaining({ PLAYWRIGHT_WORKER_COUNT: '2', CI: 'true' }) }));
        expect(CaddyService.reload).toHaveBeenCalledWith(context);
    });

    it.each([false, true])('only enables migration diagnostics when verbose is %s', async (verbose) => {
        vi.mocked(isPortListening).mockResolvedValue(true);

        await testE2e({ ...context, verbose }, { ci: false, clear: false, ui: false, skipBuild: true, localDb: true });

        expect(run).toHaveBeenCalledWith('pnpm', expect.any(Array), expect.objectContaining({
            env: expect.objectContaining({ PLAYWRIGHT_VERBOSE: verbose ? '1' : undefined }),
            verbosity: RunVerbosity.Output,
        }));
    });

    it.each([RunVerbosity.Command, RunVerbosity.Quiet])('preserves migration failure output in reduced-output mode %s', async (verbosity) => {
        vi.mocked(isPortListening).mockResolvedValue(true);
        vi.mocked(run).mockResolvedValueOnce({ stdout: '[Migration] Running broken.sql\n', stderr: 'Invalid SQL', status: 1 } as any);

        await expect(testE2e({ ...context, verbose: false, verbosity }, { ci: false, clear: false, ui: false, skipBuild: true, localDb: true }))
            .rejects.toThrow('[Migration] Running broken.sql\nInvalid SQL');

        expect(CaddyService.reload).toHaveBeenCalledWith(expect.objectContaining({ verbosity }));
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
            'errors',
            'encoding',
            'common-networking',
            'database',
            'metabase',
            'filters',
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

    it('forwards unit sharding', async () => {
        await runUnitTests(context, {
            packages: [{ name: 'utility', path: 'shared/utility', needsDatabase: false }],
            skipBuild: true,
            shard: '2/2',
        });

        expect(run).toHaveBeenCalledExactlyOnceWith('pnpm', [
            'exec', 'vitest', 'run', '--shard', '2/2',
        ], expect.objectContaining({ cwd: '/repo/shared/utility' }));
    });

    it('forwards JSON reporting while retaining console output', async () => {
        await runUnitTests(context, {
            packages: [{ name: 'utility', path: 'shared/utility', needsDatabase: false }],
            skipBuild: true,
            jsonReport: '/reports/api.json',
        });

        expect(run).toHaveBeenCalledExactlyOnceWith('pnpm', [
            'exec', 'vitest', 'run', '--reporter=default', '--reporter=json', '--outputFile=/reports/api.json',
        ], expect.objectContaining({ cwd: '/repo/shared/utility' }));
    });

    it('rejects a shared JSON report path for multiple packages before building or starting services', async () => {
        await expect(runUnitTests(context, {
            packages: [
                { name: 'utility', path: 'shared/utility', needsDatabase: false },
                { name: 'queues', path: 'backend/shared/queues', needsDatabase: false },
            ],
            jsonReport: '/reports/api.json',
        })).rejects.toThrow('--json-report requires a single package');

        expect(run).not.toHaveBeenCalled();
    });

    it('runs unit tests without typechecking', async () => {
        const pkg = unitTestPackages.find(pkg => pkg.name === 'structures')!;
        await runUnitTests(context, { packages: [pkg], skipBuild: true });
        expect(run).toHaveBeenCalledExactlyOnceWith('pnpm', ['exec', 'vitest', 'run'], expect.anything());
    });

    it.each([
        ['lint', lint],
        ['typecheck', typecheck],
    ] as const)('uses the root %s command and propagates failures', async (script, check) => {
        vi.mocked(run).mockRejectedValueOnce(new Error('Check failed'));

        await expect(check(context)).rejects.toThrow('Check failed');
        expect(run).toHaveBeenCalledExactlyOnceWith('pnpm', ['run', script], { cwd: '/repo', verbosity: RunVerbosity.Output });
    });

    it.each([
        ['lint', lint],
        ['typecheck', typecheck],
    ] as const)('forwards %s selectors to Turbo without changing check prerequisites', async (script, check) => {
        await check(context, ['@stamhoofd/mobile', './backend/shared/*']);

        expect(run).toHaveBeenCalledExactlyOnceWith('pnpm', [
            'run', script, '--filter=@stamhoofd/mobile', '--filter=./backend/shared/*',
        ], { cwd: '/repo', verbosity: RunVerbosity.Output });
    });

    it('only publishes readiness after a successful build and keeps watching after errors', () => {
        const readyFile = sharedBuildReadyCommand().split(' ')[1];
        const watch = sharedBuildWatchCommand();

        expect(watch).toContain(`rm -f ${readyFile}`);
        expect(watch).toContain(`--exec 'pnpm run build:shared && touch ${readyFile} || exit 0'`);
        expect(watch).toContain('--signal SIGTERM');
        expect(watch).toContain('--watch shared --watch backend/shared');
        expect(watch).toContain('--watch packages/common/errors');
        expect(watch).toContain('--watch turbo.jsonc');
        expect(watch).toContain("--ignore './shared/*/dist/' --ignore './backend/shared/*/dist/'");
        expect(watch).toContain("--ignore './packages/common/*/dist/' --ignore './packages/common/*/dist-types/'");
    });
});
