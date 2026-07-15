import net from 'node:net';
import type { CliContext } from './create-context.js';
import { buildPorts } from './ports.js';

const portResolutionStep = 100;
const maxResolutionAttempts = 100;

enum AppPortName {
    WebApp = 'webApp',
    Webshop = 'webshop',
    Api = 'api',
    Renderer = 'renderer',
    Sso = 'sso',
    Docs = 'docs',
}

const appPortNames: AppPortName[] = [AppPortName.WebApp, AppPortName.Webshop, AppPortName.Api, AppPortName.Renderer, AppPortName.Sso, AppPortName.Docs];

export async function resolvePortOffset(context: CliContext): Promise<CliContext> {
    if (process.env.STAMHOOFD_PORT_OFFSET_LOCKED === '1') {
        return context;
    }

    if (process.env.STAMHOOFD_PORT_OFFSET) {
        await assertPortsAvailable(context);
        return context;
    }

    let candidate = context;

    for (let attempt = 0; attempt < maxResolutionAttempts; attempt++) {
        // Keep each instance on a stable bucket when possible, but move in
        // predictable steps so multiple local clones can coexist.
        if (await appPortsAvailable(candidate)) {
            return candidate;
        }

        candidate = {
            ...candidate,
            instance: {
                ...candidate.instance,
                portOffset: candidate.instance.portOffset + portResolutionStep,
            },
        };
    }

    throw new Error(`Could not find a free development port range for instance ${context.instance.name}`);
}

async function assertPortsAvailable(context: CliContext): Promise<void> {
    const occupied = await occupiedAppPorts(context);

    if (occupied.length === 0) {
        return;
    }

    const details = occupied.map(({ name, port }) => `${name}:${port}`).join(', ');
    throw new Error(`Configured port offset ${context.instance.portOffset} is unavailable for instance ${context.instance.name} (${details})`);
}

async function appPortsAvailable(context: CliContext): Promise<boolean> {
    return (await occupiedAppPorts(context)).length === 0;
}

async function occupiedAppPorts(context: CliContext): Promise<Array<{ name: AppPortName; port: number }>> {
    const ports = buildPorts(context);
    const results = await Promise.all(appPortNames.map(async name => ({
        name,
        port: ports[name],
        available: await isPortAvailable(ports[name]),
    })));

    return results
        .filter(result => !result.available)
        .map(({ name, port }) => ({ name, port }));
}

async function isPortAvailable(port: number): Promise<boolean> {
    return await new Promise((resolve) => {
        const server = net.createServer();

        server.once('error', (error: NodeJS.ErrnoException) => {
            if (error.code === 'EADDRINUSE' || error.code === 'EACCES') {
                resolve(false);
                return;
            }
            resolve(false);
        });

        server.once('listening', () => {
            server.close(() => resolve(true));
        });

        server.listen(port, '127.0.0.1');
    });
}
