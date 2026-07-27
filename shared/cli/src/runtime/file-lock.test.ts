import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { withFileLock } from './file-lock.js';

describe('withFileLock', () => {
    let lockPath: string;

    beforeEach(async () => {
        const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'stam-cli-lock-'));
        lockPath = path.join(dir, 'nested', 'reload.lock');
    });

    it('runs handlers one after another and cleans up the lock file', async () => {
        const events: string[] = [];
        const handler = async (name: string) => await withFileLock(lockPath, async () => {
            events.push(`${name}:start`);
            await new Promise(resolve => setTimeout(resolve, 25));
            events.push(`${name}:end`);
        });

        await Promise.all([handler('a'), handler('b')]);

        expect(events).toEqual(events[0] === 'a:start'
            ? ['a:start', 'a:end', 'b:start', 'b:end']
            : ['b:start', 'b:end', 'a:start', 'a:end']);
        await expect(fs.stat(lockPath)).rejects.toMatchObject({ code: 'ENOENT' });
    });

    it('releases the lock when the handler throws', async () => {
        await expect(withFileLock(lockPath, () => Promise.reject(new Error('boom')))).rejects.toThrow('boom');

        await expect(fs.stat(lockPath)).rejects.toMatchObject({ code: 'ENOENT' });
        await expect(withFileLock(lockPath, () => Promise.resolve('ok'))).resolves.toBe('ok');
    });

    it('takes over a lock of a process that no longer exists', async () => {
        await fs.mkdir(path.dirname(lockPath), { recursive: true });
        await fs.writeFile(lockPath, JSON.stringify({ pid: 2 ** 30, startedAt: new Date().toISOString() }));

        await expect(withFileLock(lockPath, () => Promise.resolve('ok'), { timeoutMs: 5_000 })).resolves.toBe('ok');
    });

    it('takes over a lock that is older than the stale timeout', async () => {
        await writeForeignLock(new Date(Date.now() - 10_000));

        await expect(withFileLock(lockPath, () => Promise.resolve('ok'), { staleMs: 1_000, timeoutMs: 30_000 })).resolves.toBe('ok');
    });

    it('waits for a lock that is still held, and steals it after the timeout', async () => {
        await writeForeignLock(new Date());
        const start = Date.now();

        await expect(withFileLock(lockPath, () => Promise.resolve('ok'), { timeoutMs: 300 })).resolves.toBe('ok');
        expect(Date.now() - start).toBeGreaterThanOrEqual(300);
    });

    it('takes over a lock file that cannot be read', async () => {
        await fs.mkdir(path.dirname(lockPath), { recursive: true });
        await fs.writeFile(lockPath, 'not json');

        await expect(withFileLock(lockPath, () => Promise.resolve('ok'), { timeoutMs: 30_000 })).resolves.toBe('ok');
    });

    /**
     * A lock held by a process that is alive but is not this one: pid 1 always exists, and
     * signalling it fails with EPERM, which counts as alive.
     */
    async function writeForeignLock(startedAt: Date) {
        await fs.mkdir(path.dirname(lockPath), { recursive: true });
        await fs.writeFile(lockPath, JSON.stringify({ pid: 1, startedAt: startedAt.toISOString() }));
    }
});
