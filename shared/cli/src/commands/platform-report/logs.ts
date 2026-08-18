import { BaseCommand } from '../../base-command.js';
import { metabaseService } from '../../services/definitions/metabase-service.js';

export default class PlatformReportLogs extends BaseCommand {
    static summary = 'Tail local Metabase server logs';
    static description = 'Use this while debugging a failing start, application database migrations, or a data source that will not connect. The sync logs to the terminal it runs in, so this only tails Metabase.';
    static examples = [
        'stam platform-report logs',
        'stam platform-report logs --env keeo',
    ];

    static flags = BaseCommand.instanceFlags;

    async run(): Promise<void> {
        const { flags } = await this.parse(PlatformReportLogs);
        const context = await this.createContext(flags);
        await metabaseService.logs?.(context);
    }
}
