import fs from 'node:fs/promises';
import path from 'node:path';
import type { CliContext } from '../context/create-context.js';
import { buildPorts } from '../context/ports.js';
import { buildDomains } from './build-config.js';
import { listInstanceManifests, sharedDir } from '../runtime/manifest-store.js';
import type { InstanceManifest } from '../runtime/manifest-store.js';
import { caddyAdminPort, caddyHttpPort, caddyHttpsPort, caddySetupAdminPort, caddySetupHttpPort, caddySetupHttpsPort, localIpv4Host, localhostPort } from './shared-service-config.js';

type CaddyRoute = {
    match: Array<{ host: string[] }>;
    handle: Array<{ handler: 'reverse_proxy'; upstreams: Array<{ dial: string }> }>;
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
                    subjects: string[];
                    on_demand: false;
                    issuers: Array<{ module: 'internal' }>;
                }>;
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

export async function buildCaddyConfig(context: CliContext, options: { setup?: boolean; httpPort?: number; httpsPort?: number; disableRedirects?: boolean; proxyHost?: string; listenHost?: string; adminListenHost?: string; adminOrigin?: string } = {}): Promise<CaddyConfig> {
    const domains = buildDomains(context);
    const ports = buildPorts(context);
    const activeInstances = await listInstanceManifests(context);
    const proxyHost = options.proxyHost ?? localIpv4Host;
    const listenHost = options.listenHost ?? localIpv4Host;
    const adminListenHost = options.adminListenHost ?? localIpv4Host;
    const listenPort = (port: number) => `${listenHost}:${port}`;
    const routes = [
        // Active instance manifests let the shared Caddy container keep routing
        // requests for other running workspaces, not just the current context.
        ...activeInstances.flatMap(instance => instanceRoutes(instance, proxyHost)),
        route([domains.renderer], ports.renderer, proxyHost),
        route([domains.api, `*.${domains.api}`], ports.api, proxyHost),
        route([domains.dashboard], ports.dashboard, proxyHost),
        route([domains.registration, `*.${domains.registration}`], ports.registration, proxyHost),
        route([domains.webshop], ports.webshop, proxyHost),
        route([domains.mail], ports.maildevHttp, proxyHost),
        route([domains.files], ports.rustfs, proxyHost),
        route([domains.filesConsole], ports.rustfsConsole, proxyHost),
        route([domains.sso], ports.sso, proxyHost),
    ];
    const subjects = [...new Set([
        domains.dashboard,
        domains.api,
        `*.${domains.api}`,
        domains.renderer,
        domains.registration,
        `*.${domains.registration}`,
        domains.webshop,
        domains.mail,
        domains.files,
        domains.filesConsole,
        domains.sso,
        ...activeInstances.flatMap(instance => [
            instance.domains.dashboard,
            instance.domains.api,
            `*.${instance.domains.api}`,
            instance.domains.renderer,
        ]),
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
                        { subjects, on_demand: false, issuers: [{ module: 'internal' }] },
                    ],
                },
            },
        },
    };
}

function instanceRoutes(instance: InstanceManifest, proxyHost: string) {
    return [
        route([instance.domains.renderer], instance.ports.renderer, proxyHost),
        route([instance.domains.api, `*.${instance.domains.api}`], instance.ports.api, proxyHost),
        route([instance.domains.dashboard], instance.ports.dashboard, proxyHost),
    ];
}
