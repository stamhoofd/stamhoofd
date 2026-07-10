import fs from 'node:fs/promises';
import path from 'node:path';
import { caddyRootCaPath, localIpv4Host, localhostPortMappingDynamic, mysqlImage, mysqlInternalPort, mysqlRootPassword, mysqlRootUser, mysqlServerArgs } from '../config/shared-service-config.js';
import type { CliContext } from '../context/create-context.js';
import { buildBackendEnv } from '../config/build-config.js';
import { CaddyService } from '../services/definitions/caddy-service.js';
import * as docker from '../services/docker.js';
import { startSharedServices } from '../services/shared-services.js';
import { run } from './command-runner.js';

const globalSharedPackages = [
    'shared/types',
    'shared/test-utils',
    'shared/utility',
    'shared/cli',
    'shared/excel-writer',
    'shared/structures',
    'shared/object-differ',
    'shared/locales',
];

const backendSharedPackages = [
    'backend/shared/queues',
    'backend/shared/env',
    'backend/shared/i18n',
    'backend/shared/sql',
    'backend/shared/email',
    'backend/shared/models',
    'backend/shared/logging',
    'backend/shared/crons',
    'backend/shared/middleware',
];

// Namespace the test MySQL containers + data volumes by instance so each git worktree gets its own
// and tests can run in parallel across worktrees. The primary worktree keeps the historical
// `stamhoofd-*` names (its instance name is `stamhoofd`). The data volume persists between runs (so
// initialized data + applied migrations are reused); the container itself is shut down after the run
// and `--clear` wipes the volume for a fresh start.
function testMysqlNames(context: CliContext): { container: string; volume: string } {
    return {
        container: `${context.instance.name}-test-mysql`,
        volume: `${context.instance.name}-test-mysql-data`,
    };
}

function e2eMysqlNames(context: CliContext): { container: string; volume: string } {
    return {
        container: `${context.instance.name}-e2e-mysql`,
        volume: `${context.instance.name}-e2e-mysql-data`,
    };
}

export type UnitTestPackage = {
    /** Short name used on the command line, e.g. `stam test api`. Matches the package folder name. */
    name: string;
    /** Path to the package relative to the repo root. */
    path: string;
    /** Whether the package's tests connect to MySQL (checked via its vitest setup files). */
    needsDatabase: boolean;
};

// The unit-test packages that `stam test unit` runs. To add a package: give it a `test` script that
// runs vitest, then add it here with the correct `needsDatabase` (true if its vitest setup/tests
// query `Database` from @simonbackx/simple-database).
export const unitTestPackages: UnitTestPackage[] = [
    { name: 'structures', path: 'shared/structures', needsDatabase: false },
    { name: 'object-differ', path: 'shared/object-differ', needsDatabase: false },
    { name: 'vite-config', path: 'frontend/shared/vite-config', needsDatabase: false },
    { name: 'sgv', path: 'shared/sgv', needsDatabase: false },
    { name: 'eslint', path: 'shared/eslint', needsDatabase: false },
    { name: 'utility', path: 'shared/utility', needsDatabase: false },
    { name: 'queues', path: 'backend/shared/queues', needsDatabase: false },
    { name: 'models', path: 'backend/shared/models', needsDatabase: true },
    { name: 'sql', path: 'backend/shared/sql', needsDatabase: true },
    { name: 'renderer', path: 'backend/app/renderer', needsDatabase: false },
    { name: 'redirecter', path: 'backend/app/redirecter', needsDatabase: false },
    { name: 'api', path: 'backend/app/api', needsDatabase: true },
];
const sharedBuildReadyFile = `.development/cli/generated/shared-build-${process.pid}.ready`;

export async function buildShared(context: CliContext): Promise<void> {
    console.log('\x1B[35m[BUILD]\x1B[0m Building globally shared dependencies...');
    for (const packagePath of globalSharedPackages) {
        await run('yarn', ['--cwd', packagePath, '-s', 'build'], { cwd: context.rootDir, verbose: context.verbose });
    }
    console.log('\x1B[35m[BUILD]\x1B[0m Building shared backend dependencies...');
    for (const packagePath of backendSharedPackages) {
        await run('yarn', ['--cwd', packagePath, '-s', 'build'], { cwd: context.rootDir, verbose: context.verbose });
    }
    console.log('\x1B[35m[BUILD]\x1B[0m Done building shared dependencies.');
}

export async function buildAll(context: CliContext): Promise<void> {
    await buildShared(context);
    await run('yarn', ['-s', 'lerna', 'run', 'dev:build'], { cwd: context.rootDir, env: { NX_DAEMON: 'false', STAMHOOFD_ENV: context.env }, verbose: context.verbose });
}

