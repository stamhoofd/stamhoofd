import { BaseCommand } from '../../base-command.js';
import { restartSharedServicesInteractive } from '../../services/shared-services.js';
import { success } from '../../runtime/ux.js';

export default class ServicesRestart extends BaseCommand {
    static summary = 'Restart shared services';
    static description = 'Use this when MySQL, Caddy, MailDev, RustFS, or another shared service gets into a bad state and needs a clean restart.';
    static examples = [
        'stam services restart',
        'stam services restart --verbose',
    ];
    static flags = BaseCommand.verboseFlags;

    async run(): Promise<void> {
        const { flags } = await this.parse(ServicesRestart);
        await restartSharedServicesInteractive(await this.createContext(flags));
        success('Shared services restarted.');
    }
}
