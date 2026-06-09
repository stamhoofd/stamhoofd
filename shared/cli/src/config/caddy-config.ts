import fs from 'node:fs/promises';
import path from 'node:path';
import type { CliContext } from '../context/create-context.js';
import { buildPorts } from '../context/ports.js';
import { listActiveRouteManifests, RouteManifestKind, sharedDir } from '../runtime/manifest-store.js';
import type { RouteManifest, RouteManifestRoute } from '../runtime/manifest-store.js';
import { buildDomains } from './build-config.js';
import { caddyAdminPort, caddyHttpPort, caddyHttpsPort, caddySetupAdminPort, caddySetupHttpPort, caddySetupHttpsPort, localIpv4Host, localhostPort } from './shared-service-config.js';

export type CaddyRoute = {
    group?: string;
    match: (
        { host: string[] } | { header_regexp: unknown }
    )[];
    handle: (
        {
            handler: 'reverse_proxy';
            upstreams: Array<{ dial: string }>;
            headers?: {
                request?: {
                    add?: Record<string, string[]>;
                    set?: Record<string, string[]>;
                    delete?: string[];
                    replace?: Record<string, { search?: string; search_regexp?: string; replace: string }[]>;
                };
                response?: {
                    add?: Record<string, string[]>;
                    set?: Record<string, string[]>;
                    delete?: string[];
                    replace?: Record<string, { search?: string; search_regexp?: string; replace: string }[]>;
                };
            };
        } | {
            handler: 'headers';
            request?: {
                add?: Record<string, string[]>;
                set?: Record<string, string[]>;
                delete?: string[];
                replace?: Record<string, { search?: string; search_regexp?: string; replace: string }[]>;
            };
            response?: {
                add?: Record<string, string[]>;
                set?: Record<string, string[]>;
                delete?: string[];
                replace?: Record<string, { search?: string; search_regexp?: string; replace: string }[]>;
            };
        }
    )[];
    terminal?: boolean;
};

type CaddyConfig = {
    admin: { listen: string; origins?: string[] };
    apps: {
        http: {
            servers: {
                stamhoofd: {
                    listen: string[];
                    routes: CaddyRoute[];
                    automatic_https?: { disable_redirects: boolean };
                };
            };
        };
        tls: {
            automation: {
                policies: Array<{
                    subjects?: string[];
                    on_demand: false | true;
                    issuers: Array<{ module: 'internal' }>;
                }>;
                on_demand?: {
                    permission: {
                        module: 'http';
                        endpoint: string;
                    };
                };
            };
        };
    };
};

export type CaddyRouteSource = 'dev instance' | 'playwright worker' | 'shared service' | 'SGV mock' | 'SSO';

export type CaddyRouteOverview = {
    hosts: string[];
    port: number;
    upstream: string;
    source: CaddyRouteSource;
    sourceOrder: number;
};

export type CaddySubjectOverview = {
    subject: string;
    source: CaddyRouteSource;
    sourceOrder: number;
};

export async function writeCaddyConfig(context: CliContext, options: { httpPort?: number; httpsPort?: number; disableRedirects?: boolean; proxyHost?: string; listenHost?: string; adminListenHost?: string; adminOrigin?: string } = {}): Promise<string> {
    const configPath = path.join(sharedDir(context), 'caddy.json');
    await writeReadableConfig(configPath, JSON.stringify(await buildCaddyConfig(context, options), null, 4));
    return configPath;
}

export async function writeSetupCaddyConfig(context: CliContext): Promise<string> {
    const configPath = path.join(sharedDir(context), 'caddy-setup.json');
    const config = await buildCaddyConfig(context, { setup: true });
    await writeReadableConfig(configPath, JSON.stringify(config, null, 4));
    return configPath;
}

async function writeReadableConfig(configPath: string, content: string): Promise<void> {
    const dir = path.dirname(configPath);
    await fs.mkdir(dir, { recursive: true });
    await fs.chmod(dir, 0o755);
    await fs.writeFile(configPath, content, { mode: 0o644 });
    await fs.chmod(configPath, 0o644);
}

function route(hosts: string[], port: number, proxyHost: string): CaddyRoute {
    return {
        match: [{ host: hosts }],
        handle: [{ handler: 'reverse_proxy', upstreams: [{ dial: `${proxyHost}:${port}` }] }],
    };
}

export function buildCaddyRouteOptions(context: CliContext, options: { proxyHost?: string } = {}): { routes: CaddyRoute[]; tlsSubjects: string[] } {
    const domains = buildDomains(context);
    const ports = buildPorts(context);
    const proxyHost = options.proxyHost ?? localIpv4Host;
    const routes = [
        route([domains.renderer], ports.renderer, proxyHost),
        route([domains.api, `*.${domains.api}`], ports.api, proxyHost),
        route([domains.dashboard], ports.webApp, proxyHost),
        route([domains.registration, `*.${domains.registration}`], ports.webApp, proxyHost),
        route([domains.webshop], ports.webApp, proxyHost),
    ];

    const tlsSubjects = [...new Set([
        domains.dashboard,
        domains.api,
        `*.${domains.api}`,
        domains.renderer,
        domains.registration,
        `*.${domains.registration}`,
        domains.webshop,
    ])];

    return {
        routes,
        tlsSubjects,
    };
}

