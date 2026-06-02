import { Args } from '@oclif/core';
import { BaseCommand } from '../../base-command.js';
import { dryRunFlag, yesFlag } from '../../command-flags.js';
import { runSetup, setupCert, setupDns } from '../../workflows/setup-machine.js';

const setupActions = ['cert', 'dns'] as const;

export default class Setup extends BaseCommand {
    static summary = 'Prepare this machine for local development';
    static description = 'Use this first on a new machine, or when DNS, certificates, or container runtime access for local development stopped working.';
    static examples = [
        'stam setup',
        'stam setup dns --dry-run',
        'stam setup cert --yes --verbose',
    ];

    static args = {
        action: Args.string({
            description: 'Setup action to run directly',
            options: [...setupActions],
            required: false,
        }),
    };

    static flags = { ...BaseCommand.verboseFlags, yes: yesFlag, 'dry-run': dryRunFlag };

    async run(): Promise<void> {
        const { args, flags } = await this.parse(Setup);
        const context = await this.createContext(flags);

        if (args.action === 'dns') {
            await setupDns({ yes: flags.yes, dryRun: flags['dry-run'], verbose: flags.verbose });
            return;
        }

        if (args.action === 'cert') {
            await setupCert(context, { yes: flags.yes, dryRun: flags['dry-run'] });
            return;
        }

        await runSetup(context);
    }
}
