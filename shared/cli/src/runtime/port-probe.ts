import net from 'node:net';
import { localIpv4Host } from '../config/shared-service-config.js';

/**
 * Whether a TCP port can still be bound on this machine.
 *
 * Binding is the only check that also sees processes the manifest store knows nothing about (an
 * unrelated server, a leftover process, an e2e run started from a checkout with its own generated
 * directory), so port bookkeeping always combines the manifests with this probe.
 */
export async function isPortAvailable(port: number, host: string = localIpv4Host): Promise<boolean> {
    return await new Promise((resolve, reject) => {
        const server = net.createServer();

        server.once('error', (error: NodeJS.ErrnoException) => {
            if (error.code === 'EACCES' || error.code === 'EPERM') {
                reject(error);
                return;
            }

            resolve(false);
        });
        server.once('listening', () => {
            server.close(() => resolve(true));
        });

        server.listen(port, host);
    });
}

/**
 * Whether something accepts TCP connections on a port.
 *
 * The inverse of `isPortAvailable` is not the same check: a bind probe only tells us the port is
 * taken on the host we probed, while a server we want to talk to has to accept the connection. Used
 * to tell "your MySQL is not running" apart from "your MySQL is running elsewhere".
 */
export async function isPortListening(port: number, host: string = localIpv4Host, timeoutMs = 1000): Promise<boolean> {
    return await new Promise((resolve) => {
        const socket = new net.Socket();

        const finish = (listening: boolean) => {
            socket.destroy();
            resolve(listening);
        };

        socket.setTimeout(timeoutMs);
        socket.once('error', () => finish(false));
        socket.once('timeout', () => finish(false));
        socket.connect(port, host, () => finish(true));
    });
}

/**
 * The subset of `ports` that is already in use, in the order they were passed in.
 */
export async function findBusyPorts(ports: number[], host: string = localIpv4Host): Promise<number[]> {
    const results = await Promise.all(ports.map(async port => ({ port, available: await isPortAvailable(port, host) })));
    return results.filter(result => !result.available).map(result => result.port);
}
