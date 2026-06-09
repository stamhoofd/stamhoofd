import fs from "node:fs/promises";
import dns from "node:dns/promises";
import path from "node:path";
import {
    defaultDomain,
    localIpv4Host,
    localhostPort,
} from "../config/shared-service-config.js";
import {
    buildSharedServiceProfile,
    SharedServiceDnsSetupKind,
    type SharedServiceProfile,
} from "../config/shared-service-profile.js";
import type { CliContext } from "../context/create-context.js";
import { run } from "../runtime/command-runner.js";
import {
    corednsService,
    CorednsService,
    type CorednsRecord,
} from "../services/definitions/coredns-service.js";
import * as docker from "../services/docker.js";

const directDnsQueryTimeoutMs = 1000;

/** Snapshot of expected and current DNS state used by `stam status` and setup diagnostics. */
export type DnsInspection = {
    domain: string;
    query: string;
    profile: SharedServiceProfile;
    expected: {
        corefile: string;
        records: CorednsRecord[];
        osConfigPath?: string;
        osConfigContent?: string;
    };
    current: {
        osConfigContent?: string;
        osConfigMatches: boolean;
        corednsRunning: boolean;
        directCorednsAddresses: string[];
        systemResolverAddresses: string[];
    };
    checks: DnsCheck[];
};

export type DnsCheck = {
    key: "os-config" | "coredns" | "direct-coredns" | "system-resolver";
    ok: boolean;
    label: string;
    details: string;
    fix?: string;
};

/** Checks OS resolver config, CoreDNS reachability, and system resolution separately so fixes can be targeted. */
export async function inspectDns(
    context: CliContext,
    options: { stopAfterOsConfigFailure?: boolean } = {},
): Promise<DnsInspection> {
    const domain = process.env.STAMHOOFD_DOMAIN ?? defaultDomain;
    const query = `dashboard.${domain}`;
    const profile = await currentSharedServiceProfile();
    const osConfig = expectedOsDnsConfig(domain, profile);
    const osConfigContent = osConfig.path
        ? await readFileIfExists(osConfig.path)
        : undefined;
    const osConfigMatches =
        osConfig.content !== undefined && osConfigContent === osConfig.content;
    const osCheck = osConfigCheck(
        domain,
        profile,
        osConfig.path,
        osConfigMatches,
        osConfigContent,
    );
    if (options.stopAfterOsConfigFailure && !osCheck.ok) {
        return buildInspection({
            domain,
            query,
            profile,
            osConfig,
            osConfigContent,
            osConfigMatches,
            corednsRunning: false,
            directCorednsAddresses: [],
            systemResolverAddresses: [],
            checks: [osCheck],
        });
    }

    const [corednsStatus, systemResolverAddresses] = await Promise.all([
        corednsService.status(context),
        systemResolverLookup(query, profile),
    ]);
    const corednsRunning = corednsStatus.running;
    const directCorednsAddresses = corednsRunning
        ? await directCorednsLookup(query, profile)
        : [];
    const directCorednsOk = directCorednsAddresses.includes(localIpv4Host);
    const systemResolverOk = systemResolverAddresses.includes(localIpv4Host);

    return buildInspection({
        domain,
        query,
        profile,
        osConfig,
        osConfigContent,
        osConfigMatches,
        corednsRunning,
        directCorednsAddresses,
        systemResolverAddresses,
        checks: [
            osCheck,
            {
                key: "coredns",
                label: "CoreDNS service",
                ok: corednsRunning,
                details: corednsRunning
                    ? "stamhoofd-coredns is running"
                    : "stamhoofd-coredns is not running",
                fix: corednsRunning ? undefined : "yarn stam services up",
            },
            {
                key: "direct-coredns",
                label: "Direct CoreDNS query",
                ok: directCorednsOk,
                details: directCorednsOk
                    ? `${query} -> ${localIpv4Host} via ${localhostPort(profile.corednsHostPort)}`
                    : `${query} did not resolve directly through CoreDNS at ${localhostPort(profile.corednsHostPort)}`,
                fix: directCorednsOk ? undefined : "yarn stam services restart",
            },
            {
                key: "system-resolver",
                label: "System resolver",
                ok: systemResolverOk,
                details: systemResolverOk
                    ? `${query} -> ${localIpv4Host}`
                    : `${query} did not resolve through system DNS`,
                fix: systemResolverOk ? undefined : "yarn stam setup dns",
            },
        ],
    });
}

