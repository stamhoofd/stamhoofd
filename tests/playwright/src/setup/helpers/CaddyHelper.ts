import { exec as execCallback } from 'node:child_process';
import { promisify } from 'node:util';
import { buildSharedServiceProfile, CaddyService, caddyAdminPort, createContext, getContainerRuntime, localIpv4Host, removeOwnRouteManifests, buildCaddyServiceProfile } from '@stamhoofd/cli';
import type { RouteManifestInput } from '@stamhoofd/cli';
import { CaddyConfigHelper, slotPoolSize } from './CaddyConfigHelper.js';
import { ProcessInfo } from './ProcessInfo.js';
import { STChildProcess } from './STChildProcess.js';

const exec = promisify(execCallback);

/**
 * A reservation outlives the run that made it only if that run crashed hard: the manifest is
 * removed on teardown and ignored as soon as the process is gone. The expiry is the last resort
 * for a machine that was put to sleep mid-run and woke up with the pid recycled.
 */
const reservationLifetimeMs = 2 * 60 * 60 * 1000;
const routesActiveTimeoutMs = 60_000;

type CaddyRuntime = {
    adminUrl: string;
    adminListen: string;
    httpListen: string;
    httpsListen: string;
    proxyHost: string;
};

export class CaddyHelper {
    private caddyRuntime: CaddyRuntime | undefined;
    private serverName = 'stamhoofd';

    async isRunning() {
        const runtime = await this.getRunningRuntime();
        if (runtime) {
            this.caddyRuntime = runtime;
            return true;
        }
        return false;
    }

    async configure(workerCount: number) {
        this.caddyRuntime ??= await this.getRunningRuntime();
        if (!this.caddyRuntime) {
            throw new Error('Shared Caddy admin endpoint is not reachable. Run `yarn stam services up` first.');
        }

        if (!ProcessInfo.didStartCaddy) {
            await this.configureSharedCaddy(workerCount);
            return;
        }

        // This Caddy was started by this run and serves nothing else, so the first slots are free.
        CaddyConfigHelper.setSlotBlock(0, workerCount);

        // post the initial config
        console.log('Start posting caddy config...');
        await this.postConfig(
            CaddyConfigHelper.createDefault({
                adminListen: this.caddyRuntime.adminListen,
                adminOrigin: this.caddyRuntime.adminUrl,
                httpListen: this.caddyRuntime.httpListen,
                httpsListen: this.caddyRuntime.httpsListen,
                proxyHost: this.caddyRuntime.proxyHost,
                workerCount,
            }),
        );
        console.log('Done posting caddy config.');
    }

    async cleanup() {
        if (ProcessInfo.didStartCaddy) {
            await this.stop();
            return;
        }

        const context = await createContext({ env: 'stamhoofd', verbose: false });

        // Only the reservation of this run: a run in another worktree is still using its own slots.
        await removeOwnRouteManifests(context, 'playwright-worker');
        await CaddyService.reload(context);
    }

    async start() {
        if (process.env.CI !== 'true') {
            throw new Error('Shared Caddy is not running. Run `yarn stam services up` first.');
        }

        const runtime = this.createHostCaddyRuntime();
        const childProcess = new STChildProcess('caddy', ['run']);
        childProcess.enableLog();
        ProcessInfo.flagCaddyStarted();

        for (let i = 0; i < 60; i += 1) {
            if (await this.canReachAdmin(runtime)) {
                this.caddyRuntime = runtime;
                return;
            }
            await new Promise(resolve => setTimeout(resolve, 250));
        }

        throw new Error('Timed out waiting for CI Caddy admin endpoint to start.');
    }

    async stop() {
        try {
            await exec('caddy stop');
        } catch (error) {
            // Ignore stop failures: Caddy may already have exited with the parent process.
        }
    }

