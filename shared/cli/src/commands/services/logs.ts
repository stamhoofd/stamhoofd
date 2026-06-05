import { BaseCommand } from '../../base-command.js';
import { tailSharedLogs } from '../../services/shared-services.js';

export default class ServicesLogs extends BaseCommand {
    static summary = 'Tail shared service logs';
    static description = 'Use this when MySQL, Caddy, MailDev, RustFS, or another shared service is failing and you want to inspect container output.';
    static examples = [
        'stam services logs',
        'stam services logs --verbose',
    ];

    static flags = BaseCommand.verboseFlags;

    async run(): Promise<void> {
        await tailSharedLogs();
    }
}
