import { Args, Flags } from '@oclif/core';
import { BaseCommand } from '../../base-command.js';
import { typecheck } from '../../runtime/monorepo-runner.js';
import { RunVerbosity } from '../../runtime/command-runner.js';

export default class CheckTypecheck extends BaseCommand {
    static override verbosity = RunVerbosity.Output;
    static summary = 'Run TypeScript checks';
    static description = 'Use this when you changed shared types or want to verify cross-package type safety before running heavier checks.';
    static examples = [
        'stam check typecheck',
        'stam check typecheck mobile',
        'stam check typecheck --filter "@stamhoofd/*"',
        'stam check typecheck --quiet',
    ];
    static args = {
        target: Args.string({ description: 'Package in @stamhoofd, such as mobile, or a fully scoped package name', required: false }),
    };

    static flags = {
        ...this.verbosityFlags(),
        filter: Flags.string({ char: 'F', multiple: true, description: 'Turbo workspace selector (repeat to select multiple packages)' }),
    };

    async run(): Promise<void> {
        const { context, args, flags } = await this.parseWithContext(CheckTypecheck);
        const filters = [...(flags.filter ?? [])];
        if (args.target) {
            filters.unshift(args.target.startsWith('@') ? args.target : `@stamhoofd/${args.target}`);
        }
        await typecheck(context, filters);
    }
}