function buildInspection(options: {
    domain: string;
    query: string;
    profile: SharedServiceProfile;
    osConfig: { path?: string; content?: string };
    osConfigContent?: string;
    osConfigMatches: boolean;
    corednsRunning: boolean;
    directCorednsAddresses: string[];
    systemResolverAddresses: string[];
    checks: DnsCheck[];
}): DnsInspection {
    return {
        domain: options.domain,
        query: options.query,
        profile: options.profile,
        expected: {
            corefile: CorednsService.corefileContent(options.domain),
            records: CorednsService.records(options.domain),
            osConfigPath: options.osConfig.path,
            osConfigContent: options.osConfig.content,
        },
        current: {
            osConfigContent: options.osConfigContent,
            osConfigMatches: options.osConfigMatches,
            corednsRunning: options.corednsRunning,
            directCorednsAddresses: options.directCorednsAddresses,
            systemResolverAddresses: options.systemResolverAddresses,
        },
        checks: options.checks,
    };
}

/** Returns the OS-level DNS file Stamhoofd expects for the current platform/runtime profile. */
export function expectedOsDnsConfig(
    domain: string,
    profile: SharedServiceProfile,
): { path?: string; content?: string } {
    if (profile.dnsSetupKind === SharedServiceDnsSetupKind.MacosResolver) {
        return {
            path: macosResolverPath(domain),
            content: macosResolverContent(),
        };
    }
    if (profile.dnsSetupKind === SharedServiceDnsSetupKind.SystemdResolved) {
        return {
            path: "/run/systemd/resolved.conf.d/stamhoofd.conf",
            content: systemdResolvedContent(domain, profile),
        };
    }
    return {};
}

export function systemdResolvedContent(
    domain: string,
    profile: SharedServiceProfile,
): string {
    return `[Resolve]\nDNS=${localIpv4Host}:${profile.corednsHostPort}\nDomains=~${domain}\n`;
}

export function macosResolverPath(domain: string): string {
    return path.join("/etc/resolver", domain);
}

export function macosResolverContent(): string {
    return `nameserver ${localIpv4Host}\n`;
}

async function currentSharedServiceProfile(): Promise<SharedServiceProfile> {
    let runtime = docker.ContainerRuntime.Docker;
    try {
        runtime = await docker.getContainerRuntime();
    } catch {
        // DNS inspection should still preview expected config when Docker is unavailable.
    }
    return buildSharedServiceProfile(runtime);
}

async function directCorednsLookup(
    query: string,
    profile: SharedServiceProfile,
): Promise<string[]> {
    const resolver = new dns.Resolver({
        timeout: directDnsQueryTimeoutMs,
        tries: 1,
    });
    resolver.setServers([localhostPort(profile.corednsHostPort)]);
    try {
        return await resolver.resolve4(query);
    } catch {
        return [];
    }
}

async function systemResolverLookup(
    query: string,
    profile: SharedServiceProfile,
): Promise<string[]> {
    if (profile.dnsSetupKind === SharedServiceDnsSetupKind.SystemdResolved) {
        const result = await run("resolvectl", ["query", query], {
            capture: true,
            allowFailure: true,
        });
        return result.stdout.includes(localIpv4Host) ? [localIpv4Host] : [];
    }
    try {
        return await dns.resolve4(query);
    } catch {
        return [];
    }
}

function osConfigCheck(
    domain: string,
    profile: SharedServiceProfile,
    configPath: string | undefined,
    matches: boolean,
    currentContent: string | undefined,
): DnsCheck {
    if (!configPath) {
        return {
            key: "os-config",
            label: "System DNS config",
            ok: false,
            details: `Automatic DNS setup is not supported on ${profile.platform}`,
            fix: "Configure DNS manually",
        };
    }
    if (matches) {
        return {
            key: "os-config",
            label: "System DNS config",
            ok: true,
            details: `${profile.dnsSetupKind} routes .${domain} to ${localhostPort(profile.corednsHostPort)}`,
        };
    }
    return {
        key: "os-config",
        label: "System DNS config",
        ok: false,
        details:
            currentContent === undefined
                ? `${configPath} is missing`
                : `${configPath} exists with unexpected contents`,
        fix: "yarn stam setup dns",
    };
}

async function readFileIfExists(filePath: string): Promise<string | undefined> {
    try {
        return await fs.readFile(filePath, "utf8");
    } catch (error) {
        if (
            error &&
            typeof error === "object" &&
            "code" in error &&
            error.code === "ENOENT"
        ) {
            return undefined;
        }
        throw error;
    }
}
