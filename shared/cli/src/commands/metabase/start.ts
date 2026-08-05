import { BaseCommand } from '../../base-command.js';
import { buildBackendEnv, buildDomains } from '../../config/build-config.js';
import { buildPorts } from '../../context/ports.js';
import { CaddyService } from '../../services/definitions/caddy-service.js';
import { metabaseService } from '../../services/definitions/metabase-service.js';
import { allRunning, startServices } from '../../services/manager.js';
import { buildMetabaseConfigOutput } from '../../services/metabase-config.js';
import { sharedServiceDefinitions } from '../../services/registry.js';
import { step } from '../../runtime/ux.js';

export default class MetabaseStart extends BaseCommand {
    static summary = 'Start the local Metabase server';
    static description = 'Use this to explore the development database in Metabase, or to build and test questions and dashboards before recreating them on a real server. The first start migrates the Metabase application database, which takes a few minutes.';
    static examples = [
        'stam metabase start',
        'stam metabase start --env keeo',
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

        this.log('');
        this.log(buildMetabaseConfigOutput(buildDomains(context), {
            database: buildBackendEnv(context).DB_DATABASE ?? '',
            mysqlPort: buildPorts(context).mysql,
        }));
    }
}
