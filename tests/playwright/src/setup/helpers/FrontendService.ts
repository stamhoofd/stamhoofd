import { getProjectPath } from '@stamhoofd/cli';
import { createReadStream } from 'node:fs';
import { cp, readFile, stat, writeFile } from 'node:fs/promises';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { extname, join, resolve } from 'node:path';
import { CaddyConfigHelper } from './CaddyConfigHelper.js';
import { NetworkHelper } from './NetworkHelper.js';
import type { ServiceHelper, ServiceProcess } from './ServiceHelper.js';

export type FrontendProjectName = 'dashboard' | 'registration' | 'webshop';

/**
 * The unified web-app now serves both the dashboard and registration apps.
 * Map caddy service names to the actual frontend project directory.
 */
const projectNameMap: Partial<Record<FrontendProjectName, string>> = {
    dashboard: 'web-app',
    registration: 'web-app',
};

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
        const server = await this.startStaticServer();

        return {
            wait: async () => {
                await NetworkHelper.waitForUrl(
                    CaddyConfigHelper.getUrl(this.name, this.workerId),
                );
            },
            kill: async () => {
                await new Promise<void>((resolve, reject) => {
                    server.close((error) => {
                        if (error) {
                            reject(error);
                            return;
                        }
                        resolve();
                    });
                });
            },
        };
    }

    private async startStaticServer(): Promise<Server> {
        const root = this.getDestinationDistPath(this.workerId);
        const port = CaddyConfigHelper.getFrontendPort(this.name, this.workerId);
        const server = createServer((request, response) => {
            void this.handleStaticRequest(root, request, response);
        });

        await new Promise<void>((resolveListen, rejectListen) => {
            server.once('error', rejectListen);
            server.listen(port, '127.0.0.1', () => {
                server.off('error', rejectListen);
                resolveListen();
            });
        });

        return server;
    }

    private async handleStaticRequest(root: string, request: IncomingMessage, response: ServerResponse) {
        try {
            const requestUrl = new URL(request.url ?? '/', `http://${request.headers.host ?? 'localhost'}`);
            const requestedPath = decodeURIComponent(requestUrl.pathname);
            const normalizedPath = requestedPath.includes('..') ? '/index.html' : requestedPath;
            const relativePath = normalizedPath === '/' ? 'index.html' : normalizedPath.slice(1);
            const filePath = join(root, relativePath);
            const fileStat = await stat(filePath).catch(() => undefined);
            const resolvedPath = fileStat?.isFile() ? filePath : join(root, 'index.html');

            response.setHeader('Content-Type', contentType(resolvedPath));
            createReadStream(resolvedPath).pipe(response);
        }
        catch (error) {
            response.statusCode = 500;
            response.end('Internal server error');
        }
    }

    private async build() {
        await this.copyProjectDist();
        await this.injectScript();
    }

    private async copyProjectDist() {
        const sourcePath = await this.getProjectDistPath();

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

    private async getProjectDistPath() {
        const thisDirectoryToRoot = getProjectPath();
        const pathFromRoot = 'frontend/app';
        const distFolder = 'dist-playwright';
        const projectName = projectNameMap[this.name] ?? this.name;
        const sourcePath = `${thisDirectoryToRoot}${pathFromRoot}/${projectName}/${distFolder}`;
        return resolve(import.meta.dirname, sourcePath);
    }

    static getDestinationDistPath(service: FrontendProjectName, workerId: string) {
        return resolve(import.meta.dirname, `../../../dist/${service}/${workerId}`);
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

function contentType(filePath: string) {
    switch (extname(filePath)) {
        case '.css':
            return 'text/css';
        case '.html':
            return 'text/html';
        case '.js':
            return 'application/javascript';
        case '.json':
            return 'application/json';
        case '.svg':
            return 'image/svg+xml';
        case '.wasm':
            return 'application/wasm';
        default:
            return 'application/octet-stream';
    }
}
