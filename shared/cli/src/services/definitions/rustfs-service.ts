import { buildPorts } from '../../context/ports.js';
import { defaultDomain, localFilesAccessKey, localFilesSecretKey, localhostPortMapping, rustfsContainer, rustfsDataVolume, rustfsImage, rustfsInternalApiPort, rustfsInternalConsolePort } from '../../config/shared-service-config.js';
import { link } from '../../runtime/ux.js';
import * as docker from '../docker.js';
import { SharedDockerService } from '../docker-service.js';
import type { CliContext } from '../../context/create-context.js';

export class RustfsService extends SharedDockerService {
    static readonly container = rustfsContainer;

    readonly key = 'rustfs';
    readonly name = 'RustFS';

    getContainer(): string {
        return RustfsService.container;
    }

    getDetail(): string {
        const domain = process.env.STAMHOOFD_DOMAIN ?? defaultDomain;
        return link(`https://files.${domain}`, `https://files.${domain}`);
    }

    getLogin(): string {
        return `${localFilesAccessKey} / ${localFilesSecretKey}`;
    }

    getDockerArgs(context: CliContext): string[] {
        const ports = buildPorts(context);
        return RustfsService.dockerArgs(ports.rustfs, ports.rustfsConsole);
    }

    async beforeRun(context: CliContext): Promise<void> {
        await docker.createVolume(rustfsDataVolume, context.verbose);
    }

    static dockerArgs(apiPort: number, consolePort: number): string[] {
        return ['run', '-d', '--name', RustfsService.container, '-p', localhostPortMapping(apiPort, rustfsInternalApiPort), '-p', localhostPortMapping(consolePort, rustfsInternalConsolePort), '-v', `${rustfsDataVolume}:/data`, '-e', `RUSTFS_ACCESS_KEY=${localFilesAccessKey}`, '-e', `RUSTFS_SECRET_KEY=${localFilesSecretKey}`, '-e', 'RUSTFS_CONSOLE_ENABLE=true', rustfsImage, '/data'];
    }
}

export const rustfsService = new RustfsService();
