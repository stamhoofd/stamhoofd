import { buildSharedServiceProfile } from "../config/shared-service-profile.js";
import {
    buildCaddyOverview,
    type CaddyRouteOverview,
    type CaddySubjectOverview,
} from "../config/caddy-config.js";
import type { CliContext } from "../context/create-context.js";
import { buildDomains } from "../config/build-config.js";
import { buildPorts } from "../context/ports.js";
import {
    listActiveRouteManifests,
    RouteManifestKind,
    type RouteManifest,
} from "../runtime/manifest-store.js";
import { CaddyService } from "../services/definitions/caddy-service.js";
import * as docker from "../services/docker.js";

/** Expected Caddy routes enriched with whether the live admin API currently contains them. */
export type CaddyInspection = {
    routeGroups: CaddyRouteGroup[];
    subjects: Array<CaddySubjectOverview & { live: CaddyLiveState }>;
    liveReachable: boolean;
    adminUrl: string;
};

export type CaddyLiveState = "configured" | "missing" | "unavailable";

export type CaddyRouteGroup = {
    label: string;
    order: number;
    routes: Array<CaddyRouteOverview & { live: CaddyLiveState }>;
};

type LiveCaddyConfig = {
    apps?: {
        http?: {
            servers?: Record<
                string,
                {
                    routes?: Array<{
                        match?: Array<{ host?: string[] }>;
                        handle?: Array<{
                            upstreams?: Array<{ dial?: string }>;
                        }>;
                    }>;
                }
            >;
        };
        tls?: {
            automation?: {
                policies?: Array<{ subjects?: string[] }>;
            };
        };
    };
};

/** Compares generated route manifests with Caddy's live config so status output can show missing reloads or dead Caddy. */
export async function inspectCaddy(
    context: CliContext,
): Promise<CaddyInspection> {
    const profile = buildSharedServiceProfile(await getRuntime());
    const overview = await buildCaddyOverview(context, {
        proxyHost: profile.caddyProxyHost,
    });
    const activeRoutes = await listActiveRouteManifests(context);
    const live = await fetchLiveCaddyConfig();
    const liveRoutes = live ? liveRouteKeys(live) : new Set<string>();
    const liveSubjects = live ? liveSubjectKeys(live) : new Set<string>();

    return {
        adminUrl: CaddyService.adminUrl(),
        liveReachable: live !== undefined,
        routeGroups: buildRouteGroups(
            context,
            profile.caddyProxyHost,
            activeRoutes,
            live,
            liveRoutes,
        ),
        subjects: overview.subjects.map((subject) => ({
            ...subject,
            live: liveState(live, [subject.subject], liveSubjects),
        })),
    };
}

function buildRouteGroups(
    context: CliContext,
    proxyHost: string,
    activeRoutes: RouteManifest[],
    live: LiveCaddyConfig | undefined,
    liveRoutes: Set<string>,
): CaddyRouteGroup[] {
    const groups: CaddyRouteGroup[] = [
        {
            label: "Shared services",
            order: 10,
            routes: sharedServiceRoutes(context, proxyHost).map((route) =>
                addLiveState(route, live, liveRoutes),
            ),
        },
    ];

    const sortedManifests = [...activeRoutes].sort(
        (a, b) =>
            a.rootPath.localeCompare(b.rootPath) ||
            a.workspace.localeCompare(b.workspace) ||
            a.name.localeCompare(b.name),
    );
    for (const manifest of sortedManifests) {
        groups.push({
            label: routeGroupLabel(context, manifest),
            order: routeGroupOrder(context, manifest),
            routes: manifest.routes
                .map((route) =>
                    routeOverview(
                        route.hosts,
                        route.port,
                        proxyHost,
                        sourceFromManifest(manifest),
                    ),
                )
                .map((route) => addLiveState(route, live, liveRoutes)),
        });
    }

    return groups.sort(
        (a, b) => a.order - b.order || a.label.localeCompare(b.label),
    );
}

function addLiveState(
    route: CaddyRouteOverview,
    live: LiveCaddyConfig | undefined,
    liveRoutes: Set<string>,
): CaddyRouteOverview & { live: CaddyLiveState } {
    return {
        ...route,
        live: liveState(
            live,
            route.hosts.map((host) => routeKey(host, route.upstream)),
            liveRoutes,
        ),
    };
}

