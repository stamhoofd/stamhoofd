import fs from 'node:fs/promises';
import path from 'node:path';
import { run, RunVerbosity } from '../runtime/command-runner.js';
import { CliStatus } from '../runtime/status.js';
import { command, statusCell, success, table, warning } from '../runtime/ux.js';

export type PackageManagerCheck = {
    ok: boolean;
    current?: string;
    expected: string;
    details: string;
};

export async function checkPackageManager(rootDir: string, verbosity: RunVerbosity = RunVerbosity.Quiet): Promise<PackageManagerCheck> {
    const packageJson = JSON.parse(await fs.readFile(path.join(rootDir, 'package.json'), 'utf8')) as { packageManager?: unknown };
    const match = typeof packageJson.packageManager === 'string'
        ? /^pnpm@([^+\s]+)(?:\+.+)?$/.exec(packageJson.packageManager)
        : null;
    if (!match) {
        throw new Error('Root package.json must pin pnpm in the packageManager field.');
    }

    const expected = match[1];
    const result = await run('pnpm', ['--version'], { capture: true, allowFailure: true, cwd: rootDir, verbosity });
    if (result.status !== 0) {
        const error = result.stderr.trim();
        return {
            ok: false,
            current: undefined,
            expected,
            details: error.includes('ENOENT')
                ? `pnpm not found; expected ${expected}`
                : `pnpm --version failed; expected ${expected}${error ? `: ${error}` : ''}`,
        };
    }

    const current = result.stdout.trim();
    const ok = current === expected;
    return {
        ok,
        current,
        expected,
        details: ok
            ? `pnpm ${current} matches package.json`
            : `Expected pnpm ${expected}, got ${current}`,
    };
}

export async function setupPackageManager(rootDir: string, options: { dryRun?: boolean } = {}): Promise<void> {
    if (options.dryRun) {
        console.log(command('corepack enable'));
        console.log(command('corepack install'));
        warning('Dry run: pnpm was not changed.');
        return;
    }

    await run('corepack', ['enable'], { cwd: rootDir, verbosity: RunVerbosity.Output });
    await run('corepack', ['install'], { cwd: rootDir, verbosity: RunVerbosity.Output });
    success('pnpm installed through Corepack.');
}

export function printPackageManagerStatus(check: PackageManagerCheck): void {
    table(
        ['Check', 'Status', 'Details'],
        [[
            'pnpm',
            statusCell(check.ok ? CliStatus.Ready : CliStatus.Failed),
            check.ok ? check.details : `${check.details} (run "stam setup pnpm")`,
        ]],
        { title: 'Package manager' },
    );
}
