import { run, RunVerbosity } from './command-runner.js';
import { detectVcs, Vcs } from './vcs.js';

/** The committed revision underlying a clean checkout, or the current revision when dirty. */
export type Checkout = { vcs: Vcs; revision: string; clean: boolean };

/**
 * JJ represents uncommitted work as a commit. A clean checkout is an empty working
 * commit with exactly one parent; that parent is the revision to validate.
 * JJ commands snapshot the working copy so unsnapshotted edits are included.
 */
export async function inspectCheckout(cwd: string, verbosity = RunVerbosity.Quiet): Promise<Checkout> {
    const vcs = await detectVcs(cwd, verbosity);
    const options = { cwd, capture: true as const, verbosity };
    if (vcs === Vcs.Jj) {
        const { stdout } = await run('jj', ['log', '--no-graph', '-r', '@', '-T', 'commit_id ++ "\n" ++ empty ++ "\n" ++ parents.map(|parent| parent.commit_id()).join("\n") ++ "\n"'], options);
        const [revision, empty, ...parents] = stdout.trim().split('\n');
        const clean = empty === 'true' && parents.length === 1;
        return { vcs, revision: clean ? parents[0] : revision, clean };
    }
    const { stdout: status } = await run('git', ['status', '--porcelain'], options);
    const { stdout: revision } = await run('git', ['rev-parse', 'HEAD'], options);
    return { vcs, revision: revision.trim(), clean: !status.trim() };
}

/** Requires a clean checkout of main synchronized with origin, fetching before comparison. */
export async function assertMainCheckout(cwd: string, verbosity = RunVerbosity.Quiet): Promise<void> {
    const checkout = await inspectCheckout(cwd, verbosity);
    const options = { cwd, capture: true as const, verbosity };
    if (!checkout.clean) {
        throw new Error('You have pending changes. Please commit to main before releasing a new version.');
    }
    let main: string;
    let remote: string;
    if (checkout.vcs === Vcs.Jj) {
        await run('jj', ['git', 'fetch', '--remote', 'origin'], { cwd, verbosity });
        main = (await run('jj', ['log', '--no-graph', '-r', 'main', '-T', 'commit_id ++ "\n"'], options)).stdout.trim();
        remote = (await run('jj', ['log', '--no-graph', '-r', 'main@origin', '-T', 'commit_id ++ "\n"'], options)).stdout.trim();
    } else {
        await run('git', ['fetch', 'origin'], { cwd, verbosity });
        const { stdout: branch } = await run('git', ['branch', '--show-current'], options);
        main = branch.trim() === 'main' ? checkout.revision : '';
        remote = (await run('git', ['rev-parse', 'refs/remotes/origin/main'], options)).stdout.trim();
    }
    if (checkout.revision !== main) {
        throw new Error('You are not on main. Please checkout main before releasing a new version.');
    }
    if (main !== remote) {
        throw new Error('Your main branch/bookmark is not up to date with origin/main. Please synchronize it before releasing a new version.');
    }
}

/** Requires a clean checkout at the expected release tag; no branch or remote requirement. */
export async function assertReleaseTag(cwd: string, tag: string): Promise<void> {
    const checkout = await inspectCheckout(cwd);
    if (!checkout.clean) {
        throw new Error('You have pending changes. Please use a clean released checkout before deploying.');
    }
    const options = { cwd, capture: true as const, verbosity: RunVerbosity.Quiet };
    const { stdout } = checkout.vcs === Vcs.Jj
        ? await run('jj', ['log', '--no-graph', '-r', checkout.revision, '-T', 'tags.map(|tag| tag.name()).join("\n")'], options)
        : await run('git', ['tag', '--points-at', checkout.revision], options);
    if (!stdout.trim().split('\n').includes(tag)) {
        throw new Error(`Checkout does not match release tag ${tag}. Release a new version using \`pnpm --dir .. run ship\` before deploying.`);
    }
}
