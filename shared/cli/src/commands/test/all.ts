import { BaseCommand } from '../../base-command.js';
import { ciFlag } from '../../command-flags.js';
import { testE2e, testUnit } from '../../runtime/monorepo-runner.js';
import { RunVerbosity } from '../../runtime/command-runner.js';

export default class TestAll extends BaseCommand {
    static override verbosity = RunVerbosity.Output;
    static summary = 'Run unit and Playwright tests';
    static description = 'Use this when you want broad confidence locally before pushing changes that touch both backend and frontend behavior.';
    static examples = [
        'stam test all --ci',
        'stam test all --quiet',
    ];
    static flags = { ...this.verbosityFlags(), ci: ciFlag };

    async run(): Promise<void> {
        const { flags, context } = await this.parseWithContext(TestAll);
        await testUnit(context, flags.ci);
        await testE2e(context, { ci: flags.ci, clear: false, ui: false });
    }
}
