import { cp, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { CaddyHelper } from "./CaddyHelper";
import { NetworkHelper } from "./NetworkHelper";
import { ServerHelper } from "./ServerHelper";
import { getDomain } from "./getDomain";
import { getUrl } from "./getUrl";

type FrontendProjectType = "dashboard" | "registration" | "webshop";

export class FrontendServerHelper implements ServerHelper {
    private caddyHelper = new CaddyHelper();

    private frontendProjects: FrontendProjectType[] = [
        "dashboard",
        "registration",
        "webshop",
    ];

    private getGroup(service: string, serverId: string) {
        return `${this.caddyHelper.GROUP_PREFIX}-${service}-${serverId}`;
    }

    private createFrontendRoute({
        domains,
        group,
        root,
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
                {
                    handler: "file_server",
                    root,
                },
                // {
                //     handler: "rewrite",
                //     uri: "{http.request.uri.path}",
                //     rewrite: "{http.request.uri.path}",
                // },
                {
                    handler: "subroute",
                    routes: [
                        {
                            match: [
                                {
                                    file: {
                                        try_files: [
                                            "{http.request.uri.path}",
                                            "/index.html",
                                        ],
                                    },
                                },
                            ],
                            handle: [
                                {
                                    handler: "file_server",
                                    root,
                                },
                            ],
                        },
                    ],
                },
            ],
        };
    }

    async start(workerIndex: string) {
        // in worker: copy build and change index.html to get environment from api
        // configure caddy to open build folder when going to domain

        await this.build(workerIndex);

        return {
            domains: this.frontendProjects.map((project) =>
                getDomain(project, workerIndex),
            ),
            caddyRoutes: this.frontendProjects.map((project) => {
                const domain = getDomain(project, workerIndex);

                return this.createFrontendRoute({
                    root: this.getDestinationDistPath(project, workerIndex),
                    domains: [domain],
                    group: this.getGroup(project, workerIndex),
                });
            }),
            wait: async () => {
                await Promise.all(
                    this.frontendProjects.map((project) =>
                        NetworkHelper.waitForUrl(
                            "http://" + getDomain(project, workerIndex),
                        ),
                    ),
                );
            },
            kill: async () => {
                // todo: clear dist folder?
            }
        };
    }

    async build(workerId: string) {
        console.log(`Start building frontend for worker ${workerId}...`);

        // copy playwright dist
        await Promise.all(
            this.frontendProjects.map((project) =>
                this.buildProject(project, workerId),
            ),
        );

        console.log(`Done building frontend for worker ${workerId}.`);
    }

    private async buildProject(project: FrontendProjectType, workerId: string) {
        await this.copyProjectDist(project, workerId);
        await this.injectScript(project, workerId);
    }

    private async copyProjectDist(
        project: FrontendProjectType,
        workerId: string,
    ) {
        // copy source to destination
        await cp(
            this.getProjectDistPath(project),
            this.getDestinationDistPath(project, workerId),
            {
                recursive: true,
                force: true,
            },
        );
    }

    private getCurrentDir() {
        return dirname(fileURLToPath(import.meta.url));
    }

    private getProjectDistPath(project: FrontendProjectType) {
        const thisDirectoryToRoot = "../../../../..";
        const pathFromRoot = "frontend/app";
        const distFolder = "dist-playwright";
        const sourcePath = `${thisDirectoryToRoot}/${pathFromRoot}/${project}/${distFolder}`;
        return resolve(this.getCurrentDir(), sourcePath);
    }

    private getDestinationDistPath(
        project: FrontendProjectType,
        workerId: string,
    ) {
        return resolve(
            this.getCurrentDir(),
            `../../../dist/${project}/${workerId}`,
        );
    }

    private async injectScript(project: FrontendProjectType, workerId: string) {
        const directory = this.getDestinationDistPath(project, workerId);
        const path = resolve(directory, "index.html");

        // Read the file
        let html = await readFile(path, "utf-8");

        // Define the script you want to inject
        const apiUrl = getUrl("api", workerId);

        // const scriptSrc = `${apiUrl}/${Version}/frontend-environment`;
        const scriptSrc = `${apiUrl}/frontend-environment`;
        const scriptToInject = `<script src="${scriptSrc}"></script>`;

        const placeholder = "<!--IMPORT_ENV-->";

        if (html.includes(placeholder)) {
            html = html.replace(placeholder, scriptToInject);
        } else {
            throw new Error(`Placeholder ${placeholder} not found in ${path}`);
        }

        // Write the modified file back
        await writeFile(path, html, "utf-8");

        console.log("Script injected successfully!");
    }
}
