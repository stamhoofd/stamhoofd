import getPort from "get-port";
import { createRequire } from 'node:module';
import { CaddyHelper } from "./CaddyHelper";
import { NetworkHelper } from "./NetworkHelper";
import { ServerHelper } from "./ServerHelper";
import { getDomain } from "./getDomain";

export class ApiServerHelper implements ServerHelper {
    private caddyHelper = new CaddyHelper();

    async start(workerId: string) {
        const group = `${this.caddyHelper.GROUP_PREFIX}-api-${workerId}`;
        const domain = getDomain("api", workerId);
        const port = await getPort();

        console.log(
            `Starting backend server with id ${workerId} on port ${port}...`,
        );
        await this.startApi({ port, workerId });

        return {
            domains: [domain],
            caddyRoutes: this.createRoutes({ domain, port, group }),
            wait: async () => {
                await NetworkHelper.waitForUrl(
                    "http://" + domain + "/organizations/search",
                );
            },
            kill: async () => {
                // do nothing
            },
        };
    }

    private async startApi({
        port,
        workerId,
    }: {
        port: number;
        workerId: string;
    }) {
        // set environment
        Object.entries({
            NODE_ENV: "test",
            STAMHOOFD_ENV: "playwright",
            PORT: port.toString(),
            PLAYWRIGHT_WORKER_ID: workerId,
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
