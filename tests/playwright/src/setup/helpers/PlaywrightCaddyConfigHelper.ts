import { resolve } from "node:path";
import { CaddyHelper } from "./CaddyHelper";

/**
 * Helper to create caddy configuration for playwright
 */
export class PlaywrightCaddyConfigHelper {
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
        service: "api" | "dashboard" | "registration" | "webshop" | string,
        workerId: string,
    ) {
        return `playwright-${service}-${workerId}.stamhoofd`;
    }

    /**
     * Get the url for the service and worker id
     */
    static getUrl(
        service: "api" | "dashboard" | "registration" | "webshop" | string,
        workerId: string,
    ) {
        return "https://" + this.getDomain(service, workerId);
    }

    /**
     * Create a frontend route for the caddy config
     */
    static createFrontendRoute({
        domains,
        group,
        root
    }: {
        domains: string[];
        root: string;
        group?: string;
    }) {
        return {
            group,
            match: [
                {
                    host: domains,
                },
            ],
            handle: [
                // {
                //     handler: "reverse_proxy",
                //     load_balancing: {
                //         retries: 5,
                //     },
                //     upstreams: [
                //         {
                //             dial: `127.0.0.1:${port}`,
                //         },
                //     ],
                // },
                // {
                //     handler: "file_server",
                //     root,
                // },
                {
                    handler: "subroute",
                    routes: [
                        {
                            handle: [
                                {
                                    handler: "file_server",
                                    root
                                },
                            ],
                        },
                    ],
                },
                // {
                //     handler: "rewrite",
                //     uri: "{http.request.uri.path}",
                //     rewrite: "{http.request.uri.path}",
                // },
                // {
                //     handler: "subroute",
                //     routes: [
                //         {
                //             match: [
                //                 {
                //                     file: {
                //                         try_files: [
                //                             "{http.request.uri.path}",
                //                             "/index.html",
                //                         ],
                //                     },
                //                 },
                //             ],
                //             handle: [
                //                 {
                //                     handler: "file_server",
                //                     root,
                //                 },
                //             ],
                //         },
                //     ],
                // },
            ],
        };
    }

    /**
     * Create the default playwright caddy config
     */
    static createDefault() {
        const service = "dashboard";
        const workerId = "0";
        const defaultDomain = this.getDomain(service, workerId);
        const defaultRoute = this.createFrontendRoute({
            domains: [defaultDomain],
            root: resolve(__dirname, `../../../dist/${service}/${workerId}`),
            group: this.getGroup(service, workerId),
        });

        const config = {
            admin: {
                listen: "0.0.0.0:2019",
            },
            apps: {
                http: {
                    servers: {
                        stamhoofd: {
                            listen: [":443", ":80"],
                            routes: [
                                defaultRoute,
                                {
                                    match: [
                                        {
                                            vars_regexp: {
                                                "{http.request.host}": {
                                                    pattern: "^inschrijven\\.",
                                                },
                                            },
                                        },
                                    ],
                                    handle: [
                                        {
                                            handler: "reverse_proxy",
                                            load_balancing: {
                                                retries: 5,
                                            },
                                            upstreams: [
                                                {
                                                    dial: "127.0.0.1:8081",
                                                },
                                            ],
                                        },
                                    ],
                                },
                                {
                                    handle: [
                                        {
                                            handler: "reverse_proxy",
                                            load_balancing: {
                                                retries: 5,
                                            },
                                            upstreams: [
                                                {
                                                    dial: "127.0.0.1:8082",
                                                },
                                            ],
                                        },
                                    ],
                                },
                            ],
                        },
                    },
                },
                tls: {
                    automation: {
                        policies: [
                            {
                                subjects: [defaultDomain],
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

    /**
     * Clear all caddy configuration for playwright
     * @param caddyHelper
     */
    static async clear(caddyHelper: CaddyHelper) {
        // delete routes
        await caddyHelper.deleteRoutesWhere((route: { group?: string }) => {
            if (route.group === undefined) {
                return false;
            }

            return route.group.startsWith(this.GROUP_PREFIX + "-");
        });

        // delete subjects
        await caddyHelper.deletePolicySubjectsWhere((subject) =>
            subject.includes(this.GROUP_PREFIX),
        );
    }
}
