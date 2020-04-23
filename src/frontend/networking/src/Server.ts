import { Request, RequestInitializer, RequestResult } from './Request';

export class Server {
    /**
     * Hostname, including http(s) and port
     */
    host: string

    request<T>(request: RequestInitializer<T>): Promise<RequestResult<T>>  {
        const r = new Request(this, request)
        return r.start()
    }
}