function sharedServiceRoutes(
    context: CliContext,
    proxyHost: string,
): CaddyRouteOverview[] {
    const domains = buildDomains(context);
    const ports = buildPorts(context);
    return [
        routeOverview(
            [domains.mail],
            ports.maildevHttp,
            proxyHost,
            "shared service",
        ),
        routeOverview(
            [domains.files],
            ports.rustfs,
            proxyHost,
            "shared service",
        ),
        routeOverview(
            [domains.filesConsole],
            ports.rustfsConsole,
            proxyHost,
            "shared service",
        ),
    ];
}

function routeOverview(
    hosts: string[],
    port: number,
    proxyHost: string,
    source: CaddyRouteOverview["source"],
): CaddyRouteOverview {
    return {
        hosts,
        port,
        upstream: `${proxyHost}:${port}`,
        source,
        sourceOrder: 0,
    };
}

function routeGroupLabel(context: CliContext, manifest: RouteManifest): string {
    if (manifest.kind === RouteManifestKind.DevInstance) {
        const scope =
            manifest.rootPath === context.rootDir
                ? "Current workspace"
                : manifest.workspace;
        return `${scope} - ${manifest.name}`;
    }
    if (manifest.kind === RouteManifestKind.PlaywrightWorker) {
        return `Playwright worker - ${manifest.name}`;
    }
    if (manifest.kind === RouteManifestKind.SgvMock) {
        return `SGV mock - ${manifest.name}`;
    }
    if (manifest.kind === RouteManifestKind.Sso) {
        return `SSO - ${manifest.name}`;
    }
    return `Service - ${manifest.name}`;
}

function routeGroupOrder(context: CliContext, manifest: RouteManifest): number {
    if (manifest.kind === RouteManifestKind.DevInstance) {
        return manifest.rootPath === context.rootDir ? 20 : 30;
    }
    if (
        manifest.kind === RouteManifestKind.SgvMock ||
        manifest.kind === RouteManifestKind.Sso
    ) {
        return 40;
    }
    if (manifest.kind === RouteManifestKind.SharedService) {
        return 50;
    }
    return 60;
}

function sourceFromManifest(
    manifest: RouteManifest,
): CaddyRouteOverview["source"] {
    switch (manifest.kind) {
        case RouteManifestKind.DevInstance:
            return "dev instance";
        case RouteManifestKind.SgvMock:
            return "SGV mock";
        case RouteManifestKind.Sso:
            return "SSO";
        case RouteManifestKind.SharedService:
            return "shared service";
        case RouteManifestKind.PlaywrightWorker:
            return "playwright worker";
    }
}

async function getRuntime(): Promise<docker.ContainerRuntime> {
    try {
        return await docker.getContainerRuntime();
    } catch {
        return docker.ContainerRuntime.Docker;
    }
}

async function fetchLiveCaddyConfig(): Promise<LiveCaddyConfig | undefined> {
    try {
        const res = await CaddyService.fetchAdmin("/config/", {
            signal: AbortSignal.timeout(1_000),
        });
        if (!res.ok) {
            return undefined;
        }
        return (await res.json()) as LiveCaddyConfig;
    } catch {
        return undefined;
    }
}

/** Flattens Caddy's nested route config into host/upstream keys that can be compared with expected manifests. */
function liveRouteKeys(config: LiveCaddyConfig): Set<string> {
    const keys = new Set<string>();
    const servers = config.apps?.http?.servers ?? {};
    for (const server of Object.values(servers)) {
        for (const route of server.routes ?? []) {
            const upstream = route.handle?.find((handle) => handle.upstreams)
                ?.upstreams?.[0]?.dial;
            if (!upstream) {
                continue;
            }
            for (const match of route.match ?? []) {
                for (const host of match.host ?? []) {
                    keys.add(routeKey(host, upstream));
                }
            }
        }
    }
    return keys;
}

function liveSubjectKeys(config: LiveCaddyConfig): Set<string> {
    return new Set(
        config.apps?.tls?.automation?.policies?.flatMap(
            (policy) => policy.subjects ?? [],
        ) ?? [],
    );
}

function liveState(
    config: LiveCaddyConfig | undefined,
    expectedKeys: string[],
    liveKeys: Set<string>,
): CaddyLiveState {
    if (!config) {
        return "unavailable";
    }
    return expectedKeys.every((key) => liveKeys.has(key))
        ? "configured"
        : "missing";
}

function routeKey(host: string, upstream: string): string {
    return `${host}->${upstream}`;
}
