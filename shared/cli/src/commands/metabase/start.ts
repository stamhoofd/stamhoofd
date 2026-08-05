import { BaseCommand } from '../../base-command.js';
import { buildDomains } from '../../config/build-config.js';
import { buildPorts } from '../../context/ports.js';
import { CaddyService } from '../../services/definitions/caddy-service.js';
import { metabaseService } from '../../services/definitions/metabase-service.js';
import { allRunning, startServices } from '../../services/manager.js';
import { buildMetabaseConfigOutput } from '../../services/metabase-config.js';
import { sharedServiceDefinitions } from '../../services/registry.js';
import { step } from '../../runtime/ux.js';

export default class MetabaseStart extends BaseCommand {
    static summary = 'Start the local Metabase server';
    static description = 'Use this to explore the platform statistics of an environment in Metabase, or to build and test dashboards before recreating them on a real server. The platform statistics database of the selected environment is registered as a data source automatically. The first start migrates the Metabase application database, which takes a few minutes.';
    static examples = [
        'stam metabase start',
        'stam metabase start --env keeo',
        'stam metabase start --env ravot',
    ];

    static flags = BaseCommand.instanceFlags;

    async run(): Promise<void> {
        const { flags } = await this.parse(MetabaseStart);
        const context = await this.createContext(flags);

        if (!(await allRunning(context, sharedServiceDefinitions))) {
            await startServices(context, sharedServiceDefinitions);
        }
        await CaddyService.reload(context);
        await step('Starting Metabase', async () => await metabaseService.start(context, undefined), { successMessage: result => result.message });
        const provisioned = await step(`Configuring ${context.env} platform statistics`, async () => await metabaseService.provision(context), {
            successMessage: result => result.created ? `Added data source ${result.dataSource}` : `Data source ${result.dataSource} already configured`,
        });

        this.log('');
        this.log(buildMetabaseConfigOutput(buildDomains(context), {
            name: provisioned.dataSource,
            database: provisioned.database,
            mysqlPort: buildPorts(context).mysql,
        }));
    }
}
