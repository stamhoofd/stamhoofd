import { BaseCommand } from '../../base-command.js';
import { fixFlag } from '../../command-flags.js';
import { run, RunVerbosity } from '../../runtime/command-runner.js';
import path from 'node:path';

export default class CheckFormat extends BaseCommand {
    static summary = 'Check repository formatting with ESLint and Oxfmt';
    static description = 'Check formatting across the repository, or apply formatting with --fix.';
    static examples = ['stam check format', 'stam check format --fix'];

    static flags = {
        fix: fixFlag,
    };

    async run(): Promise<void> {
        const { flags, context } = await this.parseWithContext(CheckFormat);
        await run('pnpm', ['exec', 'oxfmt', flags.fix ? '--write' : '--check'], {
            cwd: context.rootDir,
            verbosity: RunVerbosity.Output,
        });
        await run(
            'node',
            [
                path.join(context.rootDir, 'shared/eslint/bin/format.mjs'),
                ...(flags.fix ? ['--fix'] : []),
            ],
            { cwd: context.rootDir, verbosity: RunVerbosity.Output },
        );
    }
}
