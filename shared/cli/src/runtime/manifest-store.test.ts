import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CliContext } from '../context/create-context.js';
import { listActiveRouteManifests, registerServiceRoutes, RouteManifestKind, writeRouteManifest } from './manifest-store.js';

describe('manifest store', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('returns an empty route list when the manifest directory is missing', async () => {
        const context = await testContext();

        await expect(listActiveRouteManifests(context)).resolves.toEqual([]);
    });

    it('ignores corrupt route manifests and returns valid ones', async () => {
        const context = await testContext();
        const instancesDir = path.join(context.generatedDir, 'instances');
        await fs.mkdir(instancesDir, { recursive: true });
        await fs.writeFile(path.join(instancesDir, 'valid.json'), JSON.stringify({
            version: '2',
            name: 'main',
            kind: RouteManifestKind.DevInstance,
            pid: process.pid,
            startedAt: '2026-01-01T00:00:00.000Z',
            rootPath: '/repo',
            workspace: 'main',
            routes: [{ hosts: ['dashboard.stamhoofd'], port: 8080 }],
            tlsSubjects: ['dashboard.stamhoofd'],
        }, null, 4));
        await fs.writeFile(path.join(instancesDir, 'broken.json'), '{broken');
        const warnings: string[] = [];
        const writeOutputLine = vi.fn((message: string) => {
            warnings.push(message);
        });

        await expect(listActiveRouteManifests(context, { writeOutputLine })).resolves.toMatchObject([
            { name: 'main', kind: RouteManifestKind.DevInstance },
        ]);
        expect(warnings).toHaveLength(1);
        expect(warnings[0]).toContain('broken.json');
    });

    it('registers service routes with the current process id and TLS subjects', async () => {
        const context = await testContext();

        await registerServiceRoutes(context, {
            name: 'main-sgv-mock',
            kind: RouteManifestKind.SgvMock,
            routes: [
                { hosts: ['login.sgv.stamhoofd'], port: 9094 },
                { hosts: ['admin.sgv.stamhoofd'], port: 9094 },
            ],
        });

        await expect(listActiveRouteManifests(context)).resolves.toMatchObject([
            {
                name: 'main-sgv-mock',
                kind: RouteManifestKind.SgvMock,
                pid: process.pid,
                tlsSubjects: ['login.sgv.stamhoofd', 'admin.sgv.stamhoofd'],
            },
        ]);
    });

    it('returns active route manifests', async () => {
        const context = await testContext();
        await writeRouteManifest(context, {
            version: '2',
            name: 'playwright-worker-0',
            kind: RouteManifestKind.PlaywrightWorker,
            pid: process.pid,
            startedAt: new Date().toISOString(),
            expiresAt: new Date(Date.now() + 60_000).toISOString(),
            rootPath: '/repo',
            workspace: 'playwright',
            routes: [{ hosts: ['playwright-dashboard-0.stamhoofd'], port: 6100 }],
            tlsSubjects: ['playwright-dashboard-0.stamhoofd'],
        });

        await expect(listActiveRouteManifests(context)).resolves.toMatchObject([
            { name: 'playwright-worker-0', kind: RouteManifestKind.PlaywrightWorker },
        ]);
    });

    it('ignores and removes expired route manifests', async () => {
        const context = await testContext();
        await writeRouteManifest(context, {
            version: '2',
            name: 'playwright-worker-0',
            kind: RouteManifestKind.PlaywrightWorker,
            startedAt: new Date().toISOString(),
            expiresAt: new Date(Date.now() - 60_000).toISOString(),
            rootPath: '/repo',
            workspace: 'playwright',
            routes: [{ hosts: ['playwright-dashboard-0.stamhoofd'], port: 6100 }],
            tlsSubjects: ['playwright-dashboard-0.stamhoofd'],
        });

        await expect(listActiveRouteManifests(context)).resolves.toEqual([]);
        await expect(fs.stat(path.join(context.generatedDir, 'instances', 'playwright-worker-0.json'))).rejects.toMatchObject({ code: 'ENOENT' });
    });

    it('ignores and removes route manifests with a dead pid', async () => {
        const context = await testContext();
        vi.spyOn(process, 'kill').mockImplementation(((pid: number, signal?: NodeJS.Signals | number) => {
            if (signal === 0 && pid === 123456) {
                throw new Error('not alive');
            }
            return true;
        }) as typeof process.kill);
        await writeRouteManifest(context, {
            version: '2',
            name: 'playwright-worker-0',
            kind: RouteManifestKind.PlaywrightWorker,
            pid: 123456,
            startedAt: new Date().toISOString(),
            expiresAt: new Date(Date.now() + 60_000).toISOString(),
            rootPath: '/repo',
            workspace: 'playwright',
            routes: [{ hosts: ['playwright-dashboard-0.stamhoofd'], port: 6100 }],
            tlsSubjects: ['playwright-dashboard-0.stamhoofd'],
        });

        await expect(listActiveRouteManifests(context)).resolves.toEqual([]);
        await expect(fs.stat(path.join(context.generatedDir, 'instances', 'playwright-worker-0.json'))).rejects.toMatchObject({ code: 'ENOENT' });
    });
});

async function testContext(): Promise<CliContext> {
    const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), 'stam-cli-manifest-'));
    return {
        rootDir: '/repo',
        generatedDir: rootDir,
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
