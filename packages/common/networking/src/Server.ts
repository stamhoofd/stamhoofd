import { Request, RequestInitializer, RequestResult } from './Request.js';
import { RequestMiddleware } from './RequestMiddleware.js';

/** API host and middleware configuration; each built request copies the current middleware list. */
export class Server {
    /**
     * Hostname, including http(s) and port
     */
    host: string;
    middlewares: RequestMiddleware[] = [];

    /**
     * When decoding the version headers of the response will be used if they are present.
     */
    versionHeaders: string[] = ['X-Version'];

    constructor(host: string) {
        this.host = host;
    }

    setVersionHeaders(headers: string[]) {
        this.versionHeaders = headers;
    }

    /**
     * Build an internal request. Start it manually.
     * Usefull if you need the reference to the request object in order to cancel it later.
     */
    build<T>(request: RequestInitializer<T>): Request<T> {
        const r = new Request(this, request);
        r.middlewares.push(...this.middlewares);
        return r;
    }

    /**
     * Build an internal request and start it immediately
     */
    request<T>(request: RequestInitializer<T>): Promise<RequestResult<T>> {
        return this.build(request).start();
    }
}
