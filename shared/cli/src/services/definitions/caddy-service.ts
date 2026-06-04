import fs from 'node:fs/promises';
import type { CliContext } from '../../context/create-context.js';
import { caddyAdminPort, caddyConfigPath, caddyContainer, caddyDataDir, caddyDataDirInContainer, caddyHttpPort, caddyHttpsPort, caddyImage, caddyPodmanHttpPort, caddyPodmanHttpsPort, dockerHostGateway, localhostPort, localhostPortMapping } from '../../config/shared-service-config.js';
import * as docker from '../docker.js';
import { writeCaddyConfig } from '../../config/caddy-config.js';
import { SharedDockerService } from '../docker-service.js';
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
        if (await docker.getContainerRuntime() === 'podman') {
            return `${localhostPort(caddyHttpPort)} -> ${localhostPort(caddyPodmanHttpPort)}, ${localhostPort(caddyHttpsPort)} -> ${localhostPort(caddyPodmanHttpsPort)}`;
        }
        return `${localhostPort(caddyHttpPort)}, ${localhostPort(caddyHttpsPort)}`;
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
        if (process.platform !== 'linux' && await docker.getContainerRuntime() !== 'podman') {
            // Bridge mode on macOS: reuse if NOT in host network mode.
            return !await CaddyService.runsInHostNetwork();
        }
        return await CaddyService.runsInHostNetwork();
    }

    async getDockerArgs(_context: CliContext, _options: void, prepared: CaddyPrepared): Promise<string[]> {
        const runtime = await docker.getContainerRuntime();
        const bridgeMode = process.platform !== 'linux' && runtime !== 'podman';
        return CaddyService.dockerArgs(prepared.config, prepared.dataDir, { disableLabel: runtime === 'podman', bridgeMode });
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

    private static async writeRuntimeConfig(context: CliContext): Promise<string> {
        if (await docker.getContainerRuntime() === 'podman') {
            return await writeCaddyConfig(context, { httpPort: caddyPodmanHttpPort, httpsPort: caddyPodmanHttpsPort, disableRedirects: true });
        }
        if (process.platform !== 'linux') {
            // Docker Desktop on macOS uses a VM — --network host binds inside the VM,
            // not on the Mac. Use bridge mode with port mappings and route to the Mac
            // host via host.docker.internal.
            return await writeCaddyConfig(context, { proxyHost: dockerHostGateway, listenHost: '0.0.0.0' });
        }
        return await writeCaddyConfig(context);
    }

    static dockerArgs(config: string, dataDir: string, options: { disableLabel?: boolean; bridgeMode?: boolean } = {}): string[] {
        if (options.bridgeMode) {
            return ['run', '-d', '--name', CaddyService.container, '-p', localhostPortMapping(caddyHttpPort, caddyHttpPort), '-p', localhostPortMapping(caddyHttpsPort, caddyHttpsPort), '-v', `${config}:${caddyConfigPath}:ro`, '-v', `${dataDir}:${caddyDataDirInContainer}`, caddyImage, 'caddy', 'run', '--config', caddyConfigPath, '--watch'];
        }
        return ['run', '-d', '--name', CaddyService.container, '--network', 'host', ...(options.disableLabel ? ['--security-opt', 'label=disable'] : []), '-v', `${config}:${caddyConfigPath}:ro`, '-v', `${dataDir}:${caddyDataDirInContainer}`, caddyImage, 'caddy', 'run', '--config', caddyConfigPath, '--watch'];
    }

    private static async validateConfig(config: string, context: CliContext): Promise<void> {
        const labelArgs = await docker.getContainerRuntime() === 'podman' ? ['--security-opt', 'label=disable'] : [];
        await docker.run(['run', '--rm', ...labelArgs, '-v', `${config}:${caddyConfigPath}:ro`, caddyImage, 'caddy', 'validate', '--config', caddyConfigPath], { quiet: true, verbose: context.verbose });
    }

    static dataDir(): string {
        return caddyDataDir();
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
