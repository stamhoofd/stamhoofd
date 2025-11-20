import { cp, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { NetworkHelper } from "./NetworkHelper";
import { PlaywrightCaddyConfigHelper } from "./PlaywrightCaddyConfigHelper";
import { ServiceHelper, ServiceProcess } from "./ServiceHelper";
import { getCurrentDir } from "./getCurrentDir";

export type FrontendProjectName = "dashboard" | "registration" | "webshop";

export class FrontendService implements ServiceHelper {
    constructor(
        private name: FrontendProjectName,
        private workerId: string,
    ) {}

    /**
     * Start the frontend services
     * @param workerIndex
     */
    async start(): Promise<ServiceProcess> {
        await this.build();

        const domain = PlaywrightCaddyConfigHelper.getDomain(
            this.name,
            this.workerId,
        );

        const route = PlaywrightCaddyConfigHelper.createFrontendRoute({
            root: this.getDestinationDistPath(this.workerId),
            domains: [domain],
            group: PlaywrightCaddyConfigHelper.getGroup(
                this.name,
                this.workerId,
            ),
        });

        return {
            caddyConfig: {
                domains: [
                    PlaywrightCaddyConfigHelper.getDomain(
                        this.name,
                        this.workerId,
                    ),
                ],
                routes: [route],
            },
            wait: async () => {
                await NetworkHelper.waitForUrl(
                    "http://" +
                        PlaywrightCaddyConfigHelper.getDomain(
                            this.name,
                            this.workerId,
                        ),
                );
            },
            kill: async () => {
                // todo: clear dist folder?
            },
        };
    }

    private async build() {
        await this.copyProjectDist();
        await this.injectScript();
    }

    private async copyProjectDist() {
        // copy source to destination
        await cp(
            this.getProjectDistPath(),
            this.getDestinationDistPath(this.workerId),
            {
                recursive: true,
                force: true,
            },
        );
    }

    private getProjectDistPath() {
        const thisDirectoryToRoot = "../../../../..";
        const pathFromRoot = "frontend/app";
        const distFolder = "dist-playwright";
        const sourcePath = `${thisDirectoryToRoot}/${pathFromRoot}/${this.name}/${distFolder}`;
        return resolve(getCurrentDir(import.meta), sourcePath);
    }

    private getDestinationDistPath(workerId: string) {
        return resolve(
            getCurrentDir(import.meta),
            `../../../dist/${this.name}/${workerId}`,
        );
    }

    private async injectScript() {
        const directory = this.getDestinationDistPath(this.workerId);
        const path = resolve(directory, "index.html");

        // Read the file
        let html = await readFile(path, "utf-8");

        // Define the script you want to inject
        const apiUrl = PlaywrightCaddyConfigHelper.getUrl("api", this.workerId);
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
    }
}
