import { BaseCommand } from '../../base-command.js';
import { runServices } from '../../workflows/start-services.js';

export default class ServicesUp extends BaseCommand {
    static summary = 'Start shared services';
    static description = 'Use this when you want shared infrastructure running before starting an app instance or when debugging a service container on its own.';
    static examples = [
        'stam services up',
        'stam services up --verbose',
    ];

    static flags = BaseCommand.verboseFlags;

    async run(): Promise<void> {
        const { flags } = await this.parse(ServicesUp);
        await runServices(await this.createContext(flags));
    }
}
