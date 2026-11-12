export interface RevocationHttpClient {
    post(url: string, body: Uint8Array, contentType: string): Promise<Uint8Array>;
    get(url: string, maximumBytes: number): Promise<Uint8Array>;
}

/** An OCSP response for one certificate is a few kilobytes. */
const MAXIMUM_OCSP_RESPONSE_BYTES = 64 * 1024;

const TIMEOUT_IN_MS = 5 * 1000;

/**
 * The limits are those a call needs inside a request a member is waiting for. No redirects: the url
 * came out of a certificate, so it is never followed anywhere else.
 */
export class FetchRevocationHttpClient implements RevocationHttpClient {
    async post(url: string, body: Uint8Array, contentType: string): Promise<Uint8Array> {
        return await this.read(url, MAXIMUM_OCSP_RESPONSE_BYTES, {
            method: 'POST',
            headers: { 'content-type': contentType },
            body: body.slice().buffer as ArrayBuffer,
        });
    }

    async get(url: string, maximumBytes: number): Promise<Uint8Array> {
        return await this.read(url, maximumBytes, { method: 'GET' });
    }

    private async read(url: string, maximumBytes: number, init: RequestInit): Promise<Uint8Array> {
        const response = await fetch(url, {
            ...init,
            redirect: 'error',
            signal: AbortSignal.timeout(TIMEOUT_IN_MS),
            credentials: 'omit',
            referrerPolicy: 'no-referrer',
        });

        if (!response.ok) {
            throw new Error(`${url} answered ${response.status}`);
        }

        const announced = response.headers.get('content-length');

        if (announced !== null && Number(announced) > maximumBytes) {
            throw new Error(`${url} announced ${announced} bytes, more than the ${maximumBytes} we read`);
        }

        const bytes = new Uint8Array(await response.arrayBuffer());

        if (bytes.length > maximumBytes) {
            throw new Error(`${url} returned ${bytes.length} bytes, more than the ${maximumBytes} we read`);
        }

        return bytes;
    }
}
