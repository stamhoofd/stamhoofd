import { cp, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { NetworkHelper } from "./NetworkHelper";
import { PlaywrightCaddyConfigHelper } from "./PlaywrightCaddyConfigHelper";
import { ServiceHelper, ServiceProcess } from "./ServiceHelper";

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
        console.log("Start copy project dist...");
        await this.copyProjectDist();
        console.log("Done copy project dist.");
        console.log("Start inject script...");
        await this.injectScript();
        console.log("Done inject script.");
    }

    private async copyProjectDist() {
        const sourcePath = this.getProjectDistPath();
        console.log(`Source path: ${sourcePath}`);

        const destinationPath = this.getDestinationDistPath(this.workerId);
        console.log(`Destination path: ${destinationPath}`);

        // copy source to destination
        try {
            await cp(sourcePath, destinationPath, {
                recursive: true,
                force: true,
            });
            console.log("Done copy project dist.");
        } catch (err) {
            console.error('Failed to copy project dist')
            console.error(err);
            throw err; // re-throw so CI fails
        }
    }

    private getProjectDistPath() {
        console.log("Getting project dist path...");
        const thisDirectoryToRoot = "../../../../..";
        const pathFromRoot = "frontend/app";
        const distFolder = "dist-playwright";
        const sourcePath = `${thisDirectoryToRoot}/${pathFromRoot}/${this.name}/${distFolder}`;
        return resolve(__dirname, sourcePath);
    }

    private getDestinationDistPath(workerId: string) {
        console.log("Getting destination dist path...");
        return resolve(__dirname, `../../../dist/${this.name}/${workerId}`);
    }

    private async injectScript() {
        const directory = this.getDestinationDistPath(this.workerId);
        const path = resolve(directory, "index.html");

        // Read the file
        console.log("Start reading file...");
        let html = await readFile(path, "utf-8");
        console.log("Done reading file...");

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

        console.log("Start writing file...");
        // Write the modified file back
        await writeFile(path, html, "utf-8");
        console.log("Done writing file.");
    }
}
