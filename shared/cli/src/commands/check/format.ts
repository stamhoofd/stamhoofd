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
        const options = { cwd: context.rootDir, verbosity: RunVerbosity.Output };
        const oxfmt = ['exec', 'oxfmt', flags.fix ? '--write' : '--check'];
        if (process.env.JJ_COMMIT_ID) {
            // jj run places the checkout under .jj/, which Oxfmt ignores during discovery.
            const { stdout } = await run(
                'git',
                [
                    'ls-tree',
                    '-rz',
                    '--full-tree',
                    '--format=%(objectmode) %(path)',
                    process.env.JJ_COMMIT_ID,
                ],
                { cwd: context.rootDir, capture: true, verbosity: RunVerbosity.Quiet },
            );
            const files = stdout
                .split('\0')
                .filter((entry) => entry.startsWith('100644 ') || entry.startsWith('100755 '))
                .map((entry) => entry.slice(7));
            for (let i = 0; i < files.length; i += 250) {
                await run(
                    'pnpm',
                    [...oxfmt, '--no-error-on-unmatched-pattern', '--', ...files.slice(i, i + 250)],
                    options,
                );
            }
        } else {
            await run('pnpm', oxfmt, options);
        }
        await run(
            'node',
            [
                path.join(context.rootDir, 'shared/eslint/bin/format.mjs'),
                ...(flags.fix ? ['--fix'] : []),
            ],
            options,
        );
    }
}
