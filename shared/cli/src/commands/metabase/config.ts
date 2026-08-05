import { BaseCommand } from '../../base-command.js';
import { buildDatabases, buildDomains } from '../../config/build-config.js';
import { buildPorts } from '../../context/ports.js';
import { buildMetabaseConfigOutput, metabaseDataSourceName } from '../../services/metabase-config.js';

export default class MetabaseConfig extends BaseCommand {
    static summary = 'Print local Metabase URL, login and data source settings';
    static description = 'Use this to look up the Metabase login of an environment, or the connection details of its platform statistics database when adding or repairing the data source by hand.';
    static examples = [
        'stam metabase config',
        'stam metabase config --env keeo',
    ];

    static flags = BaseCommand.instanceFlags;

    async run(): Promise<void> {
        const { flags } = await this.parse(MetabaseConfig);
        const context = await this.createContext(flags);
        this.log(buildMetabaseConfigOutput(buildDomains(context), {
            name: metabaseDataSourceName(context.env),
            database: buildDatabases(context).platformStatistics,
            mysqlPort: buildPorts(context).mysql,
        }));
    }
}
