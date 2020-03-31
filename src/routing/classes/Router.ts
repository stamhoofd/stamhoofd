import { Endpoint } from "./Endpoint";
import { promises as fs } from "fs";
import { Request } from "./Request";
import { EncodedResponse } from "./EncodedResponse";

async function directoryExists(filePath): Promise<boolean> {
    try {
        return (await fs.stat(filePath)).isDirectory();
    } catch (err) {
        return false;
    }
}

async function asyncForEach(array, callback) {
    for (let index = 0; index < array.length; index++) {
        await callback(array[index], index, array);
    }
}
type GenericEndpoint = Endpoint<any, any, any, any>;
type EndpointConstructor = { new (): GenericEndpoint };

function isEndpointType(endpoint: any): endpoint is EndpointConstructor {
    return endpoint.prototype instanceof Endpoint;
}

export class Router {
    endpoints: GenericEndpoint[] = [];

    async loadAllEndpoints(folder: string) {
        const folders = (await fs.readdir(folder, { withFileTypes: true })).filter(dirent => dirent.isDirectory());

        await asyncForEach(folders, async dirent => {
            const p = folder + "/" + dirent.name + "/endpoints";
            if (await directoryExists(p)) {
                console.log("Endpoints from " + dirent.name);
                await this.loadEndpoints(p);
            }
        });
    }

    /// Run migrations in the given folder
    async loadEndpoints(folder: string) {
        /// Query all migrations
        const files = await fs.readdir(folder);

        await asyncForEach(files, async file => {
            const p = folder + "/" + file;
            if (file.includes(".test.")) {
                return;
            }
            const imported = await import(p);
            for (const key in imported) {
                const element = imported[key];
                if (isEndpointType(element)) {
                    console.log("Loaded " + key);
                    this.endpoints.push(new element());
                }
            }
        });
    }

    async run(request: Request): Promise<EncodedResponse | null> {
        for (let index = 0; index < this.endpoints.length; index++) {
            const endpoint = this.endpoints[index];
            const response = await endpoint.run(request);
            if (response !== null) {
                return response;
            }
        }
        return null;
    }
}
