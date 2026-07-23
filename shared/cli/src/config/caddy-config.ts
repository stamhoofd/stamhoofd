import fs from 'node:fs/promises';
import path from 'node:path';
import type { CliContext } from '../context/create-context.js';
import { buildPorts } from '../context/ports.js';
import { buildDomains } from './build-config.js';
import type { CaddyRouteOptions } from '../runtime/manifest-store.js';
import { listActiveRouteManifests, sharedDir } from '../runtime/manifest-store.js';
import { caddyAdminPort, caddyHttpPort, caddyHttpsPort, caddySetupAdminPort, caddySetupHttpPort, caddySetupHttpsPort, localIpv4Host, localhostPort } from './shared-service-config.js';

/**
 * By default Caddy closes active streaming requests (WebSockets) immediately
 * whenever its config is reloaded. In the CLI dev environment we reload Caddy
 * often (starting an instance, restarting services, the `--watch` flag), which
 * would tear down long-lived WebSockets such as the Vite HMR channel on every
 * reload. Setting `stream_close_delay` on the reverse_proxy keeps those streams
 * open across reloads: a non-zero value tells Caddy not to close streaming
 * requests when the config is unloaded, but to keep them open until the delay
 * elapses. We use a very large delay so, for the lifetime of a dev session,
 * WebSockets effectively survive reloads.
 */
const streamCloseDelay = '24h';

/**
 * The webshop and the web-app (dashboard + registration) are served with a strict-dynamic
 * Content-Security-Policy backed by a per-request nonce. Caddy generates the nonce
 * ({http.request.uuid}) once per request, sets it in the CSP header, and substitutes this
 * build-time placeholder — injected into the served HTML by Vite (html.cspNonce) and by the
 * app's own <script> tags — with the same value. Keep in sync with the webshop/web-app
 * vite.config.ts, their index.html, shared public/out-of-date.html and the production devops
 * buildCaddyConfig.ts. (The mobile app keeps a static meta-tag CSP: it is served from the
 * device, so there is no Caddy to set the header or rewrite the nonce.)
 */
export const CSP_NONCE_PLACEHOLDER = 'STAMHOOFD_CSP_NONCE';
const cspNonceHeaderValue = `script-src 'nonce-{http.request.uuid}' 'strict-dynamic'; object-src 'none'; base-uri 'none'`;

/**
 * CSP served on resources (hashed, long-cached assets): fully sandboxed, no scripts. This is a
 * defense-in-depth net for the case where the path matching is wrong, or a .html/.xml/.svg file
 * was uploaded and served as a resource. CSP headers only apply to documents/frames/workers, so
 * this is a no-op for normal subresource loading (a .js/.css loaded by a page is unaffected by
 * its own response CSP) but blocks execution if such a file is navigated to directly.
 */
const cspResourceHeaderValue = `sandbox; default-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'`;

/**
 * Extra CSP added on top of the nonce policy for documents on our own domains (everything except
 * custom webshop domains, where admins may inject their own custom code): all scripts must be
 * 'self' or carry the top-level nonce. Unlike the nonce policy it has no 'strict-dynamic', so a
 * nonce'd script can no longer propagate trust to arbitrary (e.g. externally hosted) scripts it
 * injects — those must still be same-origin or nonce'd. Two CSP headers are enforced together.
 */
const cspNoExternalScriptsHeaderValue = `script-src 'self' 'nonce-{http.request.uuid}'`;

/**
 * Paths treated as (hashed, long-cached) resources rather than HTML documents. Mirrors the
 * production devops buildCaddyConfig.ts list: it drives which responses get the strict-dynamic
 * document CSP (+ nonce rewrite) versus the sandboxed resource CSP. Keep in sync with production.
 */
const resourcesPathMatchers = [
    '*.js',
    '*.css',
    '*.png',
    '*.jpg',
    '*.jpeg',
    '*.gif',
    '*.ico',
    '*.webm',
    '*.mp4',
    '*.webp',
    '*.avif',
    '*.svg',
    '*.ttf',
    '*.woff',
    '*.woff2',
    '*.map',
    '*.pdf',
    '*.doc',
    '*.docx',
    '*.xls',
    '*.xlsx',
    '*.ppt',
    '*.pptx',
    '*.zip',
    '*.rar',
    '*.7z',
    '*.gz',
    '*.tar',
    '*.mp3',
    '*.m4a',
    '*.avi',
    '*.mkv',
    '*.mov',
    '*.wmv',
];

