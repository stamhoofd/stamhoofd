import { Command } from '@oclif/core';
import { getProjectPath } from '../../context/project-path.js';
import { run, RunVerbosity } from '../../runtime/command-runner.js';
import { bumpReleaseVersion } from '../../runtime/release-version.js';
import { success } from '../../runtime/ux.js';

export default class ReleaseVersion extends Command {
    static summary = 'Bump, commit and tag the fixed npm release version';

    async run(): Promise<void> {
        const cwd = getProjectPath();
        const status = await run('git', ['status', '--porcelain'], { cwd, capture: true, verbosity: RunVerbosity.Quiet });
        if (status.stdout.trim()) {
            throw new Error('Commit all changes before releasing');
        }

        const { version, paths } = await bumpReleaseVersion(cwd);
        await run('git', ['add', '--', ...paths], { cwd });
        await run('git', ['commit', '-m', `v${version}`], { cwd, verbosity: RunVerbosity.Output });
        await run('git', ['tag', `v${version}`], { cwd });
        await run('git', ['push'], { cwd, verbosity: RunVerbosity.Output });
        await run('git', ['push', 'origin', `v${version}`], { cwd, verbosity: RunVerbosity.Output });
        success(`Tagged v${version}.`);
    }
}
