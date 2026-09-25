import { BaseCommand } from '../../base-command.js';
import { buildAll, lint, testE2e, testUnit, typecheck } from '../../runtime/monorepo-runner.js';
import { RunVerbosity } from '../../runtime/command-runner.js';

export default class CheckAll extends BaseCommand {
    static override verbosity = RunVerbosity.Output;
    static summary = 'Run all validation checks';
    static description = 'Use this before pushing when you want roughly the same broad safety net as the main automated checks.';
    static examples = [
        'stam check all',
        'stam check all --env keeo',
    ];
    static flags = { env: BaseCommand.environmentFlags.env, ...this.verbosityFlags() };

    async run(): Promise<void> {
        const { context } = await this.parseWithContext(CheckAll);
        await buildAll(context);
        await lint(context);
        await typecheck(context);
        await testUnit(context, true);
        await testE2e(context, { ci: true, clear: false, ui: false });
    }
}