    /**
     * Claim a block of slots for this run and add its routes to the shared Caddy.
     *
     * The block is picked by the CLI: it tries consecutive blocks until it finds one that no other
     * manifest reserves and whose ports can all be bound, then writes the manifest for it. Only
     * after that are the ports and domains of this run fixed, so nothing may derive a port or
     * domain before this ran (which is why the slot offset is set from inside the candidate).
     */
    private async configureSharedCaddy(workerCount: number) {
        const context = await createContext({ env: 'stamhoofd', verbose: false });

        // Leftovers of an earlier setup attempt in this same process.
        await removeOwnRouteManifests(context, 'playwright-worker');

        const manifest = await CaddyService.reserveRouteManifest(context, {
            buildManifest: attempt => this.createRunManifest(context.instance.name, attempt, workerCount),
        });

        const offset = CaddyConfigHelper.getSlotOffset();
        console.log(`Reserved playwright slots ${offset}-${offset + workerCount - 1} (${manifest.name}).`);

        await CaddyService.reload(context);
        await this.waitUntilRoutesActive(workerCount);
    }

    /**
     * The manifest of this run for attempt `attempt`: the same manifest every time, but starting
     * at the next slot. Returns undefined once the remaining slots no longer fit this run.
     */
    private createRunManifest(instanceName: string, attempt: number, workerCount: number): RouteManifestInput | undefined {
        if (attempt + workerCount > slotPoolSize) {
            return undefined;
        }

        CaddyConfigHelper.setSlotBlock(attempt, workerCount);
        const profile = buildCaddyServiceProfile();

        return {
            // One manifest per run (not per worker): all workers share the same reserved block.
            name: `playwright-${instanceName}-${process.pid}`,
            kind: 'playwright-worker',
            pid: process.pid,
            startedAt: new Date().toISOString(),
            expiresAt: new Date(Date.now() + reservationLifetimeMs).toISOString(),
            rootPath: process.cwd(),
            workspace: 'playwright',
            reservedPorts: CaddyConfigHelper.getReservedPorts(workerCount),
            caddy: CaddyConfigHelper.createRouteOptions({
                proxyHost: profile.caddyProxyHost,
                workerCount,
            }),
        };
    }

    /**
     * Wait until the shared Caddy serves the hosts of this run. A reload is applied asynchronously
     * and another process may be reloading at the same time, so the services must not start (and
     * report an unreachable URL) before the routes are really in place.
     */
    private async waitUntilRoutesActive(workerCount: number) {
        const expectedHosts = [CaddyConfigHelper.getSsoDomain()];
        for (let workerId = 0; workerId < workerCount; workerId += 1) {
            expectedHosts.push(CaddyConfigHelper.getDomain('api', workerId.toString()));
        }

        const start = Date.now();
        let missing: string[] = expectedHosts;

        while (Date.now() - start < routesActiveTimeoutMs) {
            const configured = JSON.stringify(await this.getRoutes());
            // The hosts sit in matchers of nested subroutes, so a lookup in the serialized routes
            // is both simpler and stricter than walking every handler type.
            missing = expectedHosts.filter(host => !configured.includes(`"${host}"`));
            if (missing.length === 0) {
                return;
            }
            await new Promise(resolve => setTimeout(resolve, 250));
        }

        throw new Error(`Timed out waiting for Caddy to serve the routes of this run. Missing: ${missing.join(', ')}`);
    }

    private async postConfig(caddyConfig: any) {
        const url = `${this.getAdminUrl()}/load`;

        const res = await fetch(url, {
            method: 'POST',
            headers: this.getAdminHeaders(),
            body: JSON.stringify(caddyConfig),
        });

        if (!res.ok) {
            const text = await res.text();
            throw new Error(
                `Failed to post config: ${res.status} ${res.statusText} - ${text}`,
            );
        }
    }

    private async getPolicySubjects() {
        const url = `${this.getAdminUrl()}/config/apps/tls/automation/policies/0/subjects`;
        const result = await fetch(url, { headers: this.getAdminHeaders() });
        const policySubjects: string[] = await result.json();
        return policySubjects;
    }

