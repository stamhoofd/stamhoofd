import { Flags } from '@oclif/core';
import { BaseCommand } from '../../base-command.js';
import { run, RunVerbosity } from '../../runtime/command-runner.js';

export default class CheckFormat extends BaseCommand {
    static summary = 'Check repository formatting with Oxfmt';
    static description = 'Check formatting across the repository, or apply formatting with --fix.';
    static examples = [
        'stam check format',
        'stam check format --fix',
    ];
    static flags = {
        fix: Flags.boolean({ description: 'Format files in place', default: false }),
    };

    async run(): Promise<void> {
        const { flags, context } = await this.parseWithContext(CheckFormat);
        await run('pnpm', ['exec', 'oxfmt', flags.fix ? '--write' : '--check'], { cwd: context.rootDir, verbosity: RunVerbosity.Output });
    }
}
