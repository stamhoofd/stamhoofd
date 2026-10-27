import { Encodeable } from '@common/encoding';
import http from 'http';
import { Readable } from 'node:stream';

/** Structures (including arrays), raw text/bytes/streams, or undefined for an empty body. */
export type SupportedResponseBodyTypes = Encodeable | Encodeable[] | string | Buffer | Uint8Array | Readable | undefined;

export class Response<Body extends SupportedResponseBodyTypes = SupportedResponseBodyTypes> {
    status = 200;
    headers: http.OutgoingHttpHeaders = {};
    body: Body;

    /** Defaults to status 200. Set Content-Type explicitly for non-JSON bodies. */
    constructor(body: Body, status = 200, headers: http.OutgoingHttpHeaders = {}) {
        this.body = body;
        this.status = status;
        this.headers = headers;
    }
}
