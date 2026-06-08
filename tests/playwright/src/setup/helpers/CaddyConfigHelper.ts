import { Formatter } from '@stamhoofd/utility';
import type { FrontendProjectName } from './FrontendService.js';

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

    static cycledWorkerId(workerId: string) {
        const asNumber = parseInt(workerId);
        return asNumber % maximumRunners;
    }

    /**
     * Custom "organization domain" used to simulate an organization that points a
     * CNAME DNS record at us.
     */
    static getOrgDomain(workerId: string) {
        return `playwright-org-${this.cycledWorkerId(workerId)}.stamhoofd`;
    }

    static getOrgDomainUrl(workerId: string) {
        return 'https://' + this.getOrgDomain(workerId);
    }

    /**
     * Get the url for the service and worker id
     */
    static getUrl(
        service: 'api' | 'dashboard' | 'registration' | 'webshop' | 'renderer',
        workerId: string,
    ) {
        return 'https://' + this.getDomain(service, workerId);
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
    static createFrontendRoute(service: FrontendProjectName, workerId: string, proxyHost: string) {
        const group = this.getGroup(service, workerId);
        const domain = CaddyConfigHelper.getDomain(
            service,
            workerId,
        );
        const port = this.getFrontendPort(service, workerId);

        // The registration frontend serves the unified web-app. Route the simulated
        // organization domain (custom CNAME) to the same upstream so scenario 4 works.
        const hosts = service === 'registration'
            ? [domain, CaddyConfigHelper.getOrgDomain(workerId)]
            : [domain];

        return {
            group,
            match: [
                {
                    host: hosts,
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
        };
    }

    static createBackendRoute(service: 'api', workerId: string, proxyHost: string) {
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
    static createDefault(options: { adminListen: string; adminOrigin: string; httpListen: string; httpsListen: string; proxyHost: string }) {
        const routes: { match: { host: string[] }[] }[] = [];

        for (let workerId = 0; workerId < maximumRunners; workerId += 1) {
            routes.push(
                this.createFrontendRoute('dashboard', workerId.toString(), options.proxyHost),
                this.createFrontendRoute('webshop', workerId.toString(), options.proxyHost),
                this.createFrontendRoute('registration', workerId.toString(), options.proxyHost),
            );

            routes.push(
                this.createBackendRoute('api', workerId.toString(), options.proxyHost),
            );
        }

        const domains = Formatter.uniqueArray(routes.flatMap(r => r.match[0].host));

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
                                subjects: domains,
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
