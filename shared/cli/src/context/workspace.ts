import path from 'node:path';
import { run, RunVerbosity } from '../runtime/command-runner.js';
import { detectVcs, Vcs } from '../runtime/vcs.js';

/** Converts a name to lowercase letters, digits, and hyphen-separated segments. */
export function slug(value: string): string {
    return value.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
}

/**
 * Resolves the workspace name used for instance identification.
 *
 * STAMHOOFD_WORKSPACE_NAME overrides the directory name. Both are normalized;
 * names without usable characters fall back to "workspace".
 */
export async function resolveWorkspaceName(rootDir: string): Promise<string> {
    return slug(process.env.STAMHOOFD_WORKSPACE_NAME ?? path.basename(rootDir)) || 'workspace';
}

/**
 * Resolves the primary workspace root using the selected VCS.
 *
 * Initialized JJ repositories take precedence when JJ is available; otherwise
 * Git is used. A failed workspace lookup returns null rather than switching VCS.
 */
export async function resolvePrimaryWorkspaceRoot(rootDir: string): Promise<string | null> {
    const vcs = await detectVcs(rootDir);
    if (vcs === Vcs.Jj) {
        return await resolveJjPrimaryWorkspaceRoot(rootDir);
    }

    const gitPrimaryRoot = await resolveGitPrimaryWorktreeRoot(rootDir);
    return gitPrimaryRoot;
}

/**
 * Determines whether this workspace is the primary development instance.
 *
 * A nonempty STAMHOOFD_PRIMARY_INSTANCE overrides detection: only "1" enables it.
 * Otherwise the workspace must match the primary root; an unknown root is secondary.
 */
export async function resolvePrimaryInstance(rootDir: string): Promise<boolean> {
    if (process.env.STAMHOOFD_PRIMARY_INSTANCE) {
        return process.env.STAMHOOFD_PRIMARY_INSTANCE === '1';
    }

    const root = await resolvePrimaryWorkspaceRoot(rootDir);
    if (root) {
        return samePath(rootDir, root);
    }

    return false;
}

/**
 * Finds the default JJ workspace, or the first listed workspace if absent.
 *
 * The lookup ignores the working copy to avoid snapshotting edits. Failed commands
 * and missing workspace roots return null.
 */
async function resolveJjPrimaryWorkspaceRoot(rootDir: string): Promise<string | null> {
    const result = await run('jj', ['--ignore-working-copy', 'workspace', 'list', '-T', 'name ++ "\\t" ++ root ++ "\\n"'], { cwd: rootDir, capture: true, allowFailure: true, verbosity: RunVerbosity.Quiet });
    if (result.status !== 0) {
        return null;
    }

    const workspaces = result.stdout.trim().split('\n').filter(line => line.trim());
    const primary = workspaces.find(line => line.startsWith('default\t')) ?? workspaces[0];
    return primary?.split('\t').at(1)?.trim() || null;
}

/**
 * Finds the main Git worktree from the first entry in Git's worktree list.
 *
 * Linked worktrees follow the main worktree in porcelain output. Failed commands
 * and missing worktree paths return null.
 */
async function resolveGitPrimaryWorktreeRoot(rootDir: string): Promise<string | null> {
    const result = await run('git', ['worktree', 'list', '--porcelain'], { cwd: rootDir, capture: true, allowFailure: true, verbosity: RunVerbosity.Quiet });
    if (result.status !== 0) {
        return null;
    }

    const firstWorktreeLine = result.stdout.split('\n').find(line => line.startsWith('worktree '));
    return firstWorktreeLine?.slice('worktree '.length).trim() || null;
}

/** Compares absolute paths without resolving symlinks or filesystem casing. */
function samePath(a: string, b: string): boolean {
    return path.resolve(a) === path.resolve(b);
}
