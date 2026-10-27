// Requests use middleware to extend its behaviour
import { isSimpleError, isSimpleErrors, SimpleError, SimpleErrors } from '@simonbackx/simple-errors';

import { RequestBag } from './RequestBag';
import { RequestMiddleware } from './RequestMiddleware';
import { Server } from './Server';

// We still support an older version of simple-encoding, so we stub EncodeMedium here
import * as simpleEncoding from '@simonbackx/simple-encoding';
import { type EncodableObject, type Decoder } from '@simonbackx/simple-encoding';

let EncodeMedium: typeof simpleEncoding.EncodeMedium;

if ('EncodeMedium' in simpleEncoding) {
    EncodeMedium = (simpleEncoding as any).EncodeMedium;
}
else {
    enum StubbedEncodeMedium {
        /**
         * The object will be sent over the network.
         */
        Network = 'Network',

        /**
         * The object will be stored in the database.
         */
        Database = 'Database',
    }

    EncodeMedium = StubbedEncodeMedium as any;
}

const {
    encodeObject,
    ObjectData,
} = simpleEncoding;

export type HTTPMethod = 'GET' | 'POST' | 'PATCH' | 'DELETE' | 'PUT';

export class RequestResult<T> {
    data: T;
    headers: any;
    responseVersion?: number;

    constructor(data: T, headers = {}, responseVersion?: number) {
        this.data = data;
        this.headers = headers;
        this.responseVersion = responseVersion;
    }
}

export interface RequestInitializer<T> {
    method: HTTPMethod;
    path: string;
    query?: EncodableObject | undefined;
    body?: EncodableObject | FormData;
    headers?: any;
    decoder?: Decoder<T>;
    version?: number;
    /** Milliseconds; initially 30 seconds for GET and 350 seconds for other methods. */
    timeout?: number;
    /** Enable network/server-error retry decisions by middleware; defaults to true, not a built-in retry policy. */
    shouldRetry?: boolean;
    /** Allow decoded API-error retries even when shouldRetry is false; defaults to true (e.g. token refresh). */
    allowErrorRetry?: boolean;
    responseType?: '' | 'text' | 'arraybuffer' | 'blob' | 'document' | 'json';

    /** In cases where the backend server doesn't or returns incorrect content types, we can override it */
    responseContentTypeOverride?: string;

    /**
     * If you want to associate a request bag to this request (so you can cancel all requests for a given instance easily and fast)
     */
    bag?: RequestBag;

    /**
     * Shorthand for 'bag: RequestBag.getOrCreate(self)'
     */
    owner?: any;
    overrideXMLHttpRequest?: any;
}

export type NetworkError = (SimpleError | SimpleErrors) & { readonly __isNetworkError?: never };
export type AbortError = (SimpleError | SimpleErrors) & { readonly __isAbortError?: never };
export type TimeoutError = (SimpleError | SimpleErrors) & { readonly __isTimeoutError?: never };

export class Request<T> {
    /// Path, relative to API host
    server: Server;
    path: string;
    method: HTTPMethod;
    version?: number;
    headers: any;
    responseType: '' | 'text' | 'arraybuffer' | 'blob' | 'document' | 'json';

    /** In cases where the backend server doesn't or returns incorrect content types, we can override it */
    responseContentTypeOverride?: string;

    /**
     * Enable middleware retries for network/server failures. Decoded API errors
     * can still be retried through allowErrorRetry. Cancellation disables both.
     */
    shouldRetry = true;

    /**
     * Even when shouldRetry is false, still allow to retry normal valid errors
     * often needed to refresh a token etc
     */
    allowErrorRetry = true;

    /**
     * Data that will get encoded in the URL of the request.
     */
    query: EncodableObject | undefined;

    /**
     * Content that will get encoded in the body of the request (only for non GET requests)
     * Should be FormData (use this for uploading files) or it will get encoded as JSON
     */
    body: EncodableObject | FormData | undefined;

    /// Shared middlewares that allows dependency injection here
    static sharedMiddlewares: RequestMiddleware[] = [];

    /// Request specific middleware
    middlewares: RequestMiddleware[] = [];

    decoder: Decoder<T> | undefined;
    errorDecoder: Decoder<SimpleErrors> | undefined = SimpleErrors;

    /// Milliseconds for fetch to timeout
    timeout?: number;

    bag?: RequestBag;

    static verbose = false;

    didFailNetwork = false;

    private XMLHttpRequest: XMLHttpRequest | null = null;

    /**
     * Set a custom implementation of XMLHttpRequest, useful when using e.g. Capacitor
     */
    overrideXMLHttpRequest?: any;

