import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { CliContext } from '../context/create-context.js';
import { registerServiceRoutes, RouteManifestKind, writeRouteManifest } from '../runtime/manifest-store.js';
import { caddyAdminPort, localhostPort } from './shared-service-config.js';
import { buildCaddyConfig, writeCaddyConfig } from './caddy-config.js';

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
        await registerServiceRoutes(ctx, {
            name: 'test',
            kind: RouteManifestKind.DevInstance,
            routes: [{ hosts: ['dashboard.stamhoofd'], port: 8080 }],
        });
        await writeRouteManifest(ctx, {
            version: '2',
            name: 'playwright-worker-0',
            kind: RouteManifestKind.PlaywrightWorker,
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

    it('includes all frontend app routes from active dev instance manifests', async () => {
        const ctx = context(rootDir);
        await registerServiceRoutes(ctx, {
            name: 'feature',
            kind: RouteManifestKind.DevInstance,
            routes: [
                { hosts: ['feature.renderer.stamhoofd'], port: 9093 },
                { hosts: ['feature.api.stamhoofd', '*.feature.api.stamhoofd'], port: 9091 },
                { hosts: ['feature.dashboard.stamhoofd'], port: 8080 },
                { hosts: ['feature.registration.stamhoofd', '*.feature.registration.stamhoofd'], port: 8080 },
                { hosts: ['feature.shop.stamhoofd'], port: 8082 },
            ],
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

    it('routes SGV login and admin domains to the SGV mock', async () => {
        const ctx = context(rootDir);
        await registerServiceRoutes(ctx, {
            name: 'test-sgv-mock',
            kind: RouteManifestKind.SgvMock,
            routes: [
                { hosts: ['login.sgv.stamhoofd'], port: 9094 },
                { hosts: ['admin.sgv.stamhoofd'], port: 9094 },
            ],
        });

        const config = await buildCaddyConfig(ctx);
        const routes = config.apps.http.servers.stamhoofd.routes;
        const subjects = config.apps.tls.automation.policies.flatMap(policy => policy.subjects);

        expect(routes).toContainEqual(expect.objectContaining({
            match: [{ host: ['login.sgv.stamhoofd'] }],
            handle: [{ handler: 'reverse_proxy', upstreams: [{ dial: '127.0.0.1:9094' }] }],
        }));
        expect(routes).toContainEqual(expect.objectContaining({
            match: [{ host: ['admin.sgv.stamhoofd'] }],
            handle: [{ handler: 'reverse_proxy', upstreams: [{ dial: '127.0.0.1:9094' }] }],
        }));
        expect(subjects).toEqual(expect.arrayContaining(['login.sgv.stamhoofd', 'admin.sgv.stamhoofd']));
    });

    it('keeps SGV routes for active SGV manifests', async () => {
        const ctx = context(rootDir);
        await registerServiceRoutes({
            ...ctx,
            workspace: 'feature',
            instance: {
                name: 'feature',
                prefix: 'feature',
                primary: false,
                portOffset: 1200,
            },
        }, {
            name: 'feature-sgv-mock',
            kind: RouteManifestKind.SgvMock,
            routes: [
                { hosts: ['login.sgv.feature.stamhoofd'], port: 10294 },
                { hosts: ['admin.sgv.feature.stamhoofd'], port: 10294 },
            ],
        });

        const config = await buildCaddyConfig(ctx);
        const routes = config.apps.http.servers.stamhoofd.routes;
        const subjects = config.apps.tls.automation.policies.flatMap(policy => policy.subjects);

        expect(routes).toContainEqual(expect.objectContaining({
            match: [{ host: ['login.sgv.feature.stamhoofd'] }],
            handle: [{ handler: 'reverse_proxy', upstreams: [{ dial: '127.0.0.1:10294' }] }],
        }));
        expect(routes).toContainEqual(expect.objectContaining({
            match: [{ host: ['admin.sgv.feature.stamhoofd'] }],
            handle: [{ handler: 'reverse_proxy', upstreams: [{ dial: '127.0.0.1:10294' }] }],
        }));
        expect(subjects).toEqual(expect.arrayContaining(['login.sgv.feature.stamhoofd', 'admin.sgv.feature.stamhoofd']));
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
