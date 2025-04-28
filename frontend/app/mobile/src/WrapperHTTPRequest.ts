import { CapacitorHttp } from '@capacitor/core';

export class WrapperHTTPRequest implements XMLHttpRequest {
    // Event listeners.
    // Note: we ignore parameters here since we never use them
    onreadystatechange: ((this: XMLHttpRequest, ev: Event) => any) | null = null;
    ontimeout: ((this: XMLHttpRequest, ev: ProgressEvent<EventTarget>) => any) | null = null;
    onerror: ((this: XMLHttpRequest, ev: ProgressEvent<EventTarget>) => any) | null = null;
    onabort: ((this: XMLHttpRequest, ev: ProgressEvent<EventTarget>) => any) | null = null;

    readyState = 0;
    response: any;
    responseText = '';
    responseType: XMLHttpRequestResponseType = '';
    responseURL = '';
    responseXML: Document | null = null;
    status = 0;
    statusText = '';
    timeout = 0;
    upload: XMLHttpRequestUpload;
    withCredentials: boolean;

    // Helpers (need both on static and non static)
    UNSENT = 0 as const;
    OPENED = 1 as const;
    HEADERS_RECEIVED = 2 as const;
    LOADING = 3 as const;
    DONE = 4 as const;

    static UNSENT = 0 as const;
    static OPENED = 1 as const;
    static HEADERS_RECEIVED = 2 as const;
    static LOADING = 3 as const;
    static DONE = 4 as const;

    // Private implementation
    method: 'GET' | 'POST' | 'PATCH' | 'PUT' = 'GET';
    url = '';
    requestHeaders = {};

    responseHeaders: Record<string, string> = {};

    constructor() {
        // nvt
    }

    abort(): void {
        throw new Error('Method not implemented.');
    }

    getAllResponseHeaders(): string {
        // Convert response headers to string
        return Object.keys(this.responseHeaders).map(key => `${key}: ${this.responseHeaders[key]}`).join('\r\n');
    }

    getResponseHeader(name: string): string | null {
        return this.responseHeaders[name] ?? null;
    }

    open(method: string, url: string): void;
    open(method: string, url: string, async: boolean, username?: string | null, password?: string | null): void;
    open(method: any, url: any, async?: any, username?: any, password?: any): void {
        this.method = method;
        this.url = url;

        if (async || username || password) {
            throw new Error('Other properties not supported');
        }
    }

    overrideMimeType(mime: string): void {
        throw new Error('Method not implemented.');
    }

    send(body?: Document | BodyInit | null): void {
        console.log('Starting new HTTP request...');
        console.log(this.method, this.url);
        console.log(body);

        const contentType = this.requestHeaders['Content-Type'] as string | undefined;

        if (contentType && contentType.startsWith('application/json') && typeof body === 'string') {
            body = JSON.parse(body);
        }

        CapacitorHttp.request({
            url: this.url,
            method: this.method,
            data: body,
            connectTimeout: this.timeout ? this.timeout : undefined,
            readTimeout: this.timeout ? this.timeout : undefined,
            headers: this.requestHeaders,
            responseType: 'text',
        }).then((response) => {
            console.log('Received response', response);

            this.readyState = 4;
            this.status = response.status;
            if (typeof response.data !== 'string') {
                // Overwrite behaviour
                this.response = JSON.stringify(response.data);
            }
            else {
                this.response = response.data;
            }
            this.responseHeaders = response.headers
            (this.onreadystatechange as any)?.call(this);
        }).catch((e) => {
            console.log('received error');
            console.error(e);

            this.onerror?.call(this, e);
        });
    }

    addEventListener<K extends keyof XMLHttpRequestEventMap>(type: K, listener: (this: XMLHttpRequest, ev: XMLHttpRequestEventMap[K]) => any, options?: boolean | AddEventListenerOptions): void;
    addEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions): void;
    addEventListener(type: any, listener: any, options?: any): void {
        throw new Error('Method not implemented.');
    }

    removeEventListener<K extends keyof XMLHttpRequestEventMap>(type: K, listener: (this: XMLHttpRequest, ev: XMLHttpRequestEventMap[K]) => any, options?: boolean | EventListenerOptions): void;
    removeEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | EventListenerOptions): void;
    removeEventListener(type: any, listener: any, options?: any): void {
        throw new Error('Method not implemented.');
    }

    onload: ((this: XMLHttpRequest, ev: ProgressEvent<EventTarget>) => any) | null;
    onloadend: ((this: XMLHttpRequest, ev: ProgressEvent<EventTarget>) => any) | null;
    onloadstart: ((this: XMLHttpRequest, ev: ProgressEvent<EventTarget>) => any) | null;
    onprogress: ((this: XMLHttpRequest, ev: ProgressEvent<EventTarget>) => any) | null;
    dispatchEvent(event: Event): boolean {
        throw new Error('Method not implemented.');
    }

    setRequestHeader(name: string, value: string) {
        this.requestHeaders[name] = value;
    }
}

/*
Only when stable:
console.log("Loaded WRapper request");

(function () {
	console.log("Loaded WRapper request")
	// Keep reference to old XMLHTTPRequest
	//const oldXMLHttpRequest = window.XMLHttpRequest;
	window.XMLHttpRequest = WrapperHTTPRequest
})()
*/
