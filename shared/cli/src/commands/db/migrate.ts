import { BaseCommand } from '../../base-command.js';
import { ensureMysqlRunning } from '../../runtime/database-command-helpers.js';
import { migrate } from '../../runtime/monorepo-runner.js';
import { RunVerbosity } from '../../runtime/command-runner.js';

export default class DbMigrate extends BaseCommand {
    static override verbosity = RunVerbosity.Output;
    static summary = 'Run migrations for the selected database';
    static description = 'Use this after schema changes or when you need to bring the local database for the selected environment and instance up to date.';
    static examples = [
        'stam db migrate --env keeo',
        'stam db migrate --name feature-payments',
    ];
    static flags = { env: BaseCommand.environmentFlags.env, name: BaseCommand.instanceFlags.name, ...this.verbosityFlags() };

    async run(): Promise<void> {
        const { context } = await this.parseWithContext(DbMigrate);
        await ensureMysqlRunning(context);
        await migrate(context);
    }
}
