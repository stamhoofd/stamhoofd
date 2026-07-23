import { Args, Flags } from '@oclif/core';
import { BaseCommand } from '../../base-command.js';
import { yesFlag } from '../../command-flags.js';
import { getProjectPath } from '../../context/project-path.js';
import { run } from '../../runtime/command-runner.js';

export default class DocsMigrate extends BaseCommand {
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
        ...BaseCommand.verboseFlags,
        clean: Flags.boolean({ default: false, description: 'Remove all existing content before importing' }),
        yes: yesFlag,
    };

    async run(): Promise<void> {
        const { args, flags } = await this.parse(DocsMigrate);

        if (!args.export && !flags.clean) {
            this.error('Pass a Ghost export path to import, and/or --clean.');
        }

        const passthrough = [
            ...(args.export ? [args.export] : []),
            ...(flags.clean ? ['--clean'] : []),
            ...(flags.yes ? ['--yes'] : []),
        ];

        // stdio is inherited so the migrator's confirmation prompt works.
        await run('yarn', ['workspace', 'docs-migration', '-s', 'start', ...passthrough], {
            cwd: getProjectPath(),
            verbose: flags.verbose,
        });
    }
}
