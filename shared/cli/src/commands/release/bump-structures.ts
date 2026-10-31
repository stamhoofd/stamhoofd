import { Command, Flags } from '@oclif/core';
import { getProjectPath } from '../../context/project-path.js';
import { increaseStructuresVersion } from '../../runtime/structures-version.js';

export default class ReleaseBumpStructures extends Command {
    static summary = 'Replace ...NextVersion by the next structures version and bump Version.ts';
    static description = 'Searches every ...NextVersion inside a @field decorator in the repository, replaces it by the next structures version, bumps shared/structures/src/Version.ts and commits and pushes the result. Does nothing when no ...NextVersion is used. Runs as the first step of "pnpm ship".';
    static examples = [
        'stam release bump-structures',
        'stam release bump-structures --force',
    ];

    static flags = {
        force: Flags.boolean({ description: 'Skip the git checks (clean working tree, on main, up to date with origin/main).', default: false }),
    };

    async run(): Promise<void> {
        const { flags } = await this.parse(ReleaseBumpStructures);
        await increaseStructuresVersion({ cwd: getProjectPath(), force: flags.force });
    }
}
