import fs from 'node:fs/promises';
import path from 'node:path';
import type { CliContext } from '../context/create-context.js';
import { buildPorts } from '../context/ports.js';
import { buildDomains } from './build-config.js';
import { listInstanceManifests, sharedDir } from '../runtime/manifest-store.js';
import type { InstanceManifest } from '../runtime/manifest-store.js';
import { caddyAdminPort, caddyHttpPort, caddyHttpsPort, caddySetupAdminPort, caddySetupHttpPort, caddySetupHttpsPort, localhostPort } from './shared-service-config.js';

type CaddyRoute = {
    match: Array<{ host: string[] }>;
    handle: Array<{ handler: 'reverse_proxy'; upstreams: Array<{ dial: string }> }>;
};

type CaddyConfig = {
    admin: { listen: string };
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

export async function writeCaddyConfig(context: CliContext, options: { httpPort?: number; httpsPort?: number; disableRedirects?: boolean } = {}): Promise<string> {
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

function route(hosts: string[], port: number): CaddyRoute {
    return {
        match: [{ host: hosts }],
        handle: [{ handler: 'reverse_proxy', upstreams: [{ dial: localhostPort(port) }] }],
    };
}

export async function buildCaddyConfig(context: CliContext, options: { setup?: boolean; httpPort?: number; httpsPort?: number; disableRedirects?: boolean } = {}): Promise<CaddyConfig> {
    const domains = buildDomains(context);
    const ports = buildPorts(context);
    const activeInstances = await listInstanceManifests(context);
    const routes = [
        // Active instance manifests let the shared Caddy container keep routing
        // requests for other running workspaces, not just the current context.
        ...activeInstances.flatMap(instanceRoutes),
        route([domains.renderer], ports.renderer),
        route([domains.api, `*.${domains.api}`], ports.api),
        route([domains.dashboard], ports.dashboard),
        route([domains.registration, `*.${domains.registration}`], ports.registration),
        route([domains.webshop], ports.webshop),
        route([domains.mail], ports.maildevHttp),
        route([domains.files], ports.rustfs),
        route([domains.filesConsole], ports.rustfsConsole),
        route([domains.sso], ports.sso),
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
        admin: { listen: localhostPort(options.setup ? caddySetupAdminPort : caddyAdminPort) },
        apps: {
            http: {
                servers: {
                    stamhoofd: {
                        listen: options.setup
                            ? [localhostPort(caddySetupHttpsPort), localhostPort(caddySetupHttpPort)]
                            : [localhostPort(options.httpsPort ?? caddyHttpsPort), localhostPort(options.httpPort ?? caddyHttpPort)],
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

function instanceRoutes(instance: InstanceManifest) {
    return [
        route([instance.domains.renderer], instance.ports.renderer),
        route([instance.domains.api, `*.${instance.domains.api}`], instance.ports.api),
        route([instance.domains.dashboard], instance.ports.dashboard),
    ];
}
