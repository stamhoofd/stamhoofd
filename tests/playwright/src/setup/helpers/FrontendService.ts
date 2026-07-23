import { CSP_NONCE_PLACEHOLDER, getProjectPath } from '@stamhoofd/cli';
import { createReadStream } from 'node:fs';
import { cp, readFile, stat, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import type { IncomingMessage, Server, ServerResponse } from 'node:http';
import { extname, join, resolve } from 'node:path';
import { CaddyConfigHelper } from './CaddyConfigHelper.js';
import { NetworkHelper } from './NetworkHelper.js';
import type { ServiceHelper, ServiceProcess } from './ServiceHelper.js';
import type { Socket } from 'node:net';

export type FrontendProjectName = 'dashboard' | 'registration' | 'webshop';

/**
 * The unified web-app now serves both the dashboard and registration apps.
 * Map caddy service names to the actual frontend project directory
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
        const { server, sockets } = await this.startStaticServer();

        return {
            name: 'Static frontend server ' + this.name,
            wait: async () => {
                await NetworkHelper.waitForUrl(
                    CaddyConfigHelper.getUrl(this.name, this.workerId),
                );
            },
            kill: async () => {
                await new Promise<void>((resolve, reject) => {
                    // Kill open connections
                    server.headersTimeout = 1;
                    server.keepAliveTimeout = 1;

                    server.close((error) => {
                        if (error) {
                            reject(error);
                            return;
                        }
                        resolve();
                    });

                    // Destroy all active sockets immediately
                    for (const socket of sockets) {
                        socket.destroy();
                    }
                    sockets.clear();
                });
            },
        };
    }

    private async startStaticServer(): Promise<{ server: Server; sockets: Set<Socket> }> {
        const root = this.getDestinationDistPath(this.workerId);
        const port = CaddyConfigHelper.getFrontendPort(this.name, this.workerId);
        const server = createServer((request, response) => {
            void this.handleStaticRequest(root, request, response);
        });

        // Set a timeout for all requests to make sure nothing keeps hanging for too long
        server.setTimeout(10_000);
        const sockets = new Set<Socket>();

        server.on('connection', (socket) => {
            sockets.add(socket);

            socket.on('close', () => {
                sockets.delete(socket);
            });
        });

        await new Promise<void>((resolveListen, rejectListen) => {
            server.once('error', rejectListen);
            server.listen(port, '127.0.0.1', () => {
                server.off('error', rejectListen);
                resolveListen();
            });
        });

        return { server, sockets };
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
        } catch (error) {
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
        } catch (err) {
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

        // Every playwright frontend (dashboard, registration, webshop) is served with a
        // strict-dynamic CSP (Caddy sets the header + rewrites the nonce placeholder, see
        // CaddyConfigHelper). A response-header CSP applies to the whole document regardless of
        // order, so this injected external env script must carry the nonce to run. Caddy rewrites
        // the placeholder to the real per-request nonce along with the rest of the document.
        const scriptToInject = `<script nonce="${CSP_NONCE_PLACEHOLDER}" src="${scriptSrc}"></script>`;

        const placeholder = '<!--IMPORT_ENV-->';

        if (html.includes(placeholder)) {
            html = html.replace(placeholder, scriptToInject);
        } else {
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