    constructor(server: Server, request: RequestInitializer<T>) {
        this.server = server;
        this.method = request.method;
        this.path = request.path;
        this.query = request.query;
        this.body = request.body;
        this.decoder = request.decoder;
        this.headers = request.headers ?? {};
        this.version = request.version;
        this.timeout = request.timeout;
        this.responseType = request.responseType ?? '';
        this.responseContentTypeOverride = request.responseContentTypeOverride;
        this.shouldRetry = request.shouldRetry ?? this.shouldRetry;
        this.allowErrorRetry = request.allowErrorRetry ?? this.allowErrorRetry;
        this.bag = request.bag ?? (request.owner ? RequestBag.getOrCreate(request.owner) : undefined);
        this.overrideXMLHttpRequest = request.overrideXMLHttpRequest;
        this.bag?.addRequest(this);
    }

    get static(): typeof Request {
        return this.constructor as typeof Request;
    }

    getMiddlewares(): RequestMiddleware[] {
        return Request.sharedMiddlewares.concat(this.middlewares);
    }

    /**
     * Cancels any pending requests and also disables retries
     */
    cancel() {
        this.shouldRetry = false;
        this.allowErrorRetry = false;

        if (this.XMLHttpRequest) {
            this.XMLHttpRequest.abort();
            this.XMLHttpRequest = null;
        }
        else {
            // Probably a middleware that is running a timeout to retry it later on
            // Immediately call all middlewares to notify them faster of this abort
            // Notify middleware that we stop retrying
            if (!this.didFailNetwork) {
                this.didFailNetwork = true;
                for (const middleware of this.getMiddlewares()) {
                    // Check if one of the middlewares decides to stop
                    if (middleware.onFatalNetworkError) {
                        middleware.onFatalNetworkError(this, new SimpleError({
                            code: 'network_abort',
                            message: 'Network abort',
                        }));
                    }
                }
            }
        }
    }

    /**
     * Cancel all requests with a given owner
     * Shorthand to avoid RequestBag syntax.
     */
    static cancelAll(owner: any) {
        RequestBag.get(owner)?.cancel();
    }

    /** Match the library's network_timeout error code. */
    static isTimeout(e: unknown): e is TimeoutError {
        return !!((isSimpleError(e) || isSimpleErrors(e)) && (e.hasCode('network_timeout')));
    }

    /** Match network failures, timeouts and aborts; use isAbortError to hide only cancellation in the UI. */
    static isNetworkError(e: unknown): e is NetworkError {
        return !!((isSimpleError(e) || isSimpleErrors(e)) && (e.hasCode('network_error') || e.hasCode('network_timeout') || e.hasCode('network_abort')));
    }

    /** Match cancellation (network_abort), excluding other network failures. */
    static isAbortError(e: unknown): e is AbortError {
        return !!((isSimpleError(e) || isSimpleErrors(e)) && (e.hasCode('network_abort')));
    }

    private async fetch(data: {
        method: HTTPMethod;
        url: string;
        body: string | Document | Blob | ArrayBufferView | ArrayBuffer | FormData | URLSearchParams | null | undefined;
        headers: Record<string, string>;
        timeout: number;
    }): Promise<XMLHttpRequest> {
        return new Promise((resolve, reject) => {
            try {
                const request: XMLHttpRequest = this.overrideXMLHttpRequest ? (new this.overrideXMLHttpRequest()) : new XMLHttpRequest();
                request.responseType = this.responseType;
                let finished = false;

                request.onreadystatechange = () => {
                    if (finished) {
                        // ignore duplicate events
                        return;
                    }
                    if (request.readyState === 4) {
                        if (request.status === 0) {
                            // should call handleError or handleTimeout
                            return;
                        }

                        finished = true;
                        this.XMLHttpRequest = null;
                        resolve(request);
                    }
                };

                request.ontimeout = () => {
                    if (finished) {
                        // ignore duplicate events
                        return;
                    }
                    finished = true;
                    this.XMLHttpRequest = null;
                    reject(new SimpleError({
                        code: 'network_timeout',
                        message: 'Timeout',
                    }));
                };

                request.onerror = () => {
                    if (finished) {
                        // ignore duplicate events
                        return;
                    }
                    // Your request timed out
                    finished = true;
                    this.XMLHttpRequest = null;
                    reject(new SimpleError({
                        code: 'network_error',
                        message: 'Network error',
                    }));
                };

                request.onabort = () => {
                    if (finished) {
                        // ignore duplicate events
                        return;
                    }
                    finished = true;
                    this.XMLHttpRequest = null;

                    // Disable retries
                    this.shouldRetry = false;
                    reject(new SimpleError({
                        code: 'network_abort',
                        message: 'Network abort',
                    }));
                };

                request.open(data.method, data.url);

                for (const key in data.headers) {
                    if (Object.prototype.hasOwnProperty.call(data.headers, key)) {
                        const value = data.headers[key];
                        request.setRequestHeader(key, value);
                    }
                }

                request.timeout = data.timeout;

                this.XMLHttpRequest = request;
                request.send(data.body);
            }
            catch (e) {
                reject(e);
            }
        });
    }

