import fs from 'node:fs/promises';
import path from 'node:path';
import { run, RunVerbosity } from './command-runner.js';

export enum Vcs {
    Git = 'git',
    Jj = 'jj',
}

/**
 * Selects JJ for initialized repositories, otherwise Git.
 *
 * Missing JJ is not a blocker: Git is used even when .jj exists. When JJ is
 * available, its repository detection takes precedence over Git. A .jj marker
 * also selects JJ if its repository command fails, rather than silently treating
 * an initialized JJ repository as Git-only. Repository checks handle failures.
 *
 * Detection never snapshots or changes the working copy.
 */
export async function detectVcs(rootDir: string, verbosity = RunVerbosity.Quiet): Promise<Vcs> {
    const options = { cwd: rootDir, capture: true as const, allowFailure: true, verbosity };
    const installed = await run('jj', ['--version'], options);
    if (installed.status !== 0) {
        return Vcs.Git;
    }
    const repository = await run('jj', ['--ignore-working-copy', 'git', 'root'], options);
    if (repository.status === 0) {
        return Vcs.Jj;
    }
    const hasJj = await fs.stat(path.join(rootDir, '.jj')).then(() => true, (error: NodeJS.ErrnoException) => {
        if (error.code === 'ENOENT') return false;
        throw error;
    });
    return hasJj ? Vcs.Jj : Vcs.Git;
}
