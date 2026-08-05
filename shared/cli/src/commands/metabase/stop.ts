import { BaseCommand } from '../../base-command.js';
import { metabaseService } from '../../services/definitions/metabase-service.js';

export default class MetabaseStop extends BaseCommand {
    static summary = 'Stop the local Metabase server';
    static description = 'Use this to free the memory Metabase holds while it is not being used. Questions and dashboards are kept in its application database and come back on the next start.';
    static examples = [
        'stam metabase stop',
        'stam metabase stop --env keeo',
    ];

    static flags = BaseCommand.instanceFlags;

    async run(): Promise<void> {
        const { flags } = await this.parse(MetabaseStop);
        const context = await this.createContext(flags);
        await metabaseService.stop(context);
        this.log('Local Metabase server stopped.');
    }
}
