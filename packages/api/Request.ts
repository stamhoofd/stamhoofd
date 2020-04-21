
// Requests use middleware to extend its behaviour

import { RequestMiddleware } from './RequestMiddleware';

export type HTTPMethod = "GET" | "POST" | "PATCH" | "DELETE" | "PUT"

export class RequestResult {
    success: boolean;

    constructor(success: boolean) {
        this.success = success
    }
}

export class Request {
    /// Path, relative to API host
    path: string;
    method: HTTPMethod;

    headers: any;

    /**
     * Data that will get encoded in the URL of the request.
     */
    query: any | undefined;

    /**
     * Content that will get encoded in the body of the request (only for non GET requests)
     * Should be FormData (use this for uploading files) or it will get encoded as JSON
     */
    body: any | FormData | undefined;

    /// Shared middlewares that allows dependency injection here
    static sharedMiddlewares: RequestMiddleware[] = []

    /// Request specific middleware
    middlewares: RequestMiddleware[] = []

    constructor(request: {
        method: HTTPMethod;
        path: string;
        query?: any;
        body?: any;
        headers?: any;
    }) {
        this.method = request.method
        this.path = request.path
        this.query = request.query
        this.body = request.body
    }

    getMiddlewares(): RequestMiddleware[] {
        return Request.sharedMiddlewares.concat(this.middlewares)
    }

    async start(): Promise<RequestResult> {
        // todo: check if already running or not

        // todo: add query parameters
        for (const middleware of this.getMiddlewares()) {
            middleware.onBeforeRequest(this)
        }

        let response: Response

        try {
            let body: any;
            
            // We only support application/json or FormData for now
            if (this.body === undefined) {
                body = undefined;
            } else {
                if (this.body instanceof FormData) {
                    body = this.body
                } else {
                    this.headers['Content-Type'] = "application/json"
                    body = JSON.stringify(this.body);
                }
            }
            
            response = await fetch(this.path, {
                method: this.method,
                headers: this.headers,
                body: body,
            })
        } catch (error) {
            // Todo: map the error in our own error types to make error handling easier
            // network error is encountered or CORS is misconfigured on the server-side

            // A middleware might decide here to interrupt the callback
            // He might for example fire a timer to retry the request because of a network failure
            // Or it might decide to fetch a new access token because the current one is expired
            // They return a promise with a boolean value indicating that the request should get retried
            let retry = false
            for (const middleware of this.getMiddlewares()) {
                // Check if one of the middlewares decides to stop
                retry = retry || await middleware.shouldRetryError(this, error)
            }
            if (retry) {
                // Retry
                return await this.start()
            }

            // Failed and not caught
            throw error
        }
        
        // A middleware might decide here to interrupt the callback
        // He might for example fire a timer to retry the request because of a network failure
        // Or it might decide to fetch a new access token because the current one is expired
        // They return a promise with a boolean value indicating that the request should get retried
        let retry = false
        for (const middleware of this.getMiddlewares()) {
            // Check if one of the middlewares decides to stop
            retry = retry || await middleware.shouldRetryRequest(this, response)
        }

        if (retry) {
            // Retry
            return await this.start()
        }

        const json = await response.json()

        // todo: add automatic decoding here, so we know we are receiving what we expected with typings

        return new RequestResult(true)
    }
}