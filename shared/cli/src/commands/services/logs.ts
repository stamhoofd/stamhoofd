import { BaseCommand } from '../../base-command.js';
import { tailSharedLogs } from '../../services/shared-services.js';
import { RunVerbosity } from '../../runtime/command-runner.js';

export default class ServicesLogs extends BaseCommand {
    static override verbosity = RunVerbosity.Output;
    static summary = 'Tail shared service logs';
    static description = 'Use this when MySQL, Caddy, MailDev, RustFS, or another shared service is failing and you want to inspect container output.';
    static examples = [
        'stam services logs',
        'stam services logs --quiet',
    ];

    static flags = this.verbosityFlags();

    async run(): Promise<void> {
        const { context } = await this.parseWithContext(ServicesLogs);
        await tailSharedLogs(context.verbosity);
    }
}
