import { Formatter } from '@stamhoofd/utility';
import type { FrontendProjectName } from './FrontendService.js';
import type { CaddyRoute, CaddyRouteOptions } from '@stamhoofd/cli';
import { cspFrontendSubroutes } from '@stamhoofd/cli';

/**
 * Old domains and ports will get reused
 *
 * E.g. worker 32 will use same domains and ports as worker 2
 */
const maximumRunners = 30;

/**
 * Helper to create caddy configuration for playwright
 */
export class CaddyConfigHelper {
    static readonly GROUP_PREFIX = 'playwright';

    /**
     * Get the group name for the caddy routes
     */
    static getGroup(service: string, workerId: string) {
        return `${this.GROUP_PREFIX}-${service}-${workerId}`;
    }

    /**
     * Get the domain for the service and worker id
     */
    static getDomain(
        service: 'api' | 'dashboard' | 'registration' | 'webshop' | 'renderer',
        workerId: string,
    ) {
        return `playwright-${service}-${this.cycledWorkerId(workerId)}.stamhoofd`;
    }

    static getCustomDomainTld(
        workerId: string,
    ) {
        // IMPORTANT: custom registration domains may never end with getDomain('registration', workerId)
        // otherwise, the backend will try to resolve by URI, not by domain
        return `playwright-custom-${this.cycledWorkerId(workerId)}.stamhoofd`;
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

    static cycledWorkerId(workerId: string) {
        const asNumber = parseInt(workerId);
        return asNumber % maximumRunners;
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
        return 6000 + this.cycledWorkerId(workerId);
    }

    static getFrontendPort(service: FrontendProjectName, workerId: string) {
        const offset = service === 'dashboard' ? 6100 : service === 'registration' ? 6200 : 6300;
        return offset + this.cycledWorkerId(workerId);
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
     * Create the default playwright caddy config
     */
    static createRouteOptions(options: { proxyHost: string }): CaddyRouteOptions {
        const routes: CaddyRoute[] = [];

        for (let workerId = 0; workerId < maximumRunners; workerId += 1) {
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
    static createDefault(options: { adminListen: string; adminOrigin: string; httpListen: string; httpsListen: string; proxyHost: string }) {
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
