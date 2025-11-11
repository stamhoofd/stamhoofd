import getPort from "get-port";
import { CaddyHelper } from "./CaddyHelper";
import { NetworkHelper } from "./NetworkHelper";
import { ProcessHelper } from "./ProcessHelper";
import { ServerHelper } from "./ServerHelper";
import { getDomain } from "./getDomain";

export class FrontendServerHelper implements ServerHelper {
    private caddyHelper = new CaddyHelper();

    async start(workerIndex: string) {
        console.log(
            `Starting frontend servers with id ${workerIndex}...`,
        );

        const services = [
            {
                name: "dashboard",
                port: await getPort(),
                scope: "@stamhoofd/dashboard",
            },
            {
                name: "registration",
                port: await getPort(),
                scope: "@stamhoofd/registration",
                createRoute: (domain: string) => {
                    // return `*.${domain}`;
                    return domain;
                },
            },
            {
                name: "webshop",
                port: await getPort(),
                scope: "@stamhoofd/webshop",
            },
        ];

        console.log('domains:', JSON.stringify(services.map(s => getDomain(s.name, workerIndex))));
        console.log('ports:', JSON.stringify(services.map(s => s.port)));

        const childProcesses = services.map((s) => {
            console.log(`Starting ${s.name}...`);
            return ProcessHelper.spawnWithCleanup(
                "yarn",
                ["lerna", "run", "dev", "--scope", s.scope],
                {
                    env: {
                        ...process.env,
                        NODE_ENV: "test",
                        STAMHOOFD_ENV: "playwright",
                        PORT: s.port.toString(),
                        PLAYWRIGHT_WORKER_ID: workerIndex,
                    },
                },
            );
        });

        return {
            caddyRoutes: services.map((s) => {
                const domain = getDomain(s.name, workerIndex);
                return this.createFrontendRoute({
                    domains: s.createRoute ? [s.createRoute(domain)] : [domain],
                    port: s.port,
                    group: this.getGroup(s.name, workerIndex),
                });
            }),
            wait: async () => {
                for (const service of services) {
                    const domain = getDomain(service.name, workerIndex);
                    await NetworkHelper.waitForUrl("http://" + domain);
                }
            },
            kill: async () => {
                // await cleanupCaddy();
                for (const process of childProcesses) {
                    process.kill();
                }
            },
        };
    }

    private getGroup(service: string, serverId: string) {
        return `${this.caddyHelper.GROUP_PREFIX}-${service}-${serverId}`;
    }

    private createFrontendRoute({
        domains,
        port,
        group,
    }: {
        domains: string[];
        port: number;
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
                {
                    handler: "reverse_proxy",
                    load_balancing: {
                        retries: 5,
                    },
                    upstreams: [
                        {
                            dial: `127.0.0.1:${port}`,
                        },
                    ],
                },
            ],
        };
    }
}
