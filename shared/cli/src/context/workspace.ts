import path from 'node:path';
import { run } from '../runtime/command-runner.js';

export function slug(value: string): string {
    return value.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
}

export async function resolveWorkspaceName(rootDir: string): Promise<string> {
    return slug(process.env.STAMHOOFD_WORKSPACE_NAME ?? path.basename(rootDir)) || 'workspace';
}

export async function resolvePrimaryInstance(rootDir: string): Promise<boolean> {
    if (process.env.STAMHOOFD_PRIMARY_INSTANCE) {
        return process.env.STAMHOOFD_PRIMARY_INSTANCE === '1';
    }

    const jjPrimaryRoot = await resolveJjPrimaryWorkspaceRoot(rootDir);
    if (jjPrimaryRoot) {
        return samePath(rootDir, jjPrimaryRoot);
    }

    const gitPrimaryRoot = await resolveGitPrimaryWorktreeRoot(rootDir);
    return gitPrimaryRoot ? samePath(rootDir, gitPrimaryRoot) : false;
}

async function resolveJjPrimaryWorkspaceRoot(rootDir: string): Promise<string | null> {
    const result = await run('jj', ['workspace', 'list', '-T', 'name ++ "\\t" ++ root ++ "\\n"'], { cwd: rootDir, capture: true, allowFailure: true });
    if (result.status !== 0) {
        return null;
    }

    const firstLine = result.stdout.trim().split('\n').find(line => line.trim());
    const firstRoot = firstLine?.split('\t').at(1)?.trim();
    return firstRoot || null;
}

async function resolveGitPrimaryWorktreeRoot(rootDir: string): Promise<string | null> {
    const result = await run('git', ['worktree', 'list', '--porcelain'], { cwd: rootDir, capture: true, allowFailure: true });
    if (result.status !== 0) {
        return null;
    }

    const firstWorktreeLine = result.stdout.split('\n').find(line => line.startsWith('worktree '));
    return firstWorktreeLine?.slice('worktree '.length).trim() || null;
}

function samePath(a: string, b: string): boolean {
    return path.resolve(a) === path.resolve(b);
}
