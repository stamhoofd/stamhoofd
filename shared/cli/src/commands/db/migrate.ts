import { BaseCommand } from '../../base-command.js';
import { migrate } from '../../runtime/monorepo-runner.js';

export default class DbMigrate extends BaseCommand {
    static summary = 'Run migrations for the selected database';
    static description = 'Use this after schema changes or when you need to bring the local database for the selected environment and instance up to date.';
    static examples = [
        'stam db migrate --env keeo',
        'stam db migrate --name feature-payments',
    ];
    static flags = BaseCommand.instanceFlags;

    async run(): Promise<void> {
        const { flags } = await this.parse(DbMigrate);
        await migrate(await this.createContext(flags));
    }
}
