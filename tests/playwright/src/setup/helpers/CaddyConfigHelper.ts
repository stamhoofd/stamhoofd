import { Formatter } from '@stamhoofd/utility';
import type { FrontendProjectName } from './FrontendService.js';
import type { CaddyRoute, CaddyRouteOptions } from '@stamhoofd/cli';

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
            {
                match: [
                    {
                        host: service === 'registration' ? [domain, '*.' + domain] : [domain],
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
                    },
                ],
                terminal: true,
            },
        ];

        if (service === 'registration') {
            routes.push({
                match: [
                    {
                        header_regexp: {
                            Host: {
                                pattern: '^inschrijven\\..+\\.' + Formatter.escapeRegex(this.getCustomDomainTld(workerId)) + '$',
                            },
                        },
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
                    },
                ],
                terminal: true,
            });
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
                ...this.createFrontendRoutes('webshop', workerId.toString(), options.proxyHost),
                ...this.createFrontendRoutes('registration', workerId.toString(), options.proxyHost),
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
                        on_demand: {},
                    },
                },
            },
        };

        return config;
    }
}
