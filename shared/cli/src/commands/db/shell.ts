import { BaseCommand } from '../../base-command.js';
import { buildBackendEnv } from '../../config/build-config.js';
import { mysqlContainer, mysqlRootPassword, mysqlRootUser } from '../../config/shared-service-config.js';
import * as docker from '../../services/docker.js';

export default class DbShell extends BaseCommand {
    static summary = 'Open a MySQL shell for the selected database';
    static description = 'Use this to inspect tables, run manual queries, or quickly debug the local database for the selected environment and instance.';
    static examples = [
        'stam db shell --env keeo',
        'stam db shell --name feature-payments',
    ];
    static flags = BaseCommand.instanceFlags;

    async run(): Promise<void> {
        const { flags } = await this.parse(DbShell);
        const context = await this.createContext(flags);
        const env = buildBackendEnv(context);
        await docker.run(['exec', '-it', mysqlContainer, 'mysql', `-u${mysqlRootUser}`, `-p${mysqlRootPassword}`, env.DB_DATABASE ?? 'stamhoofd-development']);
    }
}
