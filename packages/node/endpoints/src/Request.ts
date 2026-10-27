import { EncodableObject, EncodeMedium, encodeObject } from '@simonbackx/simple-encoding';
import { SimpleError } from '@simonbackx/simple-errors';
import http from 'http';
import urlParser from 'url';

export type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'DELETE' | 'OPTIONS';
export class Request {
    method: HttpMethod;
    url: string;
    host: string;
    request?: http.IncomingMessage;
    bodyPromise?: Promise<string>;

    version?: number;

    /// Use this e.g. to make test code shorter, but avoid using this in real code
    static defaultVersion?: number;

    /**
     * Socket addresses of our own reverse proxy — the only peer that connects to us locally. We
     * only trust the X-Forwarded-For header when the direct connection comes from one of these, so
     * a request arriving straight from the internet can never spoof it.
     */
    static trustedProxyAddresses = new Set(['127.0.0.1', '0.0.0.0', '::1', '::ffff:127.0.0.1']);

    get body(): Promise<string> {
        if (!this.bodyPromise) {
            if (!this.request) {
                throw new Error('Expected a body promise or a request');
            }
            const req = this.request;
            this.bodyPromise = new Promise<string>((resolve, reject) => {
                const chunks: any[] = [];
                let gotError = false;

                // we can access HTTP headers
                req.on('data', (chunk) => {
                    chunks.push(chunk);
                });
                req.on('error', (err) => {
                    gotError = true;
                    reject(err);
                });

                req.on('end', () => {
                    if (gotError) {
                        return;
                    }
                    const body = Buffer.concat(chunks).toString();
                    resolve(body);
                });
            });
        }
        return this.bodyPromise;
    }

    headers: http.IncomingHttpHeaders;
    query: {} = {};

    constructor(req: {
        method: HttpMethod;
        url: string;
        host: string;
        headers?: http.IncomingHttpHeaders;
        body?: Promise<string>;
        request?: http.IncomingMessage;
        query?: {};
        version?: number;
    }) {
        this.method = req.method;
        this.url = req.url;
        this.host = req.host;
        this.headers = req.headers ?? {};
        this.bodyPromise = req.body;
        this.query = req.query ?? {};
        this.request = req.request;
        this.version = req.version;

        // If version is undefined: check the URL
        this.readVersionFromUrl();
    }

    static get(data: {
        path: string;
        host?: string;
        headers?: http.IncomingHttpHeaders;
        query?: any;
        version?: number;
    }) {
        return this.build({
            method: 'GET',
            ...data,
        });
    }

    static post(data: {
        path: string;
        host?: string;
        headers?: http.IncomingHttpHeaders;
        body?: (object & EncodableObject) | string | Promise<string>;
        query?: any;
        version?: number;
    }) {
        return this.build({
            method: 'POST',
            ...data,
        });
    }

    static patch(data: {
        path: string;
        host?: string;
        headers?: http.IncomingHttpHeaders;
        body?: (object & EncodableObject) | string | Promise<string>;
        query?: any;
        version?: number;
    }) {
        return this.build({
            method: 'PATCH',
            ...data,
        });
    }

    static delete(data: {
        path: string;
        host?: string;
        headers?: http.IncomingHttpHeaders;
        body?: (object & EncodableObject) | string | Promise<string>;
        query?: any;
        version?: number;
    }) {
        return this.build({
            method: 'DELETE',
            ...data,
        });
    }

