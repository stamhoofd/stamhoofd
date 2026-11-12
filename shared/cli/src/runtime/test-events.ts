import net from 'node:net';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

export type TestCounts = { passed: number; failed: number; skipped: number; todo: number; flaky: number; pending: number };
export type TestProgress = TestCounts & { completed: number; total?: number; finished: boolean };
type TestEvent = TestProgress & { version: 1; session: string; sequence: number };
const maxFrameBytes = 4096;

export function emptyTestCounts(): TestCounts {
    return { passed: 0, failed: 0, skipped: 0, todo: 0, flaky: 0, pending: 0 };
}

export function formatTestCounts(counts: TestCounts): string {
    return (Object.keys(emptyTestCounts()) as (keyof TestCounts)[])
        .filter(name => counts[name] > 0).map(name => `${counts[name]} ${name}`).join(' · ') || '0 tests';
}

/** Reporter-only best-effort transport. Counters are snapshots, so throttling loses no results. */
export function createTestEmitter(env: NodeJS.ProcessEnv = process.env) {
    let socket: net.Socket | undefined;
    let closed = false;
    let sequence = 0;
    let last = -Infinity;
    return {
        emit(progress: TestProgress) {
            if (closed || !env.STAM_TEST_SOCKET || !env.STAM_TEST_SESSION) return;
            const now = performance.now();
            if (!progress.finished && now - last < 250) return;
            last = now;
            socket ??= net.createConnection(env.STAM_TEST_SOCKET)
                .on('error', () => { closed = true; socket?.destroy(); });
            socket.unref();
            if (socket.writableLength > maxFrameBytes * 4) {
                closed = true;
                socket.destroy();
                return;
            }
            socket.write(JSON.stringify({ ...progress, version: 1, session: env.STAM_TEST_SESSION, sequence: ++sequence }) + '\n');
        },
        async close() {
            closed = true;
            if (!socket || socket.destroyed) return;
            const connection = socket;
            await new Promise<void>((resolve) => {
                const timer = setTimeout(() => connection.destroy(), 250);
                connection.once('close', () => { clearTimeout(timer); resolve(); });
                connection.end();
            });
        },
    };
}

function isTestEvent(value: unknown, session: string): value is TestEvent {
    if (!value || typeof value !== 'object') return false;
    const record = value as Record<string, unknown>;
    const counters = ['completed', 'passed', 'failed', 'skipped', 'todo', 'flaky', 'pending', 'sequence'];
    return record.version === 1 && record.session === session && typeof record.finished === 'boolean'
        && counters.every((key) => {
            // eslint-disable-next-line security/detect-object-injection -- Only fixed protocol counter names are inspected.
            const count = record[key];
            return typeof count === 'number' && Number.isSafeInteger(count) && count >= 0;
        })
        && (record.total === undefined || (typeof record.total === 'number' && Number.isSafeInteger(record.total) && record.total >= (record.completed as number)));
}

/** Private, per-run NDJSON socket; malformed/foreign frames disconnect only their producer. */
export async function openTestEventChannel(receive: (event: TestProgress) => void) {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'stam-tests-'));
    const socketPath = path.join(directory, 'events.sock');
    const session = randomUUID();
    const sockets = new Set<net.Socket>();
    let sequence = 0;
    const server = net.createServer((socket) => {
        sockets.add(socket);
        let pending = Buffer.alloc(0);
        socket.on('error', () => socket.destroy());
        socket.on('close', () => sockets.delete(socket));
        socket.on('data', (chunk: Buffer) => {
            pending = Buffer.concat([pending, chunk]);
            let end: number;
            while ((end = pending.indexOf(10)) !== -1) {
                if (end > maxFrameBytes) return socket.destroy();
                const line = pending.subarray(0, end).toString('utf8');
                pending = pending.subarray(end + 1);
                let value: unknown;
                try { value = JSON.parse(line); } catch { return socket.destroy(); }
                if (!isTestEvent(value, session) || value.sequence <= sequence) return socket.destroy();
                sequence = value.sequence;
                receive(value);
            }
            if (pending.length > maxFrameBytes) socket.destroy();
        });
    });
    try {
        await new Promise<void>((resolve, reject) => {
            server.once('error', reject);
            server.listen(socketPath, () => { server.removeListener('error', reject); resolve(); });
        });
    } catch (error) {
        await fs.rm(directory, { recursive: true, force: true });
        throw error;
    }
    return {
        env: { STAM_TEST_SOCKET: socketPath, STAM_TEST_SESSION: session },
        async close() {
            for (const socket of sockets) socket.destroy();
            await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
            await fs.rm(directory, { recursive: true, force: true });
        },
    };
}
