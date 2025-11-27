import { NetworkHelper } from "./NetworkHelper";
import { PlaywrightCaddyConfigHelper } from "./PlaywrightCaddyConfigHelper";
import { ServiceHelper, ServiceProcess } from "./ServiceHelper";
import { WorkerHelper } from "./WorkerHelper";
import { importModule } from "./importModule";

export class ApiService implements ServiceHelper {
    constructor(private workerId: string) {}

    async start(): Promise<ServiceProcess> {
        const group = `${PlaywrightCaddyConfigHelper.GROUP_PREFIX}-api-${this.workerId}`;
        const domain = PlaywrightCaddyConfigHelper.getDomain(
            "api",
            this.workerId,
        );

        // start api
        await importModule("@stamhoofd/backend");

        return {
            caddyConfig: {
                domains: [domain, "*." + domain],
                routes: this.createRoutes({ domain, group }),
            },
            wait: async () => {
                console.log("Waiting for backend server...");
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

    private createRoutes({ domain, group }: { domain: string; group: string }) {
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
                                dial: `127.0.0.1:${WorkerHelper.port}`,
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
