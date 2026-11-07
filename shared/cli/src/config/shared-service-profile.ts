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

/**
 * The HTTP protocols Caddy may serve, or undefined to leave it at its own default.
 *
 * Bridge mode publishes the HTTPS port over TCP only, so an advertised HTTP/3 endpoint is
 * unreachable: a browser that takes the Alt-Svc offer (Chrome does, eagerly) talks QUIC to a UDP
 * port nothing listens on and retries until it fails the navigation. Host network mode has no port
 * mapping to leave out, so h3 stays enabled there.
 */
export function caddyProtocols(profile: CaddyServiceProfile): string[] | undefined {
    if (profile.caddyRunMode === SharedServiceCaddyRunMode.Bridge) {
        return ['h1', 'h2'];
    }
    return undefined;
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
