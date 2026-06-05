import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { CliContext } from '../context/create-context.js';
import { writeInstanceManifest, writeRouteManifest } from '../runtime/manifest-store.js';
import { caddyAdminPort, localhostPort } from './shared-service-config.js';
import { writeCaddyConfig } from './caddy-config.js';

describe('Caddy config', () => {
    let rootDir: string;

    beforeEach(async () => {
        rootDir = await fs.mkdtemp(path.join(os.tmpdir(), 'stamhoofd-cli-caddy-'));
    });

    afterEach(async () => {
        await fs.rm(rootDir, { recursive: true, force: true });
    });

    it('writes bind-mounted config files readable by rootless containers', async () => {
        const config = await writeCaddyConfig(context(rootDir));

        expect((await fs.stat(path.dirname(config))).mode & 0o777).toBe(0o755);
        expect((await fs.stat(config)).mode & 0o777).toBe(0o644);
    });

    it('binds the admin API to localhost by default', async () => {
        const config = await writeCaddyConfig(context(rootDir));
        const caddyConfig = JSON.parse(await fs.readFile(config, 'utf8'));

        expect(caddyConfig.admin.listen).toBe(localhostPort(caddyAdminPort));
        expect(caddyConfig.admin.origins).toEqual([`http://${localhostPort(caddyAdminPort)}`]);
    });

    it('can bind the admin API to the container interface', async () => {
        const config = await writeCaddyConfig(context(rootDir), { adminListenHost: '0.0.0.0' });
        const caddyConfig = JSON.parse(await fs.readFile(config, 'utf8'));

        expect(caddyConfig.admin.listen).toBe(`0.0.0.0:${caddyAdminPort}`);
        expect(caddyConfig.admin.origins).toEqual([`http://${localhostPort(caddyAdminPort)}`]);
    });

    it('keeps normal routes when adding Playwright routes', async () => {
        const ctx = context(rootDir);
        await writeRouteManifest(ctx, {
            name: 'playwright-worker-0',
            kind: 'playwright-worker',
            pid: process.pid,
            startedAt: new Date().toISOString(),
            expiresAt: new Date(Date.now() + 60_000).toISOString(),
            rootPath: rootDir,
            workspace: 'playwright',
            routes: [{ hosts: ['playwright-dashboard-0.stamhoofd'], port: 6100 }],
            tlsSubjects: ['playwright-dashboard-0.stamhoofd'],
        });

        const config = await writeCaddyConfig(ctx);
        const caddyConfig = JSON.parse(await fs.readFile(config, 'utf8'));
        const hosts = routeHosts(caddyConfig);
        const subjects = caddyConfig.apps.tls.automation.policies[0].subjects;

        expect(hosts).toContain('dashboard.stamhoofd');
        expect(hosts).toContain('playwright-dashboard-0.stamhoofd');
        expect(subjects).toContain('dashboard.stamhoofd');
        expect(subjects).toContain('playwright-dashboard-0.stamhoofd');
    });

    it('includes all frontend app routes from active instance manifests', async () => {
        const ctx = context(rootDir);
        await writeInstanceManifest(ctx, {
            dashboard: 'feature.dashboard.stamhoofd',
            api: 'feature.api.stamhoofd',
            renderer: 'feature.renderer.stamhoofd',
            registration: 'feature.registration.stamhoofd',
            webshop: 'feature.shop.stamhoofd',
        });

        const config = await writeCaddyConfig(ctx);
        const caddyConfig = JSON.parse(await fs.readFile(config, 'utf8'));
        const hosts = routeHosts(caddyConfig);

        expect(hosts).toContain('feature.dashboard.stamhoofd');
        expect(hosts).toContain('feature.api.stamhoofd');
        expect(hosts).toContain('*.feature.api.stamhoofd');
        expect(hosts).toContain('feature.renderer.stamhoofd');
        expect(hosts).toContain('feature.registration.stamhoofd');
        expect(hosts).toContain('*.feature.registration.stamhoofd');
        expect(hosts).toContain('feature.shop.stamhoofd');
    });
});

function routeHosts(caddyConfig: any): string[] {
    return caddyConfig.apps.http.servers.stamhoofd.routes.flatMap((route: any) => route.match.flatMap((match: any) => match.host));
}

function context(rootDir: string): CliContext {
    return {
        rootDir,
        generatedDir: path.join(rootDir, 'generated'),
        env: 'stamhoofd',
        workspace: 'test',
        verbose: false,
        instance: {
            name: 'test',
            prefix: '',
            primary: true,
            portOffset: 0,
        },
    };
}
