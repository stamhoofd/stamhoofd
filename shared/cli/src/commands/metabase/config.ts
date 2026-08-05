import { BaseCommand } from '../../base-command.js';
import { buildBackendEnv, buildDomains } from '../../config/build-config.js';
import { buildPorts } from '../../context/ports.js';
import { buildMetabaseConfigOutput } from '../../services/metabase-config.js';

export default class MetabaseConfig extends BaseCommand {
    static summary = 'Print local Metabase URL and data source settings';
    static description = 'Use this to look up the connection details of the development database again when adding or repairing the data source in Metabase.';
    static examples = [
        'stam metabase config',
        'stam metabase config --env keeo',
    ];

    static flags = BaseCommand.instanceFlags;

    async run(): Promise<void> {
        const { flags } = await this.parse(MetabaseConfig);
        const context = await this.createContext(flags);
        this.log(buildMetabaseConfigOutput(buildDomains(context), {
            database: buildBackendEnv(context).DB_DATABASE ?? '',
            mysqlPort: buildPorts(context).mysql,
        }));
    }
}
