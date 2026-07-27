import { Formatter } from '@stamhoofd/utility';
import type { FrontendProjectName } from './FrontendService.js';
import type { CaddyRoute, CaddyRouteOptions } from '@stamhoofd/cli';
import { cspFrontendSubroutes, ssoRealm } from '@stamhoofd/cli';

/**
 * Every port and domain of a worker is derived from its slot, not from its worker id: an e2e run
 * reserves a block of `workerCount` consecutive slots (see CaddyHelper) so runs started from other
 * worktrees never end up on the same ports or domains. This is the number of slots that exist on
 * one machine, so at most this many Playwright workers can run at the same time across all runs.
 */
export const slotPoolSize = 30;

const portBases = {
    api: 6000,
    dashboard: 6100,
    registration: 6200,
    webshop: 6300,
    sso: 6400,
} as const;

/**
 * Helper to create caddy configuration for playwright
 */
export class CaddyConfigHelper {
    static readonly GROUP_PREFIX = 'playwright';

    /**
     * The first slot of the block this run reserved. Set once by the global setup and read back in
     * every worker process, which Playwright forks after the global setup ran.
     */
    static getSlotOffset(): number {
        const offset = Number.parseInt(process.env.PLAYWRIGHT_SLOT_OFFSET ?? '0', 10);
        return Number.isFinite(offset) && offset >= 0 ? offset : 0;
    }

    /**
     * Record the block this run reserved: `count` slots starting at `offset`.
     */
    static setSlotBlock(offset: number, count: number) {
        process.env.PLAYWRIGHT_SLOT_OFFSET = offset.toString();
        process.env.PLAYWRIGHT_SLOT_COUNT = count.toString();
    }

    /**
     * The slot a worker runs on: its ports and domains are all derived from this number.
     */
    static getSlot(workerId: string) {
        const worker = parseInt(workerId);
        const reserved = Number.parseInt(process.env.PLAYWRIGHT_SLOT_COUNT ?? '', 10);

        if (Number.isFinite(reserved) && worker >= reserved) {
            throw new Error(`Worker ${workerId} has no reserved slot: this run reserved ${reserved} slots. Set PLAYWRIGHT_WORKER_COUNT instead of overriding --workers.`);
        }

        const slot = this.getSlotOffset() + worker;
        if (!Number.isFinite(slot) || slot < 0 || slot >= slotPoolSize) {
            throw new Error(`Worker ${workerId} maps to slot ${slot}, which is outside the pool of ${slotPoolSize} slots`);
        }
        return slot;
    }

    /**
     * Get the group name for the caddy routes
     */
    static getGroup(service: string, workerId: string) {
        return `${this.GROUP_PREFIX}-${service}-${this.getSlot(workerId)}`;
    }

    /**
     * Get the domain for the service and worker id
     */
    static getDomain(
        service: 'api' | 'dashboard' | 'registration' | 'webshop' | 'renderer',
        workerId: string,
    ) {
        return `playwright-${service}-${this.getSlot(workerId)}.stamhoofd`;
    }

    static getCustomDomainTld(
        workerId: string,
    ) {
        // IMPORTANT: custom registration domains may never end with getDomain('registration', workerId)
        // otherwise, the backend will try to resolve by URI, not by domain
        return `playwright-custom-${this.getSlot(workerId)}.stamhoofd`;
    }

    static getRegistrationCustomDomain(
        domain: string,
        workerId: string,
    ) {
        // IMPORTANT: custom registration domains may never end with getDomain('registration', workerId)
        // otherwise, the backend will try to resolve by URI, not by domain
        return `inschrijven.${domain}.${this.getCustomDomainTld(workerId)}`;
    }

    /**
     * Custom domain for a webshop, grouped under the same custom domain TLD as registration domains.
     * Webshops are every domain that ends with the custom TLD but does NOT start with 'inschrijven'.
     */
    static getWebshopCustomDomain(
        prefix: string,
        workerId: string,
    ) {
        if (prefix.startsWith('inschrijven')) {
            throw new Error("Webshop custom domain prefix may not start with 'inschrijven'");
        }
        return `${prefix}.${this.getCustomDomainTld(workerId)}`;
    }

    /**
     * Host of the SSO (Keycloak) server used by the e2e tests. One server is shared by all workers
     * of a run, but not between runs: the host and port carry the slot offset of the run, so an
     * e2e run in another worktree gets its own server. It deliberately does not reuse the
     * `sso.<domain>` host of `stam sso start` either: a test run must never restart the SSO server
     * a developer started for manual testing.
     */
    static getSsoDomain() {
        return `playwright-sso-${this.getSlotOffset()}.stamhoofd`;
    }

