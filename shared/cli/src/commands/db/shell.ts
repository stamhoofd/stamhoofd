import { BaseCommand } from '../../base-command.js';
import { currentDatabase, ensureMysqlRunning, openDatabaseShell } from '../../runtime/database-command-helpers.js';

export default class DbShell extends BaseCommand {
    static summary = 'Open a MySQL shell for the selected database';
    static description = 'Use this to inspect tables, run manual queries, or quickly debug the local database for the selected environment and instance.';
    static examples = [
        'stam db shell --env keeo',
        'stam db shell --name feature-payments',
    ];
    static flags = BaseCommand.instanceFlags;

    async run(): Promise<void> {
        const { context } = await this.parseWithContext(DbShell);
        await ensureMysqlRunning(context);
        await openDatabaseShell(currentDatabase(context));
    }
}
