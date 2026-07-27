import fs from 'node:fs/promises';
import path from 'node:path';

type LockFile = {
    pid: number;
    startedAt: string;
};

const defaultTimeoutMs = 60_000;
const defaultStaleMs = 120_000;
const pollIntervalMs = 50;

/**
 * Run `handler` while holding an advisory lock file, so concurrent CLI processes (dev sessions,
 * e2e runs in other worktrees) never interleave a read-modify-write of shared state such as the
 * Caddy config. Locks from dead processes and locks older than `staleMs` are taken over, and after
 * `timeoutMs` the lock is stolen rather than failing the caller: a stuck lock file must never make
 * `stam dev` or an e2e run unusable.
 */
export async function withFileLock<T>(lockPath: string, handler: () => Promise<T>, options: { timeoutMs?: number; staleMs?: number } = {}): Promise<T> {
    const timeoutMs = options.timeoutMs ?? defaultTimeoutMs;
    const staleMs = options.staleMs ?? defaultStaleMs;
    await acquireLock(lockPath, timeoutMs, staleMs);

    try {
        return await handler();
    }
    finally {
        await fs.rm(lockPath, { force: true }).catch(() => undefined);
    }
}

async function acquireLock(lockPath: string, timeoutMs: number, staleMs: number): Promise<void> {
    const start = Date.now();
    await fs.mkdir(path.dirname(lockPath), { recursive: true });

    while (true) {
        if (await writeLock(lockPath)) {
            return;
        }

        const holder = await readLock(lockPath);
        // A lock held by this process itself is taken over right away: the CLI is single threaded,
        // so a nested call can only mean the outer call is waiting on us.
        const expired = holder === undefined
            || holder.pid === process.pid
            || !processIsAlive(holder.pid)
            || Date.now() - Date.parse(holder.startedAt) > staleMs;

        if (expired || Date.now() - start > timeoutMs) {
            await fs.rm(lockPath, { force: true }).catch(() => undefined);
        }

        await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
    }
}

async function writeLock(lockPath: string): Promise<boolean> {
    const contents: LockFile = { pid: process.pid, startedAt: new Date().toISOString() };
    try {
        await fs.writeFile(lockPath, JSON.stringify(contents), { flag: 'wx' });
        return true;
    }
    catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'EEXIST') {
            return false;
        }
        throw error;
    }
}

async function readLock(lockPath: string): Promise<LockFile | undefined> {
    try {
        const raw = JSON.parse(await fs.readFile(lockPath, 'utf-8')) as Partial<LockFile>;
        if (typeof raw.pid !== 'number' || typeof raw.startedAt !== 'string' || Number.isNaN(Date.parse(raw.startedAt))) {
            return undefined;
        }
        return { pid: raw.pid, startedAt: raw.startedAt };
    }
    catch {
        return undefined;
    }
}

function processIsAlive(pid: number): boolean {
    try {
        process.kill(pid, 0);
        return true;
    }
    catch (error) {
        // EPERM means the process exists but belongs to someone else.
        return (error as NodeJS.ErrnoException).code === 'EPERM';
    }
}
