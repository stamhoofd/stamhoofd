import path from 'node:path';
import { Args } from '@oclif/core';
import { BaseCommand } from '../../base-command.js';
import { dryRunFlag, yesFlag } from '../../command-flags.js';
import { getProjectPath } from '../../context/project-path.js';
import { confirm } from '../../runtime/ux.js';
import { runSetup, setupCert, setupDns } from '../../workflows/setup-machine.js';
import { checkNodeVersion, printNodeVersionStatus, setupNodeVersion } from '../../workflows/setup-node.js';
import { setupPackageManager } from '../../workflows/setup-package-manager.js';
import { setupShellShortcut } from '../../workflows/setup-shell.js';

export enum SetupAction {
    Cert = 'cert',
    Dns = 'dns',
    Node = 'node',
    Pnpm = 'pnpm',
    Shell = 'shell',
}

const setupActions = Object.values(SetupAction);

export default class Setup extends BaseCommand {
    static summary = 'Prepare this machine for local development';
    static description = 'Use this first on a new machine, or when DNS, certificates, or container runtime access for local development stopped working.';
    static examples = [
        'stam setup',
        'stam setup node',
        'stam setup pnpm',
        'stam setup dns --dry-run',
        'stam setup cert --yes --verbose',
        'stam setup shell',
    ];

    static args = {
        action: Args.string({
            description: 'Setup action to run directly',
            options: [...setupActions],
            required: false,
        }),
    };

    static flags = { ...this.verbosityFlags(), 'yes': yesFlag, 'dry-run': dryRunFlag };

    async run(): Promise<void> {
        const parsed = await this.parse(Setup);
        const { args, flags } = parsed;
        const rootDir = path.resolve(getProjectPath());

        if (args.action === SetupAction.Node) {
            await setupNodeVersion(rootDir, { dryRun: flags['dry-run'] });
            return;
        }

        if (args.action === SetupAction.Pnpm) {
            await setupPackageManager(rootDir, { dryRun: flags['dry-run'] });
            return;
        }

        if (!args.action) {
            const nodeCheck = await checkNodeVersion(rootDir);
            if (!nodeCheck.ok) {
                printNodeVersionStatus(nodeCheck);
                if (await confirm(`Install Node.js ${nodeCheck.expected} now?`, { default: true })) {
                    await setupNodeVersion(rootDir);
                }
                return;
            }
        }

        const { context } = await this.parseWithContext(Setup, parsed);

        if (args.action === SetupAction.Dns) {
            await setupDns({ yes: flags.yes, dryRun: flags['dry-run'] });
            return;
        }

        if (args.action === SetupAction.Cert) {
            await setupCert(context, { yes: flags.yes, dryRun: flags['dry-run'] });
            return;
        }

        if (args.action === SetupAction.Shell) {
            await setupShellShortcut({ dryRun: flags['dry-run'] });
            return;
        }

        await runSetup(context);
    }
}
