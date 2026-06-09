import { caddyHttpPort, caddyHttpsPort, caddyUnprivilegedHttpPort, caddyUnprivilegedHttpsPort, corednsPrivilegedHostPort, corednsUnprivilegedHostPort, dockerHostGateway, localIpv4Host } from './shared-service-config.js';
import type { ContainerRuntime } from '../services/docker.js';

export enum SharedServiceCaddyRunMode {
    HostNetwork = 'host-network',
    Bridge = 'bridge',
}

export enum SharedServiceDnsSetupKind {
    SystemdResolved = 'systemd-resolved',
    MacosResolver = 'macos-resolver',
}

export type CaddyServiceProfile = {
    caddyHttpHostPort: number;
    caddyHttpsHostPort: number;
    caddyHttpListenPort: number;
    caddyHttpsListenPort: number;
    caddyAdminListenHost: string;
    caddyProxyHost: string;
    caddyListenHost: string;
    caddyRunMode: SharedServiceCaddyRunMode;
};

export type SharedServiceProfile = {
    platform: NodeJS.Platform;
    runtime: ContainerRuntime;
    corednsHostPort: number;
    needsPrivilegedRedirects: boolean;
    dnsSetupKind: SharedServiceDnsSetupKind;
} & CaddyServiceProfile;

export function buildCaddyServiceProfile(platform: NodeJS.Platform = process.platform): CaddyServiceProfile {
    if (platform === 'darwin') {
        return {
            caddyHttpHostPort: caddyHttpPort,
            caddyHttpsHostPort: caddyHttpsPort,
            caddyHttpListenPort: caddyHttpPort,
            caddyHttpsListenPort: caddyHttpsPort,
            caddyAdminListenHost: '0.0.0.0',
            caddyProxyHost: dockerHostGateway,
            caddyListenHost: '0.0.0.0',
            caddyRunMode: SharedServiceCaddyRunMode.Bridge,
        };
    }

    return {
        caddyHttpHostPort: caddyUnprivilegedHttpPort,
        caddyHttpsHostPort: caddyUnprivilegedHttpsPort,
        caddyHttpListenPort: caddyUnprivilegedHttpPort,
        caddyHttpsListenPort: caddyUnprivilegedHttpsPort,
        caddyAdminListenHost: localIpv4Host,
        caddyProxyHost: localIpv4Host,
        caddyListenHost: localIpv4Host,
        caddyRunMode: SharedServiceCaddyRunMode.HostNetwork,
    };
}

export function buildSharedServiceProfile(runtime: ContainerRuntime, platform: NodeJS.Platform = process.platform): SharedServiceProfile {
    if (platform === 'darwin') {
        return {
            platform,
            runtime,
            corednsHostPort: corednsPrivilegedHostPort,
            needsPrivilegedRedirects: false,
            dnsSetupKind: SharedServiceDnsSetupKind.MacosResolver,
            ...buildCaddyServiceProfile(platform),
        };
    }

    return {
        platform,
        runtime,
        corednsHostPort: corednsUnprivilegedHostPort,
        needsPrivilegedRedirects: true,
        dnsSetupKind: SharedServiceDnsSetupKind.SystemdResolved,
        ...buildCaddyServiceProfile(platform),
    };
}