type CaddyHeaderOps = {
    add?: Record<string, string[]>;
    set?: Record<string, string[]>;
    delete?: string[];
    replace?: Record<string, { search?: string; search_regexp?: string; replace: string }[]>;
};

type CaddyMatcher = {
    host?: string[];
    header?: Record<string, string[]>;
    header_regexp?: unknown;
    path?: string[];
    not?: CaddyMatcher[];
};

type CaddyHandler =
    | {
        handler: 'reverse_proxy';
        upstreams: Array<{ dial: string }>;
        stream_close_delay?: string;
        headers?: {
            request?: CaddyHeaderOps;
            response?: CaddyHeaderOps;
        };
    }
    | {
        handler: 'headers';
        request?: CaddyHeaderOps;
        response?: CaddyHeaderOps;
    }
    | {
        handler: 'replace_response';
        replacements: Array<{ search?: string; search_regexp?: string; replace: string }>;
    }
    | {
        handler: 'subroute';
        routes: Array<{ match?: CaddyMatcher[]; handle: CaddyHandler[]; terminal?: boolean }>;
    };

export type CaddyRoute = {
    group?: string;
    match: CaddyMatcher[];
    handle: CaddyHandler[];
    terminal?: boolean;
};

/**
 * Subroute that applies the per-request-nonce CSP based on the request path, mirroring production
 * (devops buildCaddyConfig.ts). Documents (anything that is not a resource) get the strict-dynamic
 * nonce policy and the build-time placeholder is rewritten to the per-request nonce; resources
 * (hashed, long-cached assets) get the fully sandboxed resource CSP and are never buffered by
 * replace_response.
 */
function cspNonceSubroute(): CaddyHandler {
    return {
        handler: 'subroute',
        routes: [
            {
                // Documents: strict-dynamic nonce policy + rewrite the placeholder to the nonce.
                match: [{ not: [{ path: [...resourcesPathMatchers] }] }],
                handle: [
                    { handler: 'headers', response: { set: { 'Content-Security-Policy': [cspNonceHeaderValue] } } },
                    { handler: 'replace_response', replacements: [{ search: CSP_NONCE_PLACEHOLDER, replace: '{http.request.uuid}' }] },
                ],
                terminal: false,
            },
            {
                // Resources: fully sandboxed, no scripts.
                match: [{ path: [...resourcesPathMatchers] }],
                handle: [
                    { handler: 'headers', response: { set: { 'Content-Security-Policy': [cspResourceHeaderValue] } } },
                ],
                terminal: false,
            },
        ],
    };
}

/**
 * Subroute that adds the extra "no external scripts" CSP header on document responses only, on top
 * of the nonce policy (see cspNoExternalScriptsHeaderValue). Applied on our own domains, never on
 * custom webshop domains where admins may inject custom code.
 */
function cspNoExternalScriptsSubroute(): CaddyHandler {
    return {
        handler: 'subroute',
        routes: [
            {
                match: [{ not: [{ path: [...resourcesPathMatchers] }] }],
                handle: [
                    { handler: 'headers', response: { add: { 'Content-Security-Policy': [cspNoExternalScriptsHeaderValue] } } },
                ],
                terminal: false,
            },
        ],
    };
}

/**
 * The full production CSP policy for a frontend, as handlers to prepend before the reverse_proxy.
 * Decides document vs. resource by file extension (not by the Accept header, unlike the CLI dev
 * config which proxies Vite and must not buffer the HMR websocket). Prefer this in environments
 * that serve static builds (e.g. the Playwright frontends). Pass `customDomain: true` for webshop
 * custom domains so the "no external scripts" hardening is omitted and admin custom code can run.
 */
export function cspFrontendSubroutes(options: { customDomain: boolean }): CaddyRoute['handle'] {
    return [
        cspNonceSubroute(),
        ...(options.customDomain ? [] : [cspNoExternalScriptsSubroute()]),
    ];
}

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

/**
 * Escape a string so it can be embedded literally inside a regular expression. Used to build the
 * Host header_regexp matchers for the custom-domain suffix (the suffix contains dots that would
 * otherwise match any character).
 */
function escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function reverseProxy(port: number, proxyHost: string): CaddyRoute['handle'][number] {
    return { handler: 'reverse_proxy', upstreams: [{ dial: `${proxyHost}:${port}` }], stream_close_delay: streamCloseDelay };
}