    static build(data: {
        method: HttpMethod;
        path: string;
        host?: string;
        headers?: http.IncomingHttpHeaders;
        body?: (object & EncodableObject) | string | Promise<string>;
        query?: any;
        version?: number;
    }) {
        const version = data.version ?? this.defaultVersion;
        let queryString = '';
        if (data.query) {
            const query = encodeObject(data.query, {
                version: version ?? 0,
                medium: EncodeMedium.Network,
            });

            if (query !== undefined && query !== null) {
                if (typeof query === 'object' && !Array.isArray(query)) {
                    const params = new URLSearchParams();
                    for (const key in query) {
                        const value = query[key];
                        if (value === null || value === undefined) {
                            // skip
                        } else if (typeof value === 'boolean') {
                            params.set(key, value ? 'true' : 'false');
                        } else if (typeof value === 'number') {
                            if (Number.isFinite(value)) {
                                params.set(key, value.toString());
                            } else {
                                throw new SimpleError({
                                    code: 'invalid_query',
                                    message: 'Invalid query parameter with non-integer number value ' + value.toString(),
                                    human: 'Er ging iets mis bij het omvormen van dit verzoek',
                                });
                            }
                        } else if (typeof value === 'string') {
                            params.set(key, value);
                        } else if (Array.isArray(value)) {
                            for (const v of value) {
                                if (typeof v === 'boolean') {
                                    params.append(key, v ? 'true' : 'false');
                                } else if (typeof v === 'number') {
                                    if (Number.isFinite(v)) {
                                        params.set(key, v.toString());
                                    } else {
                                        throw new SimpleError({
                                            code: 'invalid_query',
                                            message: 'Invalid query parameter with non-integer number value in array ' + v.toString(),
                                            human: 'Er ging iets mis bij het omvormen van dit verzoek',
                                        });
                                    }
                                } else if (typeof v === 'string') {
                                    params.append(key, v);
                                } else {
                                    throw new SimpleError({
                                        code: 'invalid_query',
                                        message: 'Invalid query parameter with non-string array value',
                                        human: 'Er ging iets mis bij het omvormen van dit verzoek',
                                    });
                                }
                            }
                        } else {
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
                } else {
                    throw new SimpleError({
                        code: 'invalid_query',
                        message: 'Invalid query parameter of type ' + (typeof query),
                        human: 'Er ging iets mis bij het omvormen van dit verzoek',
                    });
                }
            }
        }

        const url = data.path + queryString;
        const parsedUrl = urlParser.parse(url, true);
        let body: Promise<string> | undefined = undefined;

        if (typeof data.body === 'object' && !(data.body instanceof Promise)) {
            if (!version) {
                throw new SimpleError({
                    code: 'missing_version',
                    message: 'Providing a version is required when sending JSON data',
                    statusCode: 400,
                });
            }
            const encoded = encodeObject(data.body, {
                version,
                medium: EncodeMedium.Network,
            });
            body = Promise.resolve(JSON.stringify(encoded) || '');
        } else {
            body = typeof data.body === 'string' ? Promise.resolve(data.body) : data.body;
        }

        return new Request({
            method: data.method,
            url: parsedUrl.pathname ?? '',
            host: data.host || '',
            body,
            query: parsedUrl.query,
            headers: data.headers,
            version,
        });
    }

    static buildJson(method: HttpMethod, url: string, host?: string, body?: any): Request {
        const parsedUrl = urlParser.parse(url, true);

        if (this.defaultVersion !== undefined) {
            body = encodeObject(body, {
                version: this.defaultVersion,
                medium: EncodeMedium.Network,
            });
        }

        return new Request({
            method: method,
            url: parsedUrl.pathname ?? '',
            host: host || '',
            body: Promise.resolve(JSON.stringify(body) || ''),
            query: parsedUrl.query,
        });
    }

    /**
     * All forwarded IP hops, left-to-right, as recorded in the X-Forwarded-For header — but only
     * when the header is trusted (the direct connection comes from one of our reverse proxies, see
     * {@link Request.trustedProxyAddresses}). Otherwise the single direct socket address. Empty when
     * nothing is known.
     *
     * The left-most entry is the original client and the right-most is the address seen by the proxy
     * closest to us (see {@link Request.clientIPPosition}).
     */
    getIPs(): string[] {
        const remoteAddress = this.request?.socket.remoteAddress;
        const forwardedFor = this.headers['x-forwarded-for'];

        if (typeof forwardedFor === 'string'
            && remoteAddress !== undefined
            && Request.trustedProxyAddresses.has(remoteAddress)
        ) {
            const hops = forwardedFor.split(',').map(ip => ip.trim()).filter(ip => ip.length > 0);
            if (hops.length > 0) {
                return hops;
            }
        }

        return remoteAddress ? [remoteAddress] : [];
    }

    getIP(): string {
        const ips = this.getIPs();
        if (ips.length === 0) {
            return '?';
        }

        return ips[0];
    }

    setVersionIfNotSet() {
        if (this.version === undefined) {
            try {
                this.version = this.getVersion();
            } catch (e) {
                // Ignore
                this.version = 0;
            }
        }
    }

    /**
     * Return the number in the X-Version header or throw if invalid
     */
    getVersion(): number {
        if (this.version !== undefined) {
            return this.version;
        }
        // Check struct version in headers
        let version: number | undefined = (this.constructor as typeof Request).defaultVersion;

        if (this.headers['x-version'] && !Array.isArray(this.headers['x-version'])) {
            version = Number.parseInt(this.headers['x-version']);
            if (isNaN(version)) {
                throw new SimpleError({
                    code: 'invalid_header',
                    message: 'The X-Version header should contain a valid integer',
                    statusCode: 400,
                });
            }
        }

        if (version === undefined) {
            throw new SimpleError({
                code: 'missing_version',
                message: 'Providing a version is required. Use the URL or the X-Version header.',
                statusCode: 400,
            });
        }

        this.version = version;
        return version;
    }

    /**
     *  Read version from the path if present. Do only call this once since this can fuck up the path if it contains multiple versions for some reason.
     * E.g. /v1/v2/test -> if you call this once, you'll get version 1 and path /v2/test. Call it again to get version 2 and path /test
     * */
    private readVersionFromUrl() {
        if (this.version) {
            // Already have a version here!
            return;
        }

        const urlVersionParts = this.url.substring(1).split('/');
        let version: number | undefined;

        if (urlVersionParts.length > 0) {
            const possibleVersion = urlVersionParts[0];
            if (possibleVersion.startsWith('v')) {
                version = parseInt(possibleVersion.substring(1));
                if (isNaN(version)) {
                    version = undefined;
                } else {
                    this.url = this.url.substring(possibleVersion.length + 1);
                }
            }
        }
        if (version) {
            this.version = version;
        }
    }

    static fromHttp(req: http.IncomingMessage): Request {
        if (!req.url) {
            throw new Error('Something went wrong');
        }

        const parsedUrl = urlParser.parse(req.url, true);
        let host = req.headers.host ?? '';
        const path = parsedUrl.pathname ?? '';

        // Remove port
        const splitted = host.split(':');
        host = splitted[0];

        return new Request({
            method: req.method as HttpMethod,
            url: path,
            host: host,
            query: parsedUrl.query,
            request: req,
            headers: req.headers,
        });
    }
}
