import fs from 'node:fs/promises';
import path from 'node:path';
import type { CliContext } from '../../context/create-context.js';
import { corednsContainer, corednsImage, corednsPort, defaultDomain, localIpv4Host, localIpv6Host, localhostPort, localhostPortMapping } from '../../config/shared-service-config.js';
import { buildSharedServiceProfile } from '../../config/shared-service-profile.js';
import { sharedDir } from '../../runtime/manifest-store.js';
import * as docker from '../docker.js';
import { SharedDockerService } from '../docker-service.js';

type CorednsPrepared = {
    corefile: string;
};

export type CorednsRecord = {
    zone: string;
    type: 'A' | 'AAAA' | 'forward';
    value: string;
    appliesTo: string;
};

export class CorednsService extends SharedDockerService<CorednsPrepared> {
    static readonly container = corednsContainer;

    readonly key = 'coredns';
    readonly name = 'CoreDNS';

    getContainer(): string {
        return CorednsService.container;
    }

    async getDetail(): Promise<string> {
        const profile = buildSharedServiceProfile(await docker.getContainerRuntime());
        return localhostPort(profile.corednsHostPort);
    }

    async prepare(context: CliContext): Promise<CorednsPrepared> {
        const corefile = path.join(sharedDir(context), 'Corefile');
        const domain = process.env.STAMHOOFD_DOMAIN ?? defaultDomain;
        await fs.mkdir(path.dirname(corefile), { recursive: true });
        await fs.chmod(path.dirname(corefile), 0o755);
        await fs.writeFile(corefile, CorednsService.corefileContent(domain), { mode: 0o644 });
        await fs.chmod(corefile, 0o644);
        return { corefile };
    }

    static corefileContent(domain: string): string {
        const records = CorednsService.records(domain);
        const ipv4 = records.find(record => record.type === 'A')?.value ?? localIpv4Host;
        const ipv6 = records.find(record => record.type === 'AAAA')?.value ?? localIpv6Host;
        const upstreams = records.filter(record => record.type === 'forward').map(record => record.value).join(' ');
        return `${domain} {\n    log\n    template IN A {\n        answer "{{ .Name }} 300 IN A ${ipv4}"\n    }\n    template IN AAAA {\n        answer "{{ .Name }} 300 IN AAAA ${ipv6}"\n    }\n}\n. {\n    forward . ${upstreams}\n}\n`;
    }

    static records(domain: string): CorednsRecord[] {
        return [
            { zone: domain, type: 'A', value: localIpv4Host, appliesTo: `Every hostname under .${domain}` },
            { zone: domain, type: 'AAAA', value: localIpv6Host, appliesTo: `Every hostname under .${domain}` },
            { zone: '.', type: 'forward', value: '8.8.8.8', appliesTo: 'Non-local DNS forwarded upstream' },
            { zone: '.', type: 'forward', value: '9.9.9.9', appliesTo: 'Non-local DNS forwarded upstream' },
        ];
    }

    async getDockerArgs(_context: CliContext, _options: void, prepared: CorednsPrepared): Promise<string[]> {
        const runtime = await docker.getContainerRuntime();
        const profile = buildSharedServiceProfile(runtime);
        return CorednsService.dockerArgs(prepared.corefile, profile.corednsHostPort, { disableLabel: runtime === docker.ContainerRuntime.Podman });
    }

    static dockerArgs(corefile: string, hostPort: number, options: { disableLabel?: boolean } = {}): string[] {
        return ['run', '-d', '--name', CorednsService.container, ...(options.disableLabel ? ['--security-opt', 'label=disable'] : []), '-p', `${localhostPortMapping(hostPort, corednsPort)}/udp`, '-p', `${localhostPortMapping(hostPort, corednsPort)}/tcp`, '-v', `${corefile}:/Corefile:ro`, corednsImage, '-conf', '/Corefile'];
    }
}

export const corednsService = new CorednsService();