    private async getRoutes() {
        const url = `${this.getAdminUrl()}/config/apps/http/servers/${this.serverName}/routes`;
        const result = await fetch(url, { headers: this.getAdminHeaders() });
        const routes: { group?: string; match?: any[] }[] = await result.json();
        return routes;
    }

    private async getConfig() {
        const url = `${this.getAdminUrl()}/config`;
        const result = await fetch(url, { headers: this.getAdminHeaders() });
        return await result.json();
    }

    async logConfig() {
        const config = await this.getConfig();
        console.log(JSON.stringify(config, null, 2));
    }

    async deleteRoutesWhere(predicate: (route: { group?: string }) => boolean) {
        const routes = await this.getRoutes();
        const routesToKeep = routes.filter(r => !predicate(r));

        const url = `${this.getAdminUrl()}/config/apps/http/servers/${this.serverName}/routes`;

        const res = await fetch(url, {
            method: 'PATCH',
            headers: this.getAdminHeaders(),
            body: JSON.stringify(routesToKeep),
        });

        if (!res.ok) {
            const text = await res.text();
            throw new Error(
                `Failed to patch: ${res.status} ${res.statusText} - ${text}`,
            );
        }
    }

    async deletePolicySubjectsWhere(predicate: (subject: string) => boolean) {
        const subjects = await this.getPolicySubjects();
        const subjectsToKeep = subjects.filter(s => !predicate(s));

        const url = `${this.getAdminUrl()}/config/apps/tls/automation/policies/0/subjects`;

        const res = await fetch(url, {
            method: 'PATCH',
            headers: this.getAdminHeaders(),
            body: JSON.stringify(subjectsToKeep),
        });

        if (!res.ok) {
            const text = await res.text();
            throw new Error(
                `Failed to patch: ${res.status} ${res.statusText} - ${text}`,
            );
        }
    }

    private getAdminUrl() {
        if (!this.caddyRuntime) {
            throw new Error('Caddy admin endpoint is not configured.');
        }
        return this.caddyRuntime.adminUrl;
    }

    private async getRunningRuntime() {
        const sharedCaddyRuntime = await this.createSharedCaddyRuntime();
        if (await this.canReachAdmin(sharedCaddyRuntime)) {
            return sharedCaddyRuntime;
        }
        if (process.env.CI === 'true') {
            const hostCaddyRuntime = this.createHostCaddyRuntime();
            if (await this.canReachAdmin(hostCaddyRuntime)) {
                return hostCaddyRuntime;
            }
        }
        return undefined;
    }

    private async createSharedCaddyRuntime(): Promise<CaddyRuntime> {
        const profile = buildSharedServiceProfile(await getContainerRuntime());
        return {
            adminUrl: `http://${localIpv4Host}:${caddyAdminPort}`,
            adminListen: `${profile.caddyAdminListenHost}:${caddyAdminPort}`,
            httpListen: `${profile.caddyListenHost}:${profile.caddyHttpListenPort}`,
            httpsListen: `${profile.caddyListenHost}:${profile.caddyHttpsListenPort}`,
            proxyHost: profile.caddyProxyHost,
        };
    }

    private createHostCaddyRuntime(): CaddyRuntime {
        return {
            adminUrl: `http://${localIpv4Host}:${caddyAdminPort}`,
            adminListen: `${localIpv4Host}:${caddyAdminPort}`,
            httpListen: ':80',
            httpsListen: ':443',
            proxyHost: localIpv4Host,
        };
    }

    private async canReachAdmin(runtime: CaddyRuntime) {
        try {
            const res = await fetch(`${runtime.adminUrl}/config`, {
                headers: this.getAdminHeaders(runtime),
                signal: AbortSignal.timeout(1_000),
            });
            return res.ok;
        } catch (error) {
            return false;
        }
    }

    private getAdminHeaders(runtime = this.caddyRuntime) {
        if (!runtime) {
            throw new Error('Caddy admin endpoint is not configured.');
        }
        return {
            'Content-Type': 'application/json',
            'Origin': runtime.adminUrl,
        };
    }
}