export async function lint(context: CliContext): Promise<void> {
    await run('yarn', ['-s', 'lerna', 'run', 'lint', '--', '--', '--quiet'], { cwd: context.rootDir, env: { NX_DAEMON: 'false' }, verbose: context.verbose });
}

export async function typecheck(context: CliContext): Promise<void> {
    await run('yarn', ['-s', 'lerna', 'run', 'typecheck'], { cwd: context.rootDir, env: { NX_DAEMON: 'false' }, verbose: context.verbose });
}

export async function migrate(context: CliContext): Promise<void> {
    await buildShared(context);
    await run('yarn', ['-s', 'lerna', 'run', 'migrations', '--concurrency', '1'], { cwd: context.rootDir, env: { ...buildBackendEnv(context) }, verbose: context.verbose });
}

export type UnitTestOptions = {
    /** Packages to run. Defaults to every unit-test package. */
    packages?: UnitTestPackage[];
    /** Vitest filename filters (substring match on the test file path). */
    fileFilters?: string[];
    /** Vitest `-t` test-name pattern. */
    testNamePattern?: string;
    ci?: boolean;
    /** Skip the automatic `build:shared` step. */
    skipBuild?: boolean;
    /** Drop the persistent test database volume before running (fresh start). */
    clear?: boolean;
};

export async function runUnitTests(context: CliContext, options: UnitTestOptions = {}): Promise<void> {
    const packages = options.packages ?? unitTestPackages;
    if (packages.length === 0) {
        throw new Error('No test packages selected.');
    }

    if (!options.skipBuild) {
        await buildShared(context);
    }

    const needsDatabase = packages.some(pkg => pkg.needsDatabase);
    const dbPort = needsDatabase ? await startTestMysql(context, options.clear ?? false) : undefined;

    // With multiple packages a filename/test-name filter will legitimately match nothing in some of
    // them, so don't let an empty package fail the whole run.
    const passWithNoTests = packages.length > 1;

    try {
        for (const pkg of packages) {
            const args = ['vitest', 'run'];
            if (passWithNoTests) {
                args.push('--passWithNoTests');
            }
            if (options.testNamePattern) {
                args.push('-t', options.testNamePattern);
            }
            args.push(...(options.fileFilters ?? []));
            await run('yarn', args, { cwd: path.join(context.rootDir, pkg.path), env: { NX_DAEMON: 'false', CI: options.ci ? 'true' : undefined, DB_PORT: dbPort }, verbose: context.verbose });
        }
    }
    finally {
        // Shut down the container after the run; the data volume is kept for the next run.
        if (needsDatabase) {
            await docker.removeContainer(testMysqlNames(context).container, context.verbose);
        }
    }
}

export async function testUnit(context: CliContext, ci: boolean): Promise<void> {
    await runUnitTests(context, { ci });
}

export async function testE2e(context: CliContext, options: { ci: boolean; clear: boolean; extra?: boolean; ui: boolean; workers?: number; grep?: string; skipBuild?: boolean }): Promise<void> {
    const dbPort = await startE2eMysql(context, options.clear);
    const { container: e2eContainer } = e2eMysqlNames(context);
    let shouldRestoreCaddy = false;
    if (!options.skipBuild) {
        await buildShared(context);
    }
    try {
        await startSharedServices(context);
        shouldRestoreCaddy = true;
        if (!options.skipBuild) {
            await run('yarn', ['--cwd', 'backend/app/api', '-s', 'build:playwright:pre'], { cwd: context.rootDir, env: { DB_PORT: dbPort }, verbose: context.verbose });
        }
        await run('yarn', ['--cwd', 'tests/playwright', '-s', 'test', ...(options.ui ? ['--ui'] : []), ...(options.grep === undefined ? [] : ['--grep', options.grep]), ...(options.workers === undefined ? [] : ['--workers', String(options.workers)])], { cwd: context.rootDir, env: { NX_DAEMON: 'false', CI: options.ci ? 'true' : undefined, DB_PORT: dbPort, NODE_EXTRA_CA_CERTS: caddyRootCaPath(), PLAYWRIGHT_INCLUDE_EXTRA: options.extra ? '1' : undefined, PLAYWRIGHT_WORKER_COUNT: options.workers === undefined ? undefined : String(options.workers), STAMHOOFD_SKIP_FRONTEND_BUILD: options.skipBuild ? 'true' : undefined }, verbose: context.verbose });
    }
    finally {
        // Shut down the e2e MySQL container after the run; the data volume is kept for the next run.
        await docker.removeContainer(e2eContainer, context.verbose);
        if (shouldRestoreCaddy) {
            try {
                await CaddyService.reload(context);
            }
            catch (error) {
                console.warn(`Failed to restore shared Caddy config: ${error instanceof Error ? error.message : String(error)}`);
            }
        }
    }
}

