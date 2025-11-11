import { Formatter } from '@stamhoofd/utility';
import { FrontendProjectName, FrontendService } from "./FrontendService";

/**
 * Helper to create caddy configuration for playwright
 */
export class CaddyConfigHelper {
    static readonly GROUP_PREFIX = "playwright";

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
        service: "api" | "dashboard" | "registration" | "webshop" | 'renderer',
        workerId: string,
    ) {
        return `playwright-${service}-${workerId}.stamhoofd`;
    }

    /**
     * Get the url for the service and worker id
     */
    static getUrl(
        service: "api" | "dashboard" | "registration" | "webshop" | 'renderer',
        workerId: string,
    ) {
        return "https://" + this.getDomain(service, workerId);
    }


    static getPort(
        service: "api",
        workerId: string) {
        const asNumber = parseInt(workerId)
        return 6000 + asNumber;
    }

    /**
     * Create a frontend route for the caddy config
     */
    static createFrontendRoute(service: FrontendProjectName, workerId: string) {
        const root = FrontendService.getDestinationDistPath(service, workerId)
        const group = this.getGroup(service, workerId)
        const domain = CaddyConfigHelper.getDomain(
            service,
            workerId,
        );
        
        return {
            group,
            match: [
                {
                    host: [domain],
                },
            ],
            handle: [
                // todo cache and compression headers
                {
                    handler: 'file_server',
                    root,
                    pass_thru: true,
                },
                {
                    handler: 'rewrite',
                    uri: '/index.html',
                },
                {
                    handler: 'file_server',
                    root
                },
            ],
            terminal: true,
        };
    }

    static createBackendRoute(service: 'api', workerId: string) {
        const group = this.getGroup(service, workerId)
        const domain = CaddyConfigHelper.getDomain(
            service,
            workerId,
        )
        const port = this.getPort(service, workerId);
        
        return {
            group,
            match: [
                {
                    host: [domain, "*." + domain],
                },
            ],
            handle: [
                {
                    handler: "reverse_proxy",
                    upstreams: [
                        {
                            dial: `127.0.0.1:${port}`,
                        },
                    ],
                    headers: {
                        request: {
                            set: {
                                "x-real-ip": ["{http.request.remote}"],
                            },
                        },
                    },
                },
                {
                    handler: "headers",
                    response: {
                        set: {
                            "Cache-Control": ["no-store"],
                        },
                    },
                },
            ],
        };
    }


    /**
     * Create the default playwright caddy config
     */
    static createDefault() {
        const routes: {match: {host: string[]}[]}[] = [];
        const maximumWorkers = 20;

        for (let workerId = 0; workerId < maximumWorkers; workerId += 1) {
            routes.push(
                this.createFrontendRoute('dashboard', workerId.toString()),
                this.createFrontendRoute('webshop', workerId.toString()),
                this.createFrontendRoute('registration', workerId.toString())
            )

            routes.push(
                this.createBackendRoute('api', workerId.toString())
            )
        }

        const domains = Formatter.uniqueArray(routes.flatMap(r => r.match[0].host))

        const config = {
            admin: {
                listen: "0.0.0.0:2019",
            },
            apps: {
                http: {
                    servers: {
                        stamhoofd: {
                            listen: [":443", ":80"],
                            routes
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
                                        module: "internal",
                                    },
                                ],
                            },
                            {
                                on_demand: true,
                                issuers: [
                                    {
                                        module: "internal",
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
