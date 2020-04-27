import { Request, RequestInitializer,RequestResult } from './Request';
import { RequestMiddleware } from './RequestMiddleware';

export class Server {
    /**
     * Hostname, including http(s) and port
     */
    host: string
    middlewares: RequestMiddleware[] = []

    constructor(host: string) {
        this.host = host
    }

    request<T>(request: RequestInitializer<T>): Promise<RequestResult<T>>  {
        const r = new Request(this, request)
        r.middlewares.push(...this.middlewares)
        return r.start()
    }
}