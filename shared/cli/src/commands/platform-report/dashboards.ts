import { BaseCommand } from '../../base-command.js';
import { buildDomains } from '../../config/build-config.js';
import { metabaseService } from '../../services/definitions/metabase-service.js';
import { metabaseAdminEmail } from '../../services/metabase-config.js';
import { command, link, step, warning } from '../../runtime/ux.js';

export default class PlatformReportDashboards extends BaseCommand {
    static summary = 'Rewrite the ledenstatistieken dashboards in the local Metabase';
    static description = 'Writes the questions and dashboards defined in shared/metabase/report to Metabase, pointed at the platform statistics database of the selected environment. Use it while working on the report: start already writes them, this rewrites them without restarting anything. Safe to run again: everything is matched by name and updated in place, so edits made in Metabase to a card the report owns are overwritten while anything else is left alone.';
    static examples = [
        'stam platform-report dashboards',
        'stam platform-report dashboards --env keeo',
    ];

    static flags = BaseCommand.instanceFlags;

    async run(): Promise<void> {
        const { flags } = await this.parse(PlatformReportDashboards);
        const context = await this.createContext(flags);

        const result = await step(`Writing the ${context.env} report to Metabase`, async () => await metabaseService.provisionReport(context), {
            successMessage: result => `${result.cards} questions across ${result.dashboards.reduce((total, dashboard) => total + dashboard.tabs.length, 0)} tabs`,
        });

        if (result.tableCount === 0) {
            warning(`${result.database} has no tables yet, so every question will fail until the statistics schema exists. Run ${command(`stam platform-report start --env ${context.env}`)} to create it.`);
        }

        if (result.mapsWithoutCoordinates.length > 0) {
            warning(`Drawn as a bar chart instead of a map: ${result.mapsWithoutCoordinates.join(', ')}. A map needs a coordinate per postal code, and ${command('postal_codes')} in ${result.database} is still empty. Run ${command(`stam platform-report start --env ${context.env}`)} to load them, then run this again.`);
        }

        this.log('');
        this.log(`Environment: ${context.env}`);
        this.log(`Data source: ${result.dataSource} (${result.database})`);
        this.log(`Collection:  ${result.collection}${result.renamedCollection === undefined ? '' : ` (renamed from ${result.renamedCollection})`}`);
        this.log(`Fragments:   ${result.snippets} snippets`);

        for (const dashboard of result.dashboards) {
            const url = `https://${buildDomains(context).metabase}/dashboard/${dashboard.id}`;
            this.log('');
            this.log(`${dashboard.name} (pinned)`);
            this.log(`Tabs:      ${dashboard.tabs.join(', ')}`);
            this.log(`Dashboard: ${link(url, url)}`);
        }

        if (result.dashboards.some(dashboard => dashboard.bookmarked)) {
            this.log('');
            this.log(`Bookmarked for ${metabaseAdminEmail}. A bookmark is per account, so anyone else has to add their own.`);
        }
    }
}
