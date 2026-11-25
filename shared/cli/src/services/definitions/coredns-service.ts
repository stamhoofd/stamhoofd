import fs from 'node:fs/promises';
import path from 'node:path';
import type { CliContext } from '../../context/create-context.js';
import {
    corednsContainer,
    corednsImage,
    corednsPort,
    defaultDomain,
    localIpv4Host,
    localIpv6Host,
    localhostPort,
    localhostPortMapping,
} from '../../config/shared-service-config.js';
import { buildSharedServiceProfile } from '../../config/shared-service-profile.js';
import { sharedDir } from '../../runtime/manifest-store.js';
import * as docker from '../docker.js';
import { SharedDockerService } from '../docker-service.js';

type CorednsPrepared = {
    corefile: string;
};

/**
 * Answers every type the zone has no address for with an empty NOERROR. Without it those queries
 * fall off the end of the plugin chain and SERVFAIL, and a resolver that asks for A and AAAA in
 * parallel (Android does) fails the whole lookup on that SERVFAIL instead of using the A record.
 *
 * The authority section carries the zone SOA because RFC 2308 wants one in a no-data answer:
 * without it a strict resolver cannot conclude the record is absent and retries the query, which
 * Chrome on Android reports as ERR_TOO_MANY_RETRIES.
 *
 * The template plugin answers with the first template that matches, so this has to stay after the
 * address templates.
 */
const noDataCatchAll =
    '    template IN ANY {\n        rcode NOERROR\n        authority "{{ .Zone }} 60 IN SOA ns.dns.{{ .Zone }} hostmaster.{{ .Zone }} (1 60 60 60 60)"\n    }\n';

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

        if (process.env.PUBLIC_IP) {
            // PUBLIC_IP is IPv4-only, so the zone can only answer A.
            await fs.writeFile(
                corefile,
                `${domain} {\n    log\n    template IN A {\n        answer "{{ .Name }} 300 IN A ${process.env.PUBLIC_IP}"\n    }\n${noDataCatchAll}}\n. {\n    forward . 8.8.8.8 9.9.9.9\n}\n`,
                { mode: 0o644 },
            );
        } else {
            await fs.writeFile(
                corefile,
                `${domain} {\n    log\n    template IN A {\n        answer "{{ .Name }} 300 IN A ${localIpv4Host}"\n    }\n    template IN AAAA {\n        answer "{{ .Name }} 300 IN AAAA ${localIpv6Host}"\n    }\n${noDataCatchAll}}\n. {\n    forward . 8.8.8.8 9.9.9.9\n}\n`,
                { mode: 0o644 },
            );
        }
        await fs.chmod(corefile, 0o644);
        return { corefile };
    }

    async getDockerArgs(
        _context: CliContext,
        _options: void,
        prepared: CorednsPrepared,
    ): Promise<string[]> {
        const runtime = await docker.getContainerRuntime();
        const profile = buildSharedServiceProfile(runtime);
        return CorednsService.dockerArgs(prepared.corefile, profile.corednsHostPort, {
            disableLabel: runtime === docker.ContainerRuntime.Podman,
        });
    }

    static dockerArgs(
        corefile: string,
        hostPort: number,
        options: { disableLabel?: boolean } = {},
    ): string[] {
        return [
            'run',
            '-d',
            '--name',
            CorednsService.container,
            ...(options.disableLabel ? ['--security-opt', 'label=disable'] : []),
            '-p',
            `${localhostPortMapping(hostPort, corednsPort)}/udp`,
            '-p',
            `${localhostPortMapping(hostPort, corednsPort)}/tcp`,
            '-v',
            `${corefile}:/Corefile:ro`,
            corednsImage,
            '-conf',
            '/Corefile',
        ];
    }
}

export const corednsService = new CorednsService();
