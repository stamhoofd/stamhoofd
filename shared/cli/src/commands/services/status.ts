import { BaseCommand } from '../../base-command.js';
import { printSharedServicesStatus } from '../../services/shared-services.js';

export default class ServicesStatus extends BaseCommand {
    static summary = 'Show shared service status';
    static description = 'Use this when local development is failing and you want a quick overview of which shared services are running and how to access them.';
    static examples = [
        'stam services status',
        'stam services status --verbose',
    ];
    static flags = BaseCommand.verboseFlags;

    async run(): Promise<void> {
        const { flags } = await this.parse(ServicesStatus);
        await printSharedServicesStatus(await this.createContext(flags));
    }
}
