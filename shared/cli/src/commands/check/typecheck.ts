import { BaseCommand } from '../../base-command.js';
import { typecheck } from '../../runtime/monorepo-runner.js';
import { RunVerbosity } from '../../runtime/command-runner.js';

export default class CheckTypecheck extends BaseCommand {
    static override verbosity = RunVerbosity.Output;
    static summary = 'Run TypeScript checks';
    static description = 'Use this when you changed shared types or want to verify cross-package type safety before running heavier checks.';
    static examples = [
        'stam check typecheck',
        'stam check typecheck --quiet',
    ];
    static flags = this.verbosityFlags();

    async run(): Promise<void> {
        const { context } = await this.parseWithContext(CheckTypecheck);
        await typecheck(context);
    }
}