export async function cleanBuild(context: CliContext, options: { dryRun?: boolean } = {}): Promise<void> {
    const roots = [
        'tests',
        'shared',
        'frontend/app',
        'backend/shared',
        'backend/app',
    ];

    if (options.dryRun) {
        console.log('Would remove dist, dist-playwright, and *.tsbuildinfo from:');
        roots.forEach(root => console.log(`  ${root}/*`));
        return;
    }

    for (const root of roots) {
        await cleanPackageChildren(path.join(context.rootDir, root));
    }
}

export function sharedBuildWatchCommand(): string {
    const command = [...globalSharedPackages, ...backendSharedPackages]
        .map(packagePath => `yarn --cwd ${packagePath} -s build`)
        .join(' && ');
    return `mkdir -p .development/cli/generated && rm -f ${sharedBuildReadyFile} && yarn -s nodemon --quiet --signal SIGTERM --watch shared --watch backend/shared --ignore './shared/*/dist/' --ignore './backend/shared/*/dist/' --ext .ts,.json,.sql,.mjs --exec '${command} && touch ${sharedBuildReadyFile} || exit 0'`;
}

export function sharedBuildReadyCommand(): string {
    return `wait-on ${sharedBuildReadyFile} shared/cli/dist/index.js shared/locales/dist/index.d.ts`;
}

async function cleanPackageChildren(root: string): Promise<void> {
    let entries: string[];
    try {
        entries = await fs.readdir(root);
    }
    catch {
        return;
    }

    await Promise.all(entries.map(async (entry) => {
        const packagePath = path.join(root, entry);
        const stat = await fs.stat(packagePath).catch(() => undefined);
        if (!stat?.isDirectory()) {
            return;
        }
        await fs.rm(path.join(packagePath, 'dist'), { recursive: true, force: true });
        await fs.rm(path.join(packagePath, 'dist-playwright'), { recursive: true, force: true });
        await removeTsBuildInfo(packagePath);
    }));
}

async function removeTsBuildInfo(packagePath: string): Promise<void> {
    const entries = await fs.readdir(packagePath).catch(() => []);
    await Promise.all(entries
        .filter(entry => entry.endsWith('.tsbuildinfo'))
        .map(entry => fs.rm(path.join(packagePath, entry), { force: true })));
}

// Ensure a MySQL container is running off a persistent named volume (reused across runs so the data
// dir + migrations don't have to be reinitialized), create the `stamhoofd-tests` database, and
// return the mapped host port. `clear` first drops the container + volume for a fresh start.
async function ensureTestMysql(context: CliContext, names: { container: string; volume: string }, clear: boolean): Promise<string> {
    const { container, volume } = names;
    if (clear) {
        await docker.removeContainer(container, context.verbose);
        await docker.removeVolume(volume, context.verbose);
    }

    if (!await docker.containerIsRunning(container)) {
        await docker.removeContainer(container, context.verbose);
        await docker.createVolume(volume, context.verbose);
        await docker.run(['run', '-d', '--name', container, '-e', `MYSQL_ROOT_PASSWORD=${mysqlRootPassword}`, '-p', localhostPortMappingDynamic(mysqlInternalPort), '-v', `${volume}:/var/lib/mysql`, mysqlImage, ...mysqlServerArgs()], { quiet: true, verbose: context.verbose });
    }

    await docker.waitForMysql(container);
    await docker.run(['exec', container, 'mysql', `-h${localIpv4Host}`, `-u${mysqlRootUser}`, `-p${mysqlRootPassword}`, '-e', 'CREATE DATABASE IF NOT EXISTS `stamhoofd-tests` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;'], { quiet: true, verbose: context.verbose });

    const port = await docker.run(['port', container, '3306/tcp'], { capture: true, verbose: context.verbose });
    const dbPort = port.stdout.trim().split(':').at(-1);
    if (!dbPort) {
        throw new Error(`Could not determine test MySQL port for ${container}.`);
    }
    return dbPort;
}

async function startTestMysql(context: CliContext, clear: boolean): Promise<string> {
    const names = testMysqlNames(context);
    console.log(clear ? `Starting fresh test MySQL (${names.container})...` : `Starting test MySQL (${names.container})...`);
    const dbPort = await ensureTestMysql(context, names, clear);
    console.log(`Test MySQL is mapped to ${localIpv4Host}:${dbPort}.`);
    return dbPort;
}

async function startE2eMysql(context: CliContext, clear: boolean): Promise<string> {
    const names = e2eMysqlNames(context);
    console.log(clear ? `Starting fresh e2e MySQL (${names.container})...` : `Starting e2e MySQL (${names.container})...`);
    const dbPort = await ensureTestMysql(context, names, clear);
    console.log(`E2E MySQL is mapped to ${localIpv4Host}:${dbPort}.`);
    return dbPort;
}
