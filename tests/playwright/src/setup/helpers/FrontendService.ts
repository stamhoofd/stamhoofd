import { cp, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { CaddyConfigHelper } from './CaddyConfigHelper';
import { NetworkHelper } from './NetworkHelper';
import { ServiceHelper, ServiceProcess } from './ServiceHelper';

export type FrontendProjectName = 'dashboard' | 'registration' | 'webshop';

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

        return {
            wait: async () => {
                await NetworkHelper.waitForUrl(
                    'http://'
                    + CaddyConfigHelper.getDomain(
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
        const sourcePath = this.getProjectDistPath();

        const destinationPath = this.getDestinationDistPath(this.workerId);

        // copy source to destination
        try {
            await cp(sourcePath, destinationPath, {
                recursive: true,
                force: true,
            });
        }
        catch (err) {
            console.error('Failed to copy project dist');
            console.error(err);
            throw err; // re-throw so CI fails
        }
    }

    private getProjectDistPath() {
        const thisDirectoryToRoot = '../../../../..';
        const pathFromRoot = 'frontend/app';
        const distFolder = 'dist-playwright';
        const sourcePath = `${thisDirectoryToRoot}/${pathFromRoot}/${this.name}/${distFolder}`;
        return resolve(__dirname, sourcePath);
    }

    static getDestinationDistPath(service: FrontendProjectName, workerId: string) {
        return resolve(__dirname, `../../../dist/${service}/${workerId}`);
    }

    getDestinationDistPath(workerId: string) {
        return FrontendService.getDestinationDistPath(this.name, workerId);
    }

    private async injectScript() {
        const directory = this.getDestinationDistPath(this.workerId);
        const path = resolve(directory, 'index.html');

        // Read the file
        let html = await readFile(path, 'utf-8');

        // Define the script you want to inject
        const apiUrl = CaddyConfigHelper.getUrl('api', this.workerId);
        const scriptSrc = `${apiUrl}/frontend-environment`;
        const scriptToInject = `<script src="${scriptSrc}"></script>`;

        const placeholder = '<!--IMPORT_ENV-->';

        if (html.includes(placeholder)) {
            html = html.replace(placeholder, scriptToInject);
        }
        else {
            throw new Error(`Placeholder ${placeholder} not found in ${path}`);
        }

        // Write the modified file back
        await writeFile(path, html, 'utf-8');
    }
}
