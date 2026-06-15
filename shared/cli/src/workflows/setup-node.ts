import fs from 'node:fs/promises';
import path from 'node:path';
import { run } from '../runtime/command-runner.js';
import { CliStatus } from '../runtime/status.js';
import { command, info, statusCell, table, warning } from '../runtime/ux.js';
import chalk from 'chalk';

export type NodeVersionCheck = {
    ok: boolean;
    current: string;
    expected: string;
    details: string;
};

export async function checkNodeVersion(rootDir: string): Promise<NodeVersionCheck> {
    const configured = (await fs.readFile(path.join(rootDir, '.nvmrc'), 'utf8')).trim();
    const expected = configured.startsWith('v') ? configured : `v${configured}`;
    const current = process.version;
    const ok = current === expected;

    return {
        ok,
        current,
        expected,
        details: ok
            ? `${current} matches .nvmrc`
            : `Expected Node ${expected}, got ${current}`,
    };
}

export function nodeInstallCommand(rootDir: string, currentDir: string = process.cwd()): string {
    const scriptPath = path.relative(currentDir, path.join(rootDir, '.development/install-node.sh'));
    return `source ${JSON.stringify(scriptPath)}`;
}

export async function setupNodeVersion(rootDir: string, options: { verbose: boolean; dryRun?: boolean }): Promise<void> {
    if (options.dryRun) {
        console.log(command(nodeInstallCommand(rootDir)));
        return;
    }

    const scriptPath = path.join(rootDir, '.development/install-node.sh');
    await run('bash', ['-c', '. "$1"', 'stam-install-node', scriptPath], {
        cwd: rootDir,
        verbose: options.verbose,
    });

    info('');
    warning(chalk.yellow('ACTION REQUIRED: this terminal is still using the old Node.js version.'));
    info('');
    info('Restart your terminal before continuing, or activate the new version now:');
    info(`  ${command(nodeInstallCommand(rootDir))}`);
    info('');
}

export function printNodeVersionStatus(check: NodeVersionCheck): void {
    table(
        ['Check', 'Status', 'Details'],
        [[
            'Node.js',
            statusCell(check.ok ? CliStatus.Ready : CliStatus.Failed),
            check.ok ? check.details : `${check.details} (run "stam setup node")`,
        ]],
        { title: 'Development runtime' },
    );
}
