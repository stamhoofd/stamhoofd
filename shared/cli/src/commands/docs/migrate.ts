import { Args, Flags } from '@oclif/core';
import { BaseCommand } from '../../base-command.js';
import { yesFlag } from '../../command-flags.js';
import { run, RunVerbosity } from '../../runtime/command-runner.js';

export default class DocsMigrate extends BaseCommand {
    static override verbosity = RunVerbosity.Output;
    static summary = 'Import a Ghost export into the docs site as Docus content';
    static description = [
        'Converts a Ghost JSON export into Docus markdown under docs/content/, grouped by tag.',
        'Pass --clean without an export path to only wipe the generated content.',
        'The clean step asks for confirmation unless you pass --yes.',
    ].join(' ');

    static examples = [
        'stam docs migrate ~/Downloads/ghost-export.json',
        'stam docs migrate ~/Downloads/ghost-export.json --clean',
        'stam docs migrate --clean',
    ];

    static args = {
        export: Args.string({ description: 'Path to the Ghost JSON export', required: false }),
    };

    static flags = {
        ...this.verbosityFlags(),
        clean: Flags.boolean({ default: false, description: 'Remove all existing content before importing' }),
        yes: yesFlag,
    };

    async run(): Promise<void> {
        const parsed = await this.parse(DocsMigrate);
        const { args, flags } = parsed;

        if (!args.export && !flags.clean) {
            this.error('Pass a Ghost export path to import, and/or --clean.');
        }

        const { context } = await this.parseWithContext(DocsMigrate, parsed);
        if (context.verbosity !== RunVerbosity.Output && !flags.yes) {
            this.error('--quiet requires --yes because the migrator may prompt for confirmation.');
        }

        const passthrough = [
            ...(args.export ? [args.export] : []),
            ...(flags.clean ? ['--clean'] : []),
            ...(flags.yes ? ['--yes'] : []),
        ];

        await run('pnpm', ['--dir', '.development/docs-migration', 'run', 'start', ...passthrough], {
            cwd: context.rootDir,
            verbosity: context.verbosity ?? RunVerbosity.Output,
        });
    }
}
