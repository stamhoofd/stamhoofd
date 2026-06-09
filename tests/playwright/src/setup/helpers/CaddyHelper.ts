import { exec as execCallback } from 'node:child_process';
import { promisify } from 'node:util';
import { buildSharedServiceProfile, CaddyService, caddyAdminPort, createContext, getContainerRuntime, localIpv4Host, pruneStaleRouteManifests, removeRouteManifestsByKind, writeRouteManifest, buildCaddyServiceProfile } from '@stamhoofd/cli';
import type { RouteManifest } from '@stamhoofd/cli';
import { CaddyConfigHelper } from './CaddyConfigHelper.js';
import { ProcessInfo } from './ProcessInfo.js';
import { STChildProcess } from './STChildProcess.js';

const exec = promisify(execCallback);

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

        // post the initial config
        console.log('Start posting caddy config...');
        await this.postConfig(
            CaddyConfigHelper.createDefault({
                adminListen: this.caddyRuntime.adminListen,
                adminOrigin: this.caddyRuntime.adminUrl,
                httpListen: this.caddyRuntime.httpListen,
                httpsListen: this.caddyRuntime.httpsListen,
                proxyHost: this.caddyRuntime.proxyHost,
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
        await removeRouteManifestsByKind(context, 'playwright-worker');
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

    private async configureSharedCaddy(workerCount: number) {
        const context = await createContext({ env: 'stamhoofd', verbose: false });
        await pruneStaleRouteManifests(context);
        await removeRouteManifestsByKind(context, 'playwright-worker');

        for (let workerId = 0; workerId < workerCount; workerId += 1) {
            await writeRouteManifest(context, this.createWorkerManifest(workerId));
        }

        await CaddyService.reload(context);
    }

    private createWorkerManifest(workerId: number): RouteManifest {
        const id = workerId.toString();
        const profile = buildCaddyServiceProfile();

        const caddy = CaddyConfigHelper.createRouteOptions({
            proxyHost: profile.caddyProxyHost,
        });

        return {
            version: '2',
            name: `playwright-worker-${id}`,
            kind: 'playwright-worker',
            pid: process.pid,
            startedAt: new Date().toISOString(),
            expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
            rootPath: process.cwd(),
            workspace: 'playwright',
            caddy,
        };
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
