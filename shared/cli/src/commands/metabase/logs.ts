import { BaseCommand } from '../../base-command.js';
import { metabaseService } from '../../services/definitions/metabase-service.js';

export default class MetabaseLogs extends BaseCommand {
    static summary = 'Tail local Metabase server logs';
    static description = 'Use this while debugging a failing start, application database migrations, or a data source that will not connect.';
    static examples = [
        'stam metabase logs',
        'stam metabase logs --env keeo',
    ];

    static flags = BaseCommand.instanceFlags;

    async run(): Promise<void> {
        const { flags } = await this.parse(MetabaseLogs);
        const context = await this.createContext(flags);
        await metabaseService.logs?.(context);
    }
}