function route(hosts: string[], port: number, proxyHost: string): CaddyRoute {
    return {
        match: [{ host: hosts }],
        handle: [reverseProxy(port, proxyHost)],
    };
}

/**
 * Frontend routes for an app served with the production CSP (webshop + web-app), matched by an
 * arbitrary matcher (an exact host list or a Host header_regexp). The CSP is applied by
 * cspFrontendSubroutes based on the request path (file extension), exactly as in production and
 * the Playwright config: documents get the strict-dynamic nonce policy (+ nonce rewrite), resources
 * get the sandboxed resource CSP. `customDomain: true` drops the "no external scripts" hardening so
 * a webshop's admin custom code can run on its own custom domain.
 *
 * Unlike production/Playwright (which serve static builds), the dev server proxies the Vite dev
 * server, whose HMR websocket must never be buffered by replace_response (it hijacks the connection,
 * which a buffering response writer breaks). So websocket upgrades get their own bypass route: it is
 * registered first and terminal, so the upgrade is proxied untouched and never reaches the CSP route.
 * Both routes are terminal, so a request matched here never also falls through to a later, broader
 * route (e.g. the webshop custom-domain catch-all).
 */
function cspFrontendRoutesForMatch(match: CaddyRoute['match'][number], port: number, proxyHost: string, options: { customDomain: boolean }): CaddyRoute[] {
    const proxy = reverseProxy(port, proxyHost);
    return [
        {
            // Vite HMR websocket upgrade: proxy untouched, no CSP subroutes / replace_response.
            match: [{ ...match, header: { Connection: ['*Upgrade*'], Upgrade: ['websocket'] } }],
            handle: [proxy],
            terminal: true,
        },
        {
            match: [match],
            handle: [...cspFrontendSubroutes(options), proxy],
            terminal: true,
        },
    ];
}

function cspFrontendRoutes(hosts: string[], port: number, proxyHost: string, options: { customDomain: boolean }): CaddyRoute[] {
    return cspFrontendRoutesForMatch({ host: hosts }, port, proxyHost, options);
}

/**
 * Routes for local custom domains. Every host ending in the shared custom-domain suffix is served
 * by a frontend: a registration domain when it starts with 'inschrijven.', otherwise a webshop —
 * mirroring how production custom domains CNAME onto the registration/webshop endpoints. Both apps
 * carry the strict-dynamic CSP. RE2 (Caddy's regexp engine) has no negative lookahead, so the
 * registration route is registered first and marked terminal: it wins over the webshop catch-all
 * on the shared suffix.
 */
function customDomainRoutes(customSuffix: string, registrationPort: number, webshopPort: number, proxyHost: string): CaddyRoute[] {
    const suffix = escapeRegExp(customSuffix);
    return [
        // Registration custom domains keep the "no external scripts" hardening (production parity).
        ...cspFrontendRoutesForMatch({ header_regexp: { Host: { pattern: `^inschrijven\\..+\\.${suffix}$` } } }, registrationPort, proxyHost, { customDomain: false }),
        // Webshop custom domains drop it so admin custom code can run on the shop's own domain.
        ...cspFrontendRoutesForMatch({ header_regexp: { Host: { pattern: `^.+\\.${suffix}$` } } }, webshopPort, proxyHost, { customDomain: true }),
    ];
}

export function buildCaddyRouteOptions(context: CliContext, options: { proxyHost?: string } = {}): CaddyRouteOptions {
    const domains = buildDomains(context);
    const ports = buildPorts(context);
    const proxyHost = options.proxyHost ?? localIpv4Host;
    const routes = [
        route([domains.renderer], ports.renderer, proxyHost),
        route([domains.api, `*.${domains.api}`], ports.api, proxyHost),
        ...cspFrontendRoutes([domains.dashboard], ports.webApp, proxyHost, { customDomain: false }),
        ...cspFrontendRoutes([domains.registration, `*.${domains.registration}`], ports.webApp, proxyHost, { customDomain: false }),
        ...cspFrontendRoutes([domains.webshop], ports.webshop, proxyHost, { customDomain: false }),
        // Custom domains resolve to the same web-app (registration) and webshop dev servers. The
        // registration catch-all must be registered before the webshop catch-all (see
        // customDomainRoutes): both are terminal, so registration wins on the shared suffix.
        ...customDomainRoutes(domains.customDomain, ports.webApp, ports.webshop, proxyHost),
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
