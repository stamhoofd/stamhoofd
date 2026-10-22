import { Args, Flags } from '@oclif/core';
import { BaseCommand } from '../../base-command.js';
import { lint } from '../../runtime/monorepo-runner.js';
import { RunVerbosity } from '../../runtime/command-runner.js';

export default class CheckLint extends BaseCommand {
    static override verbosity = RunVerbosity.Output;
    static summary = 'Run ESLint';
    static description = 'Use this when you want fast feedback on style and lint rules without running the full validation suite.';
    static examples = [
        'stam check lint',
        'stam check lint mobile',
        'stam check lint --filter "./backend/shared/*"',
        'stam check lint --quiet',
    ];
    static args = {
        target: Args.string({ description: 'Package in @stamhoofd, such as mobile, or a fully scoped package name', required: false }),
    };

    static flags = {
        ...this.verbosityFlags(),
        filter: Flags.string({ char: 'F', multiple: true, description: 'Turbo workspace selector (repeat to select multiple packages)' }),
    };

    async run(): Promise<void> {
        const { context, args, flags } = await this.parseWithContext(CheckLint);
        const filters = [...(flags.filter ?? [])];
        if (args.target) {
            filters.unshift(args.target.startsWith('@') ? args.target : `@stamhoofd/${args.target}`);
        }
        await lint(context, filters);
    }
}
