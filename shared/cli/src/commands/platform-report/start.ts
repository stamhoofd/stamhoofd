import { BaseCommand } from '../../base-command.js';
import { buildDomains } from '../../config/build-config.js';
import { buildPorts } from '../../context/ports.js';
import { migratePlatformStatistics, runPlatformStatisticsSync } from '../../runtime/monorepo-runner.js';
import { command, info, link, step, warning } from '../../runtime/ux.js';
import { CaddyService } from '../../services/definitions/caddy-service.js';
import { metabaseService } from '../../services/definitions/metabase-service.js';
import { allRunning, startServices } from '../../services/manager.js';
import { buildMetabaseConfigOutput } from '../../services/metabase-config.js';
import { sharedServiceDefinitions } from '../../services/registry.js';

export default class PlatformReportStart extends BaseCommand {
    static summary = 'Start the platform report of an environment and keep it in sync';
    static description = 'Use this to read the ledenstatistieken of an environment locally, or to build and test dashboards before writing them to a real server. It migrates the platform statistics database, starts Metabase with that database as a data source, writes the report, and then syncs the statistics until you stop it with Ctrl+C. Metabase keeps running after that, so the dashboards stay readable. The first start migrates the Metabase application database too, which takes a few minutes.';
    static examples = [
        'stam platform-report start',
        'stam platform-report start --env keeo',
        'stam platform-report start --env ravot',
    ];

    static flags = BaseCommand.instanceFlags;

    async run(): Promise<void> {
        const { flags } = await this.parse(PlatformReportStart);
        const context = await this.createContext(flags);

        if (!(await allRunning(context, sharedServiceDefinitions))) {
            await startServices(context, sharedServiceDefinitions);
        }
        await CaddyService.reload(context);
        await migratePlatformStatistics(context);
        await step('Starting Metabase', async () => await metabaseService.start(context, undefined), { successMessage: result => result.message });
        const provisioned = await step(`Configuring ${context.env} platform statistics`, async () => await metabaseService.provision(context), {
            successMessage: result => result.created ? `Added data source ${result.dataSource}` : `Data source ${result.dataSource} already configured`,
        });
        const report = await step(`Writing the ${context.env} report to Metabase`, async () => await metabaseService.provisionReport(context), {
            successMessage: result => `${result.cards} questions across ${result.dashboards.reduce((total, dashboard) => total + dashboard.tabs.length, 0)} tabs`,
        });

        if (provisioned.tableCount === 0) {
            warning(`${provisioned.database} has no tables, so every question will fail. The migrations above should have created them: check their output.`);
        }

        if (report.mapsWithoutCoordinates.length > 0) {
            warning(`Drawn as a bar chart instead of a map: ${report.mapsWithoutCoordinates.join(', ')}. A map needs a coordinate per postal code, and ${command('postal_codes')} in ${report.database} is still empty.`);
        }

        this.log('');
        this.log(`Collection:  ${report.collection}`);

        for (const dashboard of report.dashboards) {
            const url = `https://${buildDomains(context).metabase}/dashboard/${dashboard.id}`;
            this.log('');
            this.log(`${dashboard.name} (pinned)`);
            this.log(`Tabs:      ${dashboard.tabs.join(', ')}`);
            this.log(`Dashboard: ${link(url, url)}`);
        }

        this.log('');
        this.log(buildMetabaseConfigOutput(buildDomains(context), {
            name: provisioned.dataSource,
            database: provisioned.database,
            mysqlPort: buildPorts(context).mysql,
        }));
        this.log('');

        info(`Syncing the ${context.env} platform statistics. Press Ctrl+C to stop the sync; Metabase keeps running.`);
        await runPlatformStatisticsSync(context);
        info(`Sync stopped. Metabase is still running: ${command('stam platform-report stop')}`);
    }
}
