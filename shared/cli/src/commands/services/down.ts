import { BaseCommand } from '../../base-command.js';
import { stopSharedServicesInteractive } from '../../services/shared-services.js';

export default class ServicesDown extends BaseCommand {
    static summary = 'Stop shared services';
    static description = 'Use this when you want to free ports, shut down shared infrastructure, or reset service containers before starting again.';
    static examples = [
        'stam services down',
        'stam services stop --verbose',
    ];

    static flags = BaseCommand.verboseFlags;

    async run(): Promise<void> {
        const { flags } = await this.parse(ServicesDown);
        await stopSharedServicesInteractive(await this.createContext(flags));
        this.log('Shared services stopped.');
    }
}
