import { BaseCommand } from '../../base-command.js';
import { buildDomains } from '../../config/build-config.js';
import { metabaseService } from '../../services/definitions/metabase-service.js';
import { link, step, warning } from '../../runtime/ux.js';

export default class MetabaseReport extends BaseCommand {
    static summary = 'Recreate the ledenstatistieken dashboards in the local Metabase';
    static description = 'Writes the questions and dashboards defined in backend/shared/statistics/report to Metabase, pointed at the platform statistics database of the selected environment. Safe to run again: everything is matched by name and updated in place, so edits made in Metabase to a card the report owns are overwritten while anything else is left alone.';
    static examples = [
        'stam metabase report',
        'stam metabase report --env keeo',
    ];

    static flags = BaseCommand.instanceFlags;

    async run(): Promise<void> {
        const { flags } = await this.parse(MetabaseReport);
        const context = await this.createContext(flags);

        const result = await step('Writing the report to Metabase', async () => await metabaseService.provisionReport(context), {
            successMessage: result => `${result.cards} questions in ${result.dashboards.length} dashboards`,
        });

        if (result.tableCount === 0) {
            warning(`${result.database} has no tables yet, so every question will fail until the statistics schema exists.`);
        }

        this.log('');
        this.log(`Dashboards: ${result.dashboards.join(', ')}`);
        const url = `https://${buildDomains(context).metabase}/collection/${result.collectionId}`;
        this.log(`Collection: ${link(url, url)}`);
    }
}