    static getSsoPort() {
        return portBases.sso + this.getSlotOffset();
    }

    /**
     * Suffix that keeps the container and realm files of this run apart from those of a run in
     * another worktree.
     */
    static getSsoVariantName() {
        return `playwright-${this.getSlotOffset()}`;
    }

    /**
     * OpenID Connect issuer of the realm imported by the SSO server, to configure as the issuer in
     * the Stamhoofd SSO settings.
     */
    static getSsoIssuer() {
        return `https://${this.getSsoDomain()}/dex/realms/${ssoRealm}`;
    }

    /**
     * The redirect URI the backend of a worker hands to the SSO server. Keycloak only redirects
     * back to URIs listed in the realm, and one SSO server serves every worker of this run, so the
     * realm allows the callback of every worker.
     */
    static getSsoRedirectUris(workerCount: number) {
        const uris: string[] = [];
        for (let workerId = 0; workerId < workerCount; workerId += 1) {
            uris.push(`${this.getUrl('api', workerId.toString())}/openid/callback`);
        }
        return uris;
    }

    /**
     * Get the url for the service and worker id
     */
    static getUrl(
        service: 'api' | 'dashboard' | 'registration' | 'webshop' | 'renderer',
        workerId: string,
        prefix?: string,
    ) {
        return 'https://' + (prefix ?? '') + this.getDomain(service, workerId);
    }

    static getPort(
        service: 'api',
        workerId: string) {
        return portBases[service] + this.getSlot(workerId);
    }

    static getFrontendPort(service: FrontendProjectName, workerId: string) {
        return portBases[service] + this.getSlot(workerId);
    }

    /**
     * Every host port this run needs: the ports of all its workers plus the shared SSO server.
     * Reserved in the route manifest so a run in another worktree picks a different block.
     */
    static getReservedPorts(workerCount: number) {
        const ports: number[] = [this.getSsoPort()];

        for (let workerId = 0; workerId < workerCount; workerId += 1) {
            const id = workerId.toString();
            ports.push(
                this.getPort('api', id),
                this.getFrontendPort('dashboard', id),
                this.getFrontendPort('registration', id),
                this.getFrontendPort('webshop', id),
            );
        }

        return ports;
    }

    /**
     * A proxy route that enforces the same Content-Security-Policy as production (devops
     * buildCaddyConfig.ts) on all playwright frontends — dashboard, registration and webshop.
     * The CSP is applied by cspFrontendSubroutes based on the request path (file extension):
     * documents get the strict-dynamic nonce policy (+ per-request nonce rewrite), resources get
     * the sandboxed resource CSP and are never buffered by replace_response. The frontends are
     * served from a static file server, so there is no Vite HMR websocket to keep unbuffered
     * (unlike the CLI dev config, which proxies Vite and matches on the Accept header instead).
     * `customDomain: true` omits the "no external scripts" hardening so webshop admin custom code
     * can run on its own custom domain. The route is terminal, so a matched request never also
     * falls through to a later, broader route (e.g. the webshop custom-domain catch-all).
     */
    private static frontendProxyRoutes(match: CaddyRoute['match'][number], proxyHost: string, port: number, options: { customDomain: boolean }): CaddyRoute[] {
        const proxy = {
            handler: 'reverse_proxy' as const,
            upstreams: [{ dial: `${proxyHost}:${port}` }],
        };

        return [
            {
                match: [match],
                handle: [...cspFrontendSubroutes(options), proxy],
                terminal: true,
            },
        ];
    }

    /**
     * Create a frontend route for the caddy config
     */
    static createFrontendRoutes(service: FrontendProjectName, workerId: string, proxyHost: string): CaddyRoute[] {
        const group = this.getGroup(service, workerId);
        const domain = CaddyConfigHelper.getDomain(
            service,
            workerId,
        );
        const port = this.getFrontendPort(service, workerId);

        const routes: CaddyRoute[] = [
            ...this.frontendProxyRoutes(
                { host: service === 'registration' ? [domain, '*.' + domain] : [domain] },
                proxyHost,
                port,
                { customDomain: false },
            ),
        ];

        if (service === 'registration') {
            // Custom registration domains keep the "no external scripts" hardening (production
            // parity): registration never allows admin-injected code, so customDomain stays false.
            routes.push(...this.frontendProxyRoutes(
                {
                    header_regexp: {
                        Host: {
                            pattern: '^inschrijven\\..+\\.' + Formatter.escapeRegex(this.getCustomDomainTld(workerId)) + '$',
                        },
                    },
                },
                proxyHost,
                port,
                { customDomain: false },
            ));
        }

        if (service === 'webshop') {
            // Every custom domain ending with the custom TLD that is NOT a registration domain
            // (which starts with 'inschrijven') is interpreted as a webshop. RE2 has no negative
            // lookahead, so we rely on the registration route being registered first and terminal
            // in createRouteOptions. customDomain: true drops the "no external scripts" CSP so a
            // webshop's admin custom code can run on its own custom domain (as in production).
            routes.push(...this.frontendProxyRoutes(
                {
                    header_regexp: {
                        Host: {
                            pattern: '^.+\\.' + Formatter.escapeRegex(this.getCustomDomainTld(workerId)) + '$',
                        },
                    },
                },
                proxyHost,
                port,
                { customDomain: true },
            ));
        }

        return routes;
    }

