import { Flags } from '@oclif/core';
import { BaseCommand } from '../../base-command.js';
import { RunVerbosity } from '../../runtime/command-runner.js';
import { increaseStructuresVersion } from '../../runtime/structures-version.js';

export default class ReleaseBumpStructures extends BaseCommand {
    static override verbosity = RunVerbosity.Command;
    static summary = 'Replace ...NextVersion by the next structures version and bump Version.ts';
    static description = 'Searches every ...NextVersion inside a @field decorator in the repository, replaces it by the next structures version, bumps shared/structures/src/Version.ts and commits the result with Git or JJ. Pushing is left to the rest of "pnpm ship". Does nothing when no ...NextVersion is used. Runs as the first step of "pnpm ship".';
    static examples = [
        'stam release bump-structures',
        'stam release bump-structures --force',
        'stam release bump-structures --quiet',
    ];

    static flags = {
        ...this.verbosityFlags(),
        force: Flags.boolean({ description: 'Skip the git checks (clean working tree, on main, up to date with origin/main).', default: false }),
    };

    async run(): Promise<void> {
        const { context, flags } = await this.parseWithContext(ReleaseBumpStructures);
        await increaseStructuresVersion({
            cwd: context.rootDir,
            force: flags.force,
            verbosity: context.verbosity ?? RunVerbosity.Command,
        });
    }
}
