import { BaseCommand } from '../../base-command.js';
import { buildDomains } from '../../config/build-config.js';
import { metabaseService } from '../../services/definitions/metabase-service.js';
import { metabaseAdminEmail } from '../../services/metabase-config.js';
import { command, link, step, warning } from '../../runtime/ux.js';

export default class MetabaseReport extends BaseCommand {
    static summary = 'Recreate the ledenstatistieken dashboards in the local Metabase';
    static description = 'Writes the questions and dashboards defined in shared/metabase/report to Metabase, pointed at the platform statistics database of the selected environment. Safe to run again: everything is matched by name and updated in place, so edits made in Metabase to a card the report owns are overwritten while anything else is left alone.';
    static examples = [
        'stam metabase report',
        'stam metabase report --env keeo',
    ];

    static flags = BaseCommand.instanceFlags;

    async run(): Promise<void> {
        const { flags } = await this.parse(MetabaseReport);
        const context = await this.createContext(flags);

        const result = await step(`Writing the ${context.env} report to Metabase`, async () => await metabaseService.provisionReport(context), {
            successMessage: result => `${result.cards} questions across ${result.tabs.length} tabs`,
        });

        if (result.tableCount === 0) {
            warning(`${result.database} has no tables yet, so every question will fail until the statistics schema exists.`);
        }

        if (result.mapsWithoutCoordinates.length > 0) {
            warning(`Drawn as a bar chart instead of a map: ${result.mapsWithoutCoordinates.join(', ')}. A map needs a coordinate per postal code, and ${command('postal_codes')} in ${result.database} is still empty. Run ${command(`stam db migrate --env ${context.env}`)} to load them, then run this again.`);
        }

        this.log('');
        this.log(`Environment: ${context.env}`);
        this.log(`Data source: ${result.dataSource} (${result.database})`);
        this.log(`Tabs:        ${result.tabs.join(', ')}`);
        this.log(`Collection:  ${result.collection} (pinned)`);
        const url = `https://${buildDomains(context).metabase}/dashboard/${result.dashboardId}`;
        this.log(`Dashboard:   ${link(url, url)}`);

        if (result.bookmarked) {
            this.log('');
            this.log(`Bookmarked for ${metabaseAdminEmail}. A bookmark is per account, so anyone else has to add their own.`);
        }
    }
}
