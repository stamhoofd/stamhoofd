import { BaseCommand } from '../../base-command.js';
import { ciFlag } from '../../command-flags.js';
import { testE2e, testUnit } from '../../runtime/monorepo-runner.js';

export default class TestAll extends BaseCommand {
    static summary = 'Run unit and Playwright tests';
    static description = 'Use this when you want broad confidence locally before pushing changes that touch both backend and frontend behavior.';
    static examples = [
        'stam test all --ci',
        'stam test all --verbose',
    ];
    static flags = { ...BaseCommand.verboseFlags, ci: ciFlag };

    async run(): Promise<void> {
        const { flags } = await this.parse(TestAll);
        const context = await this.createContext(flags);
        await testUnit(context, flags.ci);
        await testE2e(context, { ci: flags.ci, ui: false });
    }
}
