import { CSP_NONCE_PLACEHOLDER, getProjectPath } from '@stamhoofd/cli';
import { createReadStream } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
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
        const root = await this.getProjectDistPath();
        const html = await this.getIndexHtml(root);
        const { server, sockets } = await this.startStaticServer(root, html);

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

    private async startStaticServer(root: string, html: string): Promise<{ server: Server; sockets: Set<Socket> }> {
        const port = CaddyConfigHelper.getFrontendPort(this.name, this.workerId);
        const server = createServer((request, response) => {
            void this.handleStaticRequest(root, html, request, response);
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
            const onError = (error: NodeJS.ErrnoException) => {
                if (error.code === 'EADDRINUSE') {
                    // The port was reserved for this run (see CaddyHelper), so something outside
                    // the reservation took it: another process bound it after the reservation, or
                    // a previous run of this worker did not shut its server down.
                    rejectListen(new Error(`Port ${port} of worker ${this.workerId} (${this.name}) was reserved for this run but is already in use`));
                    return;
                }
                rejectListen(error);
            };

            server.once('error', onError);
            server.listen(port, '127.0.0.1', () => {
                server.off('error', onError);
                resolveListen();
            });
        });

        return { server, sockets };
    }

    private async handleStaticRequest(root: string, html: string, request: IncomingMessage, response: ServerResponse) {
        try {
            const requestUrl = new URL(request.url ?? '/', `http://${request.headers.host ?? 'localhost'}`);
            const requestedPath = decodeURIComponent(requestUrl.pathname);
            const normalizedPath = requestedPath.includes('..') ? '/index.html' : requestedPath;
            const relativePath = normalizedPath === '/' ? 'index.html' : normalizedPath.slice(1);
            const filePath = join(root, relativePath);
            const fileStat = await stat(filePath).catch(() => undefined);
            const resolvedPath = fileStat?.isFile() ? filePath : join(root, 'index.html');

            response.setHeader('Content-Type', contentType(resolvedPath));
            if (resolvedPath === join(root, 'index.html')) {
                response.end(html);
                return;
            }
            createReadStream(resolvedPath).pipe(response);
        } catch (error) {
            response.statusCode = 500;
            response.end('Internal server error');
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

    private async getIndexHtml(directory: string) {
        const path = resolve(directory, 'index.html');
        let html = await readFile(path, 'utf-8');

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

        // Assets are shared read-only; only the HTML contains worker-specific configuration.
        return html;
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
