import { caddyHttpPort, caddyHttpsPort, caddyUnprivilegedHttpPort, caddyUnprivilegedHttpsPort, corednsPrivilegedHostPort, corednsUnprivilegedHostPort, dockerHostGateway, localIpv4Host } from './shared-service-config.js';
import { ContainerRuntime } from '../services/docker.js';

export enum SharedServiceCaddyRunMode {
    HostNetwork = 'host-network',
    Bridge = 'bridge',
}

export enum SharedServiceDnsSetupKind {
    SystemdResolved = 'systemd-resolved',
    MacosResolver = 'macos-resolver',
}

export type SharedServiceProfile = {
    platform: NodeJS.Platform;
    runtime: ContainerRuntime;
    corednsHostPort: number;
    caddyHttpHostPort: number;
    caddyHttpsHostPort: number;
    caddyHttpListenPort: number;
    caddyHttpsListenPort: number;
    caddyProxyHost: string;
    caddyListenHost: string;
    caddyRunMode: SharedServiceCaddyRunMode;
    needsPrivilegedRedirects: boolean;
    dnsSetupKind: SharedServiceDnsSetupKind;
};

export function buildSharedServiceProfile(runtime: ContainerRuntime, platform: NodeJS.Platform = process.platform): SharedServiceProfile {
    if (platform === 'darwin') {
        return {
            platform,
            runtime,
            corednsHostPort: corednsPrivilegedHostPort,
            caddyHttpHostPort: caddyHttpPort,
            caddyHttpsHostPort: caddyHttpsPort,
            caddyHttpListenPort: caddyHttpPort,
            caddyHttpsListenPort: caddyHttpsPort,
            caddyProxyHost: dockerHostGateway,
            caddyListenHost: '0.0.0.0',
            caddyRunMode: SharedServiceCaddyRunMode.Bridge,
            needsPrivilegedRedirects: false,
            dnsSetupKind: SharedServiceDnsSetupKind.MacosResolver,
        };
    }

    return {
        platform,
        runtime,
        corednsHostPort: corednsUnprivilegedHostPort,
        caddyHttpHostPort: caddyUnprivilegedHttpPort,
        caddyHttpsHostPort: caddyUnprivilegedHttpsPort,
        caddyHttpListenPort: caddyUnprivilegedHttpPort,
        caddyHttpsListenPort: caddyUnprivilegedHttpsPort,
        caddyProxyHost: localIpv4Host,
        caddyListenHost: localIpv4Host,
        caddyRunMode: SharedServiceCaddyRunMode.HostNetwork,
        needsPrivilegedRedirects: true,
        dnsSetupKind: SharedServiceDnsSetupKind.SystemdResolved,
    };
}
