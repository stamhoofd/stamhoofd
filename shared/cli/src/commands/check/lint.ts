import { BaseCommand } from '../../base-command.js';
import { lint } from '../../runtime/monorepo-runner.js';
import { RunVerbosity } from '../../runtime/command-runner.js';

export default class CheckLint extends BaseCommand {
    static override verbosity = RunVerbosity.Output;
    static summary = 'Run ESLint';
    static description = 'Use this when you want fast feedback on style and lint rules without running the full validation suite.';
    static examples = [
        'stam check lint',
        'stam check lint --quiet',
    ];
    static flags = this.verbosityFlags();

    async run(): Promise<void> {
        const { context } = await this.parseWithContext(CheckLint);
        await lint(context);
    }
}