    async start(): Promise<RequestResult<T>> {
        // todo: check if already running or not

        // todo: add query parameters
        for (const middleware of this.getMiddlewares()) {
            if (middleware.onBeforeRequest) await middleware.onBeforeRequest(this);
        }

        if (this.didFailNetwork) {
            // In the meantime, the request is canceled before it even started
            // This can happen when the onBeforeRequest did something time intensive (e.g. refresh a token)
            // and in the meantime, the request bag got canceled
            throw new SimpleError({
                code: 'network_abort',
                message: 'Network abort',
            });
        }

        let response: XMLHttpRequest;
        let timeout = this.timeout ?? (this.method === 'GET' ? 30 * 1000 : 35 * 10000);

        try {
            let body: any;

            // We only support application/json or FormData for now
            if (this.body === undefined) {
                body = undefined;
            }
            else {
                if (this.body instanceof FormData) {
                    body = this.body;
                    let size = 0;
                    for (const [_, value] of this.body.entries()) {
                        if (typeof value === 'string') {
                            size += value.length;
                        }
                        else {
                            size += value.size;
                        }
                    }

                    if (size > 1000 * 1000 * 1000) {
                        // > 1MB upload
                        timeout = Math.max(timeout, 60 * 1000);
                    }
                }
                else {
                    if (!this.headers['Content-Type'] && this.headers['content-type']) {
                        this.headers['Content-Type'] = this.headers['content-type'];
                        delete this.headers['content-type'];
                    }

                    if (this.headers['Content-Type'] && (this.headers['Content-Type'] as string).startsWith('application/x-www-form-urlencoded')) {
                        const typeCopy = encodeObject(this.body, {
                            version: this.version ?? 0,
                            medium: EncodeMedium.Network,
                        });
                        if (typeCopy === null || typeCopy === undefined) {
                            throw new Error('Invalid body, got null/undefined, which is not encodeable to a querystring');
                        }
                        if (Array.isArray(typeCopy)) {
                            throw new Error('Invalid body, got an array which is not encodeable to a querystring');
                        }
                        if (typeof typeCopy === 'object') {
                            body = Object.keys(typeCopy)
                                .filter(k => typeCopy[k] !== undefined)
                                .map((k) => {
                                    const v = typeCopy[k];
                                    if (typeof v === 'object') {
                                        throw new Error('Invalid body, cannot encode deep objects or arrays in a querystring. Object found at ' + k);
                                    }
                                    return encodeURIComponent(k) + '=' + encodeURIComponent(v === null ? 'null' : v!.toString());
                                })
                                .join('&');
                        }
                    }
                    else {
                        this.headers['Content-Type'] = 'application/json;charset=utf-8';
                        body = JSON.stringify(encodeObject(this.body, {
                            version: this.version ?? 0,
                            medium: EncodeMedium.Network,
                        }));
                    }
                }
            }

            let queryString = '';
            if (this.query) {
                const query = encodeObject(this.query, {
                    version: this.version ?? 0,
                    medium: EncodeMedium.Network,
                });

                if (query !== undefined && query !== null) {
                    if (typeof query === 'object' && !Array.isArray(query)) {
                        const params = new URLSearchParams();
                        for (const key in query) {
                            const value = query[key];
                            if (value === null || value === undefined) {
                                // skip
                            }
                            else if (typeof value === 'boolean') {
                                params.set(key, value ? 'true' : 'false');
                            }
                            else if (typeof value === 'number') {
                                if (Number.isFinite(value)) {
                                    params.set(key, value.toString());
                                }
                                else {
                                    throw new SimpleError({
                                        code: 'invalid_query',
                                        message: 'Invalid query parameter with non-integer number value ' + value.toString(),
                                        human: 'Er ging iets mis bij het omvormen van dit verzoek',
                                    });
                                }
                            }
                            else if (typeof value === 'string') {
                                params.set(key, value);
                            }
                            else if (Array.isArray(value)) {
                                for (const v of value) {
                                    if (typeof v === 'boolean') {
                                        params.append(key, v ? 'true' : 'false');
                                    }
                                    else if (typeof v === 'number') {
                                        if (Number.isFinite(v)) {
                                            params.set(key, v.toString());
                                        }
                                        else {
                                            throw new SimpleError({
                                                code: 'invalid_query',
                                                message: 'Invalid query parameter with non-integer number value in array ' + v.toString(),
                                                human: 'Er ging iets mis bij het omvormen van dit verzoek',
                                            });
                                        }
                                    }
                                    else if (typeof v === 'string') {
                                        params.append(key, v);
                                    }
                                    else {
                                        throw new SimpleError({
                                            code: 'invalid_query',
                                            message: 'Invalid query parameter with non-string array value',
                                            human: 'Er ging iets mis bij het omvormen van dit verzoek',
                                        });
                                    }
                                }
                            }
                            else {
                                throw new SimpleError({
                                    code: 'invalid_query',
                                    message: 'Invalid query parameter with non-string value',
                                    human: 'Er ging iets mis bij het omvormen van dit verzoek',
                                });
                            }
                        }

                        const s = params.toString();
                        if (s.length) {
                            queryString = '?' + s;
                        }
                    }
                    else {
                        throw new SimpleError({
                            code: 'invalid_query',
                            message: 'Invalid query parameter of type ' + (typeof query),
                            human: 'Er ging iets mis bij het omvormen van dit verzoek',
                        });
                    }
                }
            }

            if (this.static.verbose) {
                console.log('Starting new request');
                console.log('New request', this.method, this.path, this.body, this.query, this.headers);
            }

            response = await this.fetch({
                url: this.server.host + (this.version !== undefined ? ('/v' + this.version) : '') + this.path + queryString,
                method: this.method,
                headers: this.headers,
                body,
                timeout,
            });
        }
        catch (error) {
            if ((isSimpleError(error) || isSimpleErrors(error)) && error.hasCode('network_timeout')) {
                // Increase next timeout (note: upload will stay 1 minute)
                this.timeout = Math.max(timeout, 45 * 1000);
            }
            // network error is encountered or CORS is misconfigured on the server-side

            // A middleware might decide here to interrupt the callback
            // He might for example fire a timer to retry the request because of a network failure
            // Or it might decide to fetch a new access token because the current one is expired
            // They return a promise with a boolean value indicating that the request should get retried

            if (this.shouldRetry && !this.didFailNetwork) {
                let retry = false;
                for (const middleware of this.getMiddlewares()) {
                    // Check if one of the middlewares decides to stop
                    if (middleware.shouldRetryNetworkError) {
                        retry = retry || (await middleware.shouldRetryNetworkError(this, error as Error));
                    }

                    if (!this.shouldRetry || this.didFailNetwork) {
                        // Stop the loop faster
                        break;
                    }
                }

                // Sometimes, in the meantime, shouldRetry might have become false, so check again
                if (retry && this.shouldRetry && !this.didFailNetwork) {
                    // Retry
                    return await this.start();
                }
            }

            // Notify middleware that we stop retrying
            if (!this.didFailNetwork) {
                // On abort we call this faster if needed (e.g. when middleware is hanging)
                this.didFailNetwork = true;
                for (const middleware of this.getMiddlewares()) {
                    // Check if one of the middlewares decides to stop
                    if (middleware.onFatalNetworkError) {
                        middleware.onFatalNetworkError(this, error as Error);
                    }
                }
            }

            // Failed and not caught
            this.bag?.removeRequest(this);
            throw error;
        }

        for (const middleware of this.getMiddlewares()) {
            // Update middleware of recovered network status
            if (middleware.onNetworkResponse) {
                middleware.onNetworkResponse(this, response);
            }
        }

        // Get the version
        let responseVersion: number | undefined;
        for (const header of this.server.versionHeaders) {
            const value = response.getResponseHeader(header);
            if (value) {
                const v = parseInt(value);
                if (!isNaN(v) && isFinite(v)) {
                    responseVersion = v;
                    break;
                }
            }
        }
        if (!responseVersion) {
            // Use the request version by default
            responseVersion = this.version ?? 0;
        }

        const contentType = this.responseContentTypeOverride ?? (response.getResponseHeader('Content-Type') || '');
        const mediaType = contentType.split(';')[0].trim().toLowerCase();

        if (response.status < 200 || response.status >= 300) {
            if (mediaType === 'application/json') {
                let err: SimpleErrors | any;

                try {
                    let bodyText = await response.response;
                    if (bodyText instanceof Blob) {
                        bodyText = await response.response.text();
                    }
                    const json = typeof bodyText === 'string' ? JSON.parse(bodyText) : bodyText;

                    if (this.errorDecoder) {
                        try {
                            err = this.errorDecoder.decode(
                                new ObjectData(json, {
                                    version: responseVersion,
                                    medium: EncodeMedium.Network,
                                }),
                            );
                            if (this.static.verbose) {
                                console.error(err);
                            }
                        }
                        catch (e) {
                            // Failed to decode
                            if (this.static.verbose) {
                                console.error(json);
                            }
                            throw e;
                        }
                    }
                    else {
                        err = json;
                    }
                }
                catch (e) {
                    return await this.retryOrThrowServerError(response, e as Error);
                }

                // A middleware might decide here to retry instead of passing the error to the caller
                if (isSimpleErrors(err) && (this.shouldRetry || this.allowErrorRetry)) {
                    let retry = false;
                    for (const middleware of this.getMiddlewares()) {
                        // Check if one of the middlewares decides to stop
                        if (middleware.shouldRetryError) {
                            retry = retry || (await middleware.shouldRetryError(this, response, err));
                        }
                    }

                    // Sometimes, in the meantime, shouldRetry might have become false, so check again
                    if (retry && (this.shouldRetry || this.allowErrorRetry)) {
                        // Retry
                        return await this.start();
                    }
                }

                this.bag?.removeRequest(this);
                throw err;
            }

            let bodyText = await response.response;
            if (bodyText instanceof Blob) {
                bodyText = await response.response.text();
            }

            // A non 200 status code without json header is always considered as a server error.
            return await this.retryOrThrowServerError(response, new SimpleError({
                code: 'http_status_error',
                message: typeof bodyText === 'string' ? bodyText : response.statusText,
                statusCode: response.status,
            }));
        }

        if (mediaType === 'application/json') {
            // If we have a decoder, we also try to decode the json. Because some servers don't
            // return the correct content type, and we can't fix that
            let json: any;
            try {
                let bodyText = await response.response;
                if (bodyText instanceof Blob) {
                    bodyText = await response.response.text();
                }
                json = typeof bodyText === 'string' ? JSON.parse(bodyText) : bodyText;
            }
            catch (e) {
                // A 200 status code with invalid JSON is considered a server error
                return await this.retryOrThrowServerError(response, e as Error);
            }

            if (this.decoder) {
                const decoded = this.decoder?.decode(new ObjectData(json, {
                    version: responseVersion,
                    medium: EncodeMedium.Network,
                }));
                if (this.static.verbose) {
                    console.info(decoded);
                }
                this.bag?.removeRequest(this);
                return new RequestResult(decoded, Request.parseHeaders(response.getAllResponseHeaders()), responseVersion);
            }

            this.bag?.removeRequest(this);
            return new RequestResult(json, Request.parseHeaders(response.getAllResponseHeaders()), responseVersion);
        }

        if (this.decoder) {
            // Expected content, but the server didn't respond with content
            if (this.static.verbose) {
                console.error(response.response);
            }
            return await this.retryOrThrowServerError(response, new Error('Missing JSON response from server'));
        }

        this.bag?.removeRequest(this);
        return new RequestResult(await response.response, Request.parseHeaders(response.getAllResponseHeaders()), responseVersion) as any;
    }

    static parseHeaders(headers: string) {
        const result: Record<string, string> = {};
        for (const line of headers.trim().split(/[\r\n]+/)) {
            const parts = line.split(': ');
            const header = parts.shift();
            if (header) {
                const value = parts.join(': ');
                result[header.toLowerCase()] = value;
            }
        }
        return result;
    }

    private async retryOrThrowServerError(response: XMLHttpRequest, e: Error) {
        // Invalid json is considered as a server error
        if (this.static.verbose) {
            console.error(e);
        }

        if (this.shouldRetry) {
            // A middleware might decide here to retry instead of passing the error to the caller
            let retry = false;
            for (const middleware of this.getMiddlewares()) {
                // Check if one of the middlewares decides to stop
                if (middleware.shouldRetryServerError) {
                    retry = retry || (await middleware.shouldRetryServerError(this, response, e));
                }
            }

            // Sometimes, in the meantime, shouldRetry might have become false, so check again
            if (retry && this.shouldRetry) {
                // Retry
                return await this.start();
            }
        }
        this.bag?.removeRequest(this);
        throw e;
    }
}
