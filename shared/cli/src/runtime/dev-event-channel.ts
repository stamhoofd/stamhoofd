import net from 'node:net';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { isDevEvent, maxEventBytes } from '@node/dev-tools/events';
import type { DevEvent } from '@node/dev-tools/events';

/**
 * Opens a session-isolated, bounded NDJSON receiver on a private local Unix socket.
 * @param receive - Synchronous event consumer; must not throw or retain unbounded history.
 * @param traceparent - Explicit parent context propagated to child processes.
 * @returns Child environment variables and the owner-only close operation.
 * @throws When the temporary directory or listener cannot be created.
 * @remarks Malformed, oversized and foreign-session frames close only their connection.
 * The caller must await close exactly once after stopping producers; it disconnects
 * remaining clients and removes the socket directory. stdout/stderr are untouched.
 */
export async function openDevEventChannel(receive: (event: DevEvent) => void, traceparent?: string) {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'stam-events-'));
    const socketPath = path.join(directory, 'events.sock');
    const session = randomUUID();
    const sockets = new Set<net.Socket>();
    const server = net.createServer((socket) => {
        sockets.add(socket);
        let pending = Buffer.alloc(0);
        socket.on('error', () => socket.destroy());
        socket.on('close', () => sockets.delete(socket));
        socket.on('data', (chunk: Buffer) => {
            pending = Buffer.concat([pending, chunk]);
            let end: number;
            while ((end = pending.indexOf(10)) !== -1) {
                if (end > maxEventBytes) return socket.destroy();
                const line = pending.subarray(0, end).toString('utf8');
                pending = pending.subarray(end + 1);
                let value: unknown;
                try { value = JSON.parse(line); } catch { return socket.destroy(); }
                if (!isDevEvent(value) || value.session !== session) return socket.destroy();
                receive(value);
            }
            if (pending.length > maxEventBytes) socket.destroy();
        });
    });
    try {
        await new Promise<void>((resolve, reject) => {
            server.once('error', reject);
            server.listen(socketPath, () => {
                server.removeListener('error', reject);
                resolve();
            });
        });
    } catch (error) {
        await fs.rm(directory, { recursive: true, force: true });
        throw error;
    }
    return {
        env: { STAM_DEV_SOCKET: socketPath, STAM_DEV_SESSION: session, STAM_DEV_TRACEPARENT: traceparent },
        async close() {
            for (const socket of sockets) socket.destroy();
            await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
            await fs.rm(directory, { recursive: true, force: true });
        },
    };
}
