import { promises as fs } from 'fs';
import http from 'http';

import { Response } from './Response.js';
import { Endpoint } from './Endpoint.js';
import { Request } from './Request.js';
import { DecodedRequest } from './DecodedRequest.js';

async function directoryExists(filePath): Promise<boolean> {
    try {
        return (await fs.stat(filePath)).isDirectory();
    } catch (err) {
        return false;
    }
}

type GenericEndpoint = Endpoint<any, any, any, any>;
type EndpointConstructor = { new (): GenericEndpoint };

function isEndpointType(endpoint: any): endpoint is EndpointConstructor {
    return endpoint.prototype instanceof Endpoint;
}

export class Router {
    endpoints: GenericEndpoint[] = [];
    verbose = false;

    async loadAllEndpoints(folder: string) {
        const parts = folder.split('/');
        const firstPart = parts.shift();
        if (firstPart === undefined) {
            throw new Error('Invalid folder path');
        }
        let folderQueue: string[] = [firstPart];

        for (const part of parts) {
            if (part == '*') {
                const newQueue: string[] = [];
                for (folder of folderQueue) {
                    // Read all directories
                    const recursiveFolders = (await fs.readdir(folder, { withFileTypes: true }))
                        .filter(dirent => dirent.isDirectory())
                        .map(dirent => folder + '/' + dirent.name);
                    newQueue.push(...recursiveFolders);
                }
                folderQueue = newQueue;
            } else {
                folderQueue = folderQueue.map(folder => folder + '/' + part);
            }
        }

        for (const f of folderQueue) {
            if (await directoryExists(f)) {
                if (this.verbose) {
                    console.log('Endpoints from ' + f);
                }
                await this.loadEndpoints(f);
            }
        }
    }

    /** Imports endpoint constructors from .ts/.js files, excluding tests and declarations. */
    async loadEndpoints(folder: string) {
        const files = await fs.readdir(folder);

        for (const file of files) {
            const p = folder + '/' + file;
            if (file.includes('.test.')) {
                continue;
            }
            if (file.endsWith('.d.ts')) {
                continue;
            }
            if (!file.endsWith('.ts') && !file.endsWith('.js')) {
                continue;
            }
            const imported = await import(p);
            for (const key in imported) {
                const element = imported[key];
                if (isEndpointType(element)) {
                    if (this.verbose) {
                        console.log('Loaded ' + key);
                    }
                    this.endpoints.push(new element());
                }
            }
        }
    }

    /* async run(request: Request, response?: http.ServerResponse): Promise<Response | null> {
        for (const endpoint of this.endpoints) {
            const r = await endpoint.run(request, response);
            if (r !== null) {
                return r;
            }
        }

        return null;
    } */

    /** Returns the first matching endpoint and decoded request, or null; does not call handle(). */
    async decode<Params, Query, Body>(request: Request, response?: http.ServerResponse): Promise<{ request: DecodedRequest<Params, Query, Body>; endpoint: Endpoint<Params, Query, Body, any> } | null> {
        for (const endpoint of this.endpoints) {
            const r = await endpoint.decode(request, response);
            if (r !== null) {
                return { request: r, endpoint };
            }
        }

        return null;
    }
}
