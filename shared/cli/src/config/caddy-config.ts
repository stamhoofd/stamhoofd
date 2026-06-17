import fs from 'node:fs/promises';
import path from 'node:path';
import type { CliContext } from '../context/create-context.js';
import { buildPorts } from '../context/ports.js';
import { buildDomains } from './build-config.js';
import type { CaddyRouteOptions } from '../runtime/manifest-store.js';
import { listActiveRouteManifests, sharedDir } from '../runtime/manifest-store.js';
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

export function buildCaddyRouteOptions(context: CliContext, options: { proxyHost?: string } = {}): CaddyRouteOptions {
    const domains = buildDomains(context);
    const ports = buildPorts(context);
    const proxyHost = options.proxyHost ?? localIpv4Host;
    const routes = [
        route([domains.renderer], ports.renderer, proxyHost),
        route([domains.api, `*.${domains.api}`], ports.api, proxyHost),
        route([domains.dashboard], ports.webApp, proxyHost),
        route([domains.registration, `*.${domains.registration}`], ports.webApp, proxyHost),
        route([domains.webshop], ports.webshop, proxyHost),
    ];

    const tlsSubjects = [...new Set([
        domains.dashboard,
        domains.api,
        `*.${domains.api}`,
        domains.renderer,
        domains.registration,
        `*.${domains.registration}`,
    ])];

    return {
        routes,
        tlsSubjects,
    };
}

export async function buildCaddyConfig(context: CliContext, options: { setup?: boolean; httpPort?: number; httpsPort?: number; disableRedirects?: boolean; proxyHost?: string; listenHost?: string; adminListenHost?: string; adminOrigin?: string } = {}): Promise<CaddyConfig> {
    const domains = buildDomains(context);
    const ports = buildPorts(context);
    const activeManifests = await listActiveRouteManifests(context);
    const proxyHost = options.proxyHost ?? localIpv4Host;
    const listenHost = options.listenHost ?? localIpv4Host;
    const adminListenHost = options.adminListenHost ?? localIpv4Host;
    const listenPort = (port: number) => `${listenHost}:${port}`;
    const routes = [
        // Active instance manifests let the shared Caddy container keep routing
        // requests for other running workspaces and test workers.
        ...activeManifests.flatMap(manifest => manifest.caddy.routes),

        // Shared services
        route([domains.mail], ports.maildevHttp, proxyHost),
        route([domains.files, `*.${domains.files}`], ports.rustfs, proxyHost),
        route([domains.filesConsole], ports.rustfsConsole, proxyHost),
        route([domains.sso], ports.sso, proxyHost),
    ];
    const subjects = [...new Set([
        domains.mail,
        domains.files,
        `*.${domains.files}`,
        domains.filesConsole,
        domains.sso,
        ...activeManifests.flatMap(manifest => manifest.caddy.tlsSubjects),
    ])];

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
                            issuers: [{
                                module: 'internal',
                            }],
                        },
                    ],
                    on_demand: {
                        permission: {
                            module: 'http',

                            // Just a domain that always returns 200 (no redirects!)
                            endpoint: 'https://www.stamhoofd.be',
                        },
                    },
                },
            },
        },
    };
}