export async function buildCaddyConfig(context: CliContext, options: { setup?: boolean; httpPort?: number; httpsPort?: number; disableRedirects?: boolean; proxyHost?: string; listenHost?: string; adminListenHost?: string; adminOrigin?: string } = {}): Promise<CaddyConfig> {
    const overview = await buildCaddyOverview(context, options);
    const proxyHost = options.proxyHost ?? localIpv4Host;
    const listenHost = options.listenHost ?? localIpv4Host;
    const adminListenHost = options.adminListenHost ?? localIpv4Host;
    const listenPort = (port: number) => `${listenHost}:${port}`;
    const routes = overview.routes.map(routeOverview => route(routeOverview.hosts, routeOverview.port, proxyHost));
    const subjects = overview.subjects.map(subject => subject.subject);

    return {
        admin: {
            listen: options.setup ? localhostPort(caddySetupAdminPort) : `${adminListenHost}:${caddyAdminPort}`,
            origins: options.setup ? undefined : [options.adminOrigin ?? `http://${localhostPort(caddyAdminPort)}`],
        },
        apps: {
            http: {
                servers: {
                    stamhoofd: {
                        listen: options.setup
                            ? [listenPort(caddySetupHttpsPort), listenPort(caddySetupHttpPort)]
                            : [listenPort(options.httpsPort ?? caddyHttpsPort), listenPort(options.httpPort ?? caddyHttpPort)],
                        routes,
                        automatic_https: (options.setup || options.disableRedirects)
                            ? { disable_redirects: true }
                            : undefined,
                    },
                },
            },
            tls: {
                automation: {
                    policies: [
                        {
                            subjects,
                            on_demand: false,
                            issuers: [{ module: 'internal' }],
                        },
                        {
                            on_demand: true,
                            issuers: [{ module: 'internal' }],
                        },
                    ],
                    on_demand: {
                        permission: {
                            module: 'http',
                            endpoint: 'https://www.stamhoofd.be',
                        },
                    },
                },
            },
        },
    };
}

/** Builds a route/subject overview from active manifests plus always-on shared services for config and status output. */
export async function buildCaddyOverview(context: CliContext, options: { proxyHost?: string } = {}): Promise<{ routes: CaddyRouteOverview[]; subjects: CaddySubjectOverview[] }> {
    const domains = buildDomains(context);
    const ports = buildPorts(context);
    const proxyHost = options.proxyHost ?? localIpv4Host;
    const activeManifests = await listActiveRouteManifests(context);
    const routes = [
        ...activeManifests.flatMap(manifest => manifest.routes.map(manifestRoute => routeFromManifest(manifest, manifestRoute, proxyHost))),
        routeOverview([domains.mail], ports.maildevHttp, proxyHost, 'shared service'),
        routeOverview([domains.files], ports.rustfs, proxyHost, 'shared service'),
        routeOverview([domains.filesConsole], ports.rustfsConsole, proxyHost, 'shared service'),
    ];
    const subjects = uniqueSubjects(routes.flatMap(route => route.hosts.map(subject => ({ subject, source: route.source, sourceOrder: route.sourceOrder }))));
    return { routes, subjects };
}

function routeFromManifest(manifest: RouteManifest, manifestRoute: RouteManifestRoute, proxyHost: string): CaddyRouteOverview {
    return routeOverview(manifestRoute.hosts, manifestRoute.port, proxyHost, sourceFromManifest(manifest));
}

function routeOverview(hosts: string[], port: number, proxyHost: string, source: CaddyRouteSource): CaddyRouteOverview {
    return {
        hosts,
        port,
        upstream: `${proxyHost}:${port}`,
        source,
        sourceOrder: sourceOrder(source),
    };
}

/** Orders route sources deterministically so generated Caddy config stays stable across runs. */
function sourceOrder(source: CaddyRouteSource): number {
    switch (source) {
        case 'dev instance':
            return 10;
        case 'SGV mock':
            return 20;
        case 'SSO':
            return 30;
        case 'shared service':
            return 40;
        case 'playwright worker':
            return 50;
    }
}

function sourceFromManifest(manifest: RouteManifest): CaddyRouteSource {
    switch (manifest.kind) {
        case RouteManifestKind.DevInstance:
            return 'dev instance';
        case RouteManifestKind.SgvMock:
            return 'SGV mock';
        case RouteManifestKind.Sso:
            return 'SSO';
        case RouteManifestKind.SharedService:
            return 'shared service';
        case RouteManifestKind.PlaywrightWorker:
            return 'playwright worker';
    }
}

function uniqueSubjects(subjects: CaddySubjectOverview[]): CaddySubjectOverview[] {
    const seen = new Set<string>();
    return subjects.filter((subject) => {
        if (seen.has(subject.subject)) {
            return false;
        }
        seen.add(subject.subject);
        return true;
    });
}
