import getPort from "get-port";
import { CaddyHelper } from "./CaddyHelper";
import { NetworkHelper } from "./NetworkHelper";
import { ProcessHelper } from "./ProcessHelper";
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

        const childProcess = ProcessHelper.spawnWithCleanup(
            "yarn",
            ["lerna", "run", "dev", "--scope", "@stamhoofd/backend"],
            {
                env: {
                    ...process.env,
                    NODE_ENV: "test",
                    STAMHOOFD_ENV: "playwright",
                    PORT: port.toString(),
                    PLAYWRIGHT_WORKER_ID: workerId,
                },
                stdio: "inherit",
            },
        );

        return {
            caddyRoutes: this.createRoutes({ domain, port, group }),
            wait: async () => {
                await NetworkHelper.waitForUrl(
                    "http://" + domain + "/organizations/search",
                );
            },
            kill: async () => {
                childProcess.kill();
            },
        };
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