    static createBackendRoute(service: 'api', workerId: string, proxyHost: string): CaddyRoute {
        const group = this.getGroup(service, workerId);
        const domain = CaddyConfigHelper.getDomain(
            service,
            workerId,
        );
        const port = this.getPort(service, workerId);

        return {
            group,
            match: [
                {
                    host: [domain, '*.' + domain],
                },
            ],
            handle: [
                {
                    handler: 'reverse_proxy',
                    upstreams: [
                        {
                            dial: `${proxyHost}:${port}`,
                        },
                    ],
                    headers: {
                        request: {
                            set: {
                                'x-real-ip': ['{http.request.remote}'],
                            },
                        },
                    },
                },
                {
                    handler: 'headers',
                    response: {
                        set: {
                            'Cache-Control': ['no-store'],
                        },
                    },
                },
            ],
        };
    }

    /**
     * Route to the SSO (Keycloak) server. Not per worker: one server serves every worker, and both
     * the browser and the backends reach it over HTTPS through Caddy (Keycloak is started with
     * `--proxy-headers=xforwarded`, so it builds its URLs from the headers Caddy sets).
     */
    static createSsoRoute(proxyHost: string): CaddyRoute {
        return {
            group: `${this.GROUP_PREFIX}-sso`,
            match: [
                {
                    host: [this.getSsoDomain()],
                },
            ],
            handle: [
                {
                    handler: 'reverse_proxy',
                    upstreams: [
                        {
                            dial: `${proxyHost}:${this.getSsoPort()}`,
                        },
                    ],
                },
            ],
        };
    }

    /**
     * Create the caddy routes of this run: only the workers it actually starts, on the slots it
     * reserved. Routes of runs in other worktrees live in their own manifest and are merged in by
     * the CLI when it renders the shared Caddy config.
     */
    static createRouteOptions(options: { proxyHost: string; workerCount: number }): CaddyRouteOptions {
        const routes: CaddyRoute[] = [this.createSsoRoute(options.proxyHost)];

        for (let workerId = 0; workerId < options.workerCount; workerId += 1) {
            routes.push(
                ...this.createFrontendRoutes('dashboard', workerId.toString(), options.proxyHost),
                // registration must come before webshop: its terminal 'inschrijven.*' custom-domain
                // route has to win over the webshop catch-all on the shared custom TLD.
                ...this.createFrontendRoutes('registration', workerId.toString(), options.proxyHost),
                ...this.createFrontendRoutes('webshop', workerId.toString(), options.proxyHost),
            );

            routes.push(
                this.createBackendRoute('api', workerId.toString(), options.proxyHost),
            );
        }

        const tlsSubjects = Formatter.uniqueArray(routes.flatMap(r => 'host' in r.match[0] ? r.match[0].host : []));

        return {
            routes,
            tlsSubjects,
        };
    }

    /**
     * Create the default playwright caddy config
     */
    static createDefault(options: { adminListen: string; adminOrigin: string; httpListen: string; httpsListen: string; proxyHost: string; workerCount: number }) {
        const { routes, tlsSubjects } = this.createRouteOptions(options);

        const config = {
            admin: {
                listen: options.adminListen,
                origins: [options.adminOrigin],
            },
            apps: {
                http: {
                    servers: {
                        stamhoofd: {
                            listen: [options.httpsListen, options.httpListen],
                            routes,
                            automatic_https: {
                                disable_redirects: true,
                            },
                        },
                    },
                },
                tls: {
                    automation: {
                        policies: [
                            {
                                subjects: tlsSubjects,
                                on_demand: false,
                                issuers: [
                                    {
                                        module: 'internal',
                                    },
                                ],
                            },
                            {
                                on_demand: true,
                                issuers: [
                                    {
                                        module: 'internal',
                                    },
                                ],
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

        return config;
    }
}
