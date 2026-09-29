import { Command } from '@oclif/core';
import { getProjectPath } from '../../context/project-path.js';
import { run, RunVerbosity } from '../../runtime/command-runner.js';

export default class ReleasePackages extends Command {
    static summary = 'Publish unpublished workspace packages to npm';

    async run(): Promise<void> {
        await run('pnpm', ['-r', 'publish', '--yes'], { cwd: getProjectPath(), verbosity: RunVerbosity.Output });
    }
}
