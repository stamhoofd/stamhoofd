import getPort from "get-port";
import { createRequire } from "node:module";
import { NetworkHelper } from "./NetworkHelper";
import { PlaywrightCaddyConfigHelper } from "./PlaywrightCaddyConfigHelper";
import { ServiceHelper, ServiceProcess } from "./ServiceHelper";

export class ApiService implements ServiceHelper {
    constructor(private workerId: string) {}

    getCaddyRoutes(): any[] {
        throw new Error("Method not implemented.");
    }
    getDomains(): string[] {
        throw new Error("Method not implemented.");
    }

    async start(): Promise<ServiceProcess> {
        const group = `${PlaywrightCaddyConfigHelper.GROUP_PREFIX}-api-${this.workerId}`;
        const domain = PlaywrightCaddyConfigHelper.getDomain(
            "api",
            this.workerId,
        );
        const port = await getPort();

        console.log(
            `Starting backend server with id ${this.workerId} on port ${port}...`,
        );

        await this.startApi(port);

        return {
            caddyConfig: {
                domains: [domain, "*." + domain],
                routes: this.createRoutes({ domain, port, group }),
            },
            wait: async () => {
                await NetworkHelper.waitForUrl(
                    "http://" + domain + "/organizations/search",
                );
                console.log("Backend server ready");
            },
            kill: async () => {
                // do nothing
            },
        };
    }

    private async startApi(port: number) {
        // set environment
        Object.entries({
            NODE_ENV: "test",
            STAMHOOFD_ENV: "playwright",
            PORT: port.toString(),
            PLAYWRIGHT_WORKER_ID: this.workerId,
        }).forEach(([key, value]) => {
            process.env[key] = value;
        });

        const require = createRequire(import.meta.url);
        await require("@stamhoofd/backend");
    }

    private createRoutes({
        domain,
        port,
        group,
    }: {
        domain: string;
        port: number;
        group: string;
    }) {
        return [
            {
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
            },
        ];
    }
}
