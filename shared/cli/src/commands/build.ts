import { BaseCommand } from '../base-command.js';
import { buildAll } from '../runtime/monorepo-runner.js';

export default class Build extends BaseCommand {
    static summary = 'Build all Stamhoofd packages';
    static description = 'Use this when generated artifacts are stale or before running broader checks that depend on a clean build.';
    static examples = [
        'stam build --env keeo',
        'stam build --verbose',
    ];
    static flags = BaseCommand.environmentFlags;

    async run(): Promise<void> {
        const { flags } = await this.parse(Build);
        await buildAll(await this.createContext(flags));
    }
}
