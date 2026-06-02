import fs from 'node:fs/promises';
import path from 'node:path';
import type { CliContext } from '../../context/create-context.js';
import { corednsContainer, corednsHostPort, corednsImage, corednsPort, defaultDomain, localIpv4Host, localIpv6Host, localhostPort, localhostPortMapping } from '../../config/shared-service-config.js';
import { sharedDir } from '../../runtime/manifest-store.js';
import * as docker from '../docker.js';
import { SharedDockerService } from '../docker-service.js';

type CorednsPrepared = {
    corefile: string;
};

export class CorednsService extends SharedDockerService<CorednsPrepared> {
    static readonly container = corednsContainer;

    readonly key = 'coredns';
    readonly name = 'CoreDNS';

    getContainer(): string {
        return CorednsService.container;
    }

    getDetail(): string {
        return localhostPort(corednsHostPort);
    }

    async prepare(context: CliContext): Promise<CorednsPrepared> {
        const corefile = path.join(sharedDir(context), 'Corefile');
        const domain = process.env.STAMHOOFD_DOMAIN ?? defaultDomain;
        await fs.mkdir(path.dirname(corefile), { recursive: true });
        await fs.chmod(path.dirname(corefile), 0o755);
        await fs.writeFile(corefile, `${domain} {\n    log\n    template IN A {\n        answer "{{ .Name }} 300 IN A ${localIpv4Host}"\n    }\n    template IN AAAA {\n        answer "{{ .Name }} 300 IN AAAA ${localIpv6Host}"\n    }\n}\n. {\n    forward . 8.8.8.8 9.9.9.9\n}\n`, { mode: 0o644 });
        await fs.chmod(corefile, 0o644);
        return { corefile };
    }

    async getDockerArgs(_context: CliContext, _options: void, prepared: CorednsPrepared): Promise<string[]> {
        return CorednsService.dockerArgs(prepared.corefile, { disableLabel: await docker.getContainerRuntime() === 'podman' });
    }

    static dockerArgs(corefile: string, options: { disableLabel?: boolean } = {}): string[] {
        return ['run', '-d', '--name', CorednsService.container, ...(options.disableLabel ? ['--security-opt', 'label=disable'] : []), '-p', `${localhostPortMapping(corednsHostPort, corednsPort)}/udp`, '-p', `${localhostPortMapping(corednsHostPort, corednsPort)}/tcp`, '-v', `${corefile}:/Corefile:ro`, corednsImage, '-conf', '/Corefile'];
    }
}

export const corednsService = new CorednsService();
