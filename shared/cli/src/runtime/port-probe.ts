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
    return await new Promise((resolve) => {
        const server = net.createServer();

        server.once('error', () => resolve(false));
        server.once('listening', () => {
            server.close(() => resolve(true));
        });

        server.listen(port, host);
    });
}

/**
 * The subset of `ports` that is already in use, in the order they were passed in.
 */
export async function findBusyPorts(ports: number[], host: string = localIpv4Host): Promise<number[]> {
    const results = await Promise.all(ports.map(async port => ({ port, available: await isPortAvailable(port, host) })));
    return results.filter(result => !result.available).map(result => result.port);
}
