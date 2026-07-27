import net from 'node:net';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CliContext } from '../context/create-context.js';
import type { RouteManifestInput } from './manifest-store.js';
import * as manifestStore from './manifest-store.js';
import { findRouteManifestConflicts, reserveRouteManifest } from './route-reservation.js';

vi.mock('./manifest-store.js', async importOriginal => ({
    ...await importOriginal<typeof manifestStore>(),
    listActiveRouteManifests: vi.fn(),
}));

const original = await vi.importActual<typeof manifestStore>('./manifest-store.js');

// A pid that is guaranteed not to be running, so its manifest counts as stale.
const deadPid = 2 ** 30;

// Only the race test replaces this; everything else reads the manifests from disk as usual.
beforeEach(() => {
    vi.mocked(manifestStore.listActiveRouteManifests).mockImplementation(async (context, options) => await original.listActiveRouteManifests(context, options));
});

afterEach(() => {
    vi.restoreAllMocks();
});

describe('findRouteManifestConflicts', () => {
    it('only reports manifests that claim one of the same ports', async () => {
        const context = await testContext();
        await original.writeRouteManifest(context, manifest({ name: 'other-run', reservedPorts: [6002, 6003] }));
        await original.writeRouteManifest(context, manifest({ name: 'far-away-run', reservedPorts: [6010] }));

        const conflicts = await findRouteManifestConflicts(context, manifest({ name: 'my-run', reservedPorts: [6000, 6001, 6002] }));

        expect(conflicts).toHaveLength(1);
        expect(conflicts[0].manifest.name).toBe('other-run');
        expect(conflicts[0].ports).toEqual([6002]);
    });

    it('ignores the manifest of the run itself and manifests without reserved ports', async () => {
        const context = await testContext();
        await original.writeRouteManifest(context, manifest({ name: 'my-run', reservedPorts: [6000] }));
        await original.writeRouteManifest(context, manifest({ name: 'legacy-run', reservedPorts: undefined }));

        await expect(findRouteManifestConflicts(context, manifest({ name: 'my-run', reservedPorts: [6000] }))).resolves.toEqual([]);
    });
});

describe('reserveRouteManifest', () => {
    it('claims the first range and writes its manifest', async () => {
        const context = await testContext();

        const reserved = await reserveRouteManifest(context, { buildManifest: buildBlock('my-run') });

        expect(reserved.reservedPorts).toEqual([6000, 6001]);
        expect(reserved.version).toBeDefined();
        await expect(original.listActiveRouteManifests(context)).resolves.toMatchObject([{ name: 'my-run', reservedPorts: [6000, 6001] }]);
    });

    it('skips ranges that another active manifest reserves', async () => {
        const context = await testContext();
        await original.writeRouteManifest(context, manifest({ name: 'other-run', reservedPorts: [6001, 6002] }));

        const reserved = await reserveRouteManifest(context, { buildManifest: buildBlock('my-run') });

        expect(reserved.reservedPorts).toEqual([6004, 6005]);
    });

    it('reuses ranges of manifests whose process is gone', async () => {
        const context = await testContext();
        await original.writeRouteManifest(context, manifest({ name: 'crashed-run', reservedPorts: [6000, 6001], pid: deadPid }));

        const reserved = await reserveRouteManifest(context, { buildManifest: buildBlock('my-run') });

        expect(reserved.reservedPorts).toEqual([6000, 6001]);
    });

    it('skips ranges with a port that is already bound', async () => {
        const context = await testContext();
        const taken = await listenOnFreePort();

        try {
            const reserved = await reserveRouteManifest(context, {
                buildManifest: attempt => attempt > 1 ? undefined : manifest({ name: 'my-run', reservedPorts: attempt === 0 ? [taken.port] : [taken.port + 1000] }),
            });

            expect(reserved.reservedPorts).toEqual([taken.port + 1000]);
        }
        finally {
            await taken.close();
        }
    });

    it('gives up its manifest when another run claimed the same ports first', async () => {
        const context = await testContext();
        const competitor = manifest({ name: 'other-run', reservedPorts: [6000, 6001], startedAt: new Date(Date.now() - 60_000).toISOString() });

        // The competitor writes its manifest right after we checked, so it only shows up in the
        // verification that follows our own write.
        let checks = 0;
        vi.mocked(manifestStore.listActiveRouteManifests).mockImplementation(async (ctx) => {
            checks += 1;
            if (checks > 1) {
                await original.writeRouteManifest(ctx, competitor);
            }
            return await original.listActiveRouteManifests(ctx);
        });

        const reserved = await reserveRouteManifest(context, { buildManifest: buildBlock('my-run') });

        expect(reserved.reservedPorts).toEqual([6002, 6003]);
        const active = await original.listActiveRouteManifests(context);
        expect(active.map(item => item.name).sort()).toEqual(['my-run', 'other-run']);
    });

    it('reports the blocked ranges when nothing is free', async () => {
        const context = await testContext();
        await original.writeRouteManifest(context, manifest({ name: 'other-run', reservedPorts: [6000, 6001] }));

        await expect(reserveRouteManifest(context, {
            buildManifest: attempt => attempt > 0 ? undefined : manifest({ name: 'my-run', reservedPorts: [6000, 6001] }),
        })).rejects.toThrow(/ports 6000, 6001 reserved by other-run/);
    });
});

/**
 * Builds consecutive two-port ranges, the way a Playwright run walks through its slots.
 */
function buildBlock(name: string, maxAttempt = 4) {
    return (attempt: number): RouteManifestInput | undefined => {
        if (attempt > maxAttempt) {
            return undefined;
        }
        return manifest({ name, reservedPorts: [6000 + attempt * 2, 6001 + attempt * 2] });
    };
}

function manifest(options: { name: string; reservedPorts?: number[]; pid?: number; startedAt?: string }): RouteManifestInput {
    return {
        name: options.name,
        kind: 'playwright-worker',
        pid: options.pid ?? process.pid,
        startedAt: options.startedAt ?? new Date().toISOString(),
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
        rootPath: '/repo',
        workspace: 'playwright',
        reservedPorts: options.reservedPorts,
        caddy: { routes: [], tlsSubjects: [] },
    };
}

/**
 * Occupy a free port so the reservation has to skip it.
 */
async function listenOnFreePort(): Promise<{ port: number; close: () => Promise<void> }> {
    const server = net.createServer();
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    if (address === null || typeof address === 'string') {
        throw new Error('Expected a TCP address');
    }

    return {
        port: address.port,
        close: async () => {
            await new Promise<void>(resolve => server.close(() => resolve()));
        },
    };
}

async function testContext(): Promise<CliContext> {
    const generatedDir = await fs.mkdtemp(path.join(os.tmpdir(), 'stam-cli-reservation-'));
    return {
        rootDir: '/repo',
        generatedDir,
        env: 'stamhoofd',
        workspace: 'main',
        verbose: false,
        instance: {
            name: 'stamhoofd',
            prefix: '',
            primary: true,
            portOffset: 0,
        },
    };
}
