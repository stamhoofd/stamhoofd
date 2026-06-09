import fs from 'node:fs/promises';
import { buildCaddyRouteOptions, writeCaddyConfig } from '../../config/caddy-config.js';
import { caddyAdminPort, caddyConfigPath, caddyContainer, caddyDataDir, caddyDataDirInContainer, caddyImage, localhostPort, localhostPortMapping } from '../../config/shared-service-config.js';
import type { SharedServiceProfile } from '../../config/shared-service-profile.js';
import { buildCaddyServiceProfile, buildSharedServiceProfile, SharedServiceCaddyRunMode } from '../../config/shared-service-profile.js';
import type { CliContext } from '../../context/create-context.js';
import type { CaddyRouteOptions } from '../../runtime/manifest-store.js';
import { SharedDockerService } from '../docker-service.js';
import * as docker from '../docker.js';
import type { ServiceStatus } from '../service.js';

type CaddyPrepared = {
    config: string;
    dataDir: string;
};

export class CaddyService extends SharedDockerService<CaddyPrepared> {
    static readonly container = caddyContainer;

    readonly key = 'caddy';
    readonly name = 'Caddy';

    getContainer(): string {
        return CaddyService.container;
    }

    async getDetail(): Promise<string> {
        const profile = buildSharedServiceProfile(await docker.getContainerRuntime());
        const admin = `admin ${localhostPort(caddyAdminPort)}`;
        if (profile.needsPrivilegedRedirects) {
            return `HTTP ${localhostPort(80)} -> ${localhostPort(profile.caddyHttpHostPort)}, HTTPS ${localhostPort(443)} -> ${localhostPort(profile.caddyHttpsHostPort)}, ${admin}`;
        }
        return `HTTP ${localhostPort(profile.caddyHttpHostPort)}, HTTPS ${localhostPort(profile.caddyHttpsHostPort)}, ${admin}`;
    }

    async prepare(context: CliContext): Promise<CaddyPrepared> {
        const config = await CaddyService.writeRuntimeConfig(context);
        const dataDir = CaddyService.dataDir();
        await fs.mkdir(dataDir, { recursive: true });
        await CaddyService.validateConfig(config, context);
        return { config, dataDir };
    }

    async canReuse(_context: CliContext, _options: void, _prepared: CaddyPrepared, status: ServiceStatus): Promise<boolean> {
        if (!status.running) {
            return false;
        }
        const profile = buildCaddyServiceProfile();
        if (profile.caddyRunMode === SharedServiceCaddyRunMode.Bridge) {
            return !await CaddyService.runsInHostNetwork();
        }
        return await CaddyService.runsInHostNetwork();
    }

    async getDockerArgs(_context: CliContext, _options: void, prepared: CaddyPrepared): Promise<string[]> {
        const runtime = await docker.getContainerRuntime();
        const profile = buildSharedServiceProfile(runtime);
        return CaddyService.dockerArgs(prepared.config, prepared.dataDir, profile, { disableLabel: runtime === docker.ContainerRuntime.Podman });
    }

    static async reload(context: CliContext): Promise<void> {
        const config = await CaddyService.writeRuntimeConfig(context);
        await CaddyService.validateConfig(config, context);
        if (await docker.containerIsRunning(CaddyService.container)) {
            await docker.run(['exec', CaddyService.container, 'caddy', 'reload', '--config', caddyConfigPath, '--address', localhostPort(caddyAdminPort), '--force'], { quiet: true, verbose: context.verbose });
            return;
        }
        await caddyService.start(context, undefined);
    }

    static buildRouteOptions(context: CliContext): CaddyRouteOptions {
        const profile = buildCaddyServiceProfile();
        return buildCaddyRouteOptions(context, {
            proxyHost: profile.caddyProxyHost,
        });
    }

    private static async writeRuntimeConfig(context: CliContext): Promise<string> {
        const profile = buildSharedServiceProfile(await docker.getContainerRuntime());
        return await writeCaddyConfig(context, {
            httpPort: profile.caddyHttpListenPort,
            httpsPort: profile.caddyHttpsListenPort,
            disableRedirects: profile.needsPrivilegedRedirects,
            proxyHost: profile.caddyProxyHost,
            listenHost: profile.caddyListenHost,
            adminListenHost: profile.caddyAdminListenHost,
            adminOrigin: `http://${localhostPort(caddyAdminPort)}`,
        });
    }

    static dockerArgs(config: string, dataDir: string, profile: SharedServiceProfile, options: { disableLabel?: boolean } = {}): string[] {
        if (profile.caddyRunMode === SharedServiceCaddyRunMode.Bridge) {
            return ['run', '-d', '--name', CaddyService.container, '-p', localhostPortMapping(profile.caddyHttpHostPort, profile.caddyHttpListenPort), '-p', localhostPortMapping(profile.caddyHttpsHostPort, profile.caddyHttpsListenPort), '-p', localhostPortMapping(caddyAdminPort, caddyAdminPort), '-v', `${config}:${caddyConfigPath}:ro`, '-v', `${dataDir}:${caddyDataDirInContainer}`, caddyImage, 'caddy', 'run', '--config', caddyConfigPath, '--watch'];
        }
        return ['run', '-d', '--name', CaddyService.container, '--network', 'host', ...(options.disableLabel ? ['--security-opt', 'label=disable'] : []), '-v', `${config}:${caddyConfigPath}:ro`, '-v', `${dataDir}:${caddyDataDirInContainer}`, caddyImage, 'caddy', 'run', '--config', caddyConfigPath, '--watch'];
    }

    private static async validateConfig(config: string, context: CliContext): Promise<void> {
        const labelArgs = await docker.getContainerRuntime() === docker.ContainerRuntime.Podman ? ['--security-opt', 'label=disable'] : [];
        await docker.run(['run', '--rm', ...labelArgs, '-v', `${config}:${caddyConfigPath}:ro`, caddyImage, 'caddy', 'validate', '--config', caddyConfigPath], { quiet: true, verbose: context.verbose });
    }

    static dataDir(): string {
        return caddyDataDir();
    }

    static adminUrl(): string {
        return `http://${localhostPort(caddyAdminPort)}`;
    }

    static async fetchAdmin(path: string, init: RequestInit = {}): Promise<Response> {
        const headers = new Headers(init.headers);
        if (!headers.has('Origin')) {
            headers.set('Origin', CaddyService.adminUrl());
        }

        return await fetch(`${CaddyService.adminUrl()}${path.startsWith('/') ? path : `/${path}`}`, { ...init, headers });
    }

    private static async runsInHostNetwork(): Promise<boolean> {
        if (!(await docker.containerIsRunning(CaddyService.container))) {
            return false;
        }
        const result = await docker.run(['inspect', '-f', '{{.HostConfig.NetworkMode}}', CaddyService.container], { capture: true, allowFailure: true });
        return result.stdout.trim() === 'host';
    }
}

export const caddyService = new CaddyService();
