import { EncodeMedium } from '@common/encoding';
import http from 'http';

import { isReadableStream } from './isReadableStream.js';
import { Request } from './Request.js';
import { Response, SupportedResponseBodyTypes } from './Response.js';

export class EncodedResponse {
    status = 200;
    headers: http.OutgoingHttpHeaders = {};
    body: any;

    constructor(status: number, headers: http.OutgoingHttpHeaders, body: any) {
        this.status = status;
        this.headers = headers;
        this.body = body;
    }

    static encode(response: Response<SupportedResponseBodyTypes>, request: Request): EncodedResponse {
        const encoded = new EncodedResponse(response.status, response.headers, undefined);

        if (response.body !== undefined) {
            if (!encoded.headers['Content-Type'] && !encoded.headers['content-type']) {
                encoded.headers['content-type'] = 'application/json';
            }

            if (encoded.headers['Content-Type'] == 'application/json' || encoded.headers['content-type'] == 'application/json') {
                // Only require version if we have to encode something
                const version = request.getVersion();
                if (typeof response.body === 'string' || response.body instanceof Uint8Array || response.body instanceof Buffer || isReadableStream(response.body)) {
                    console.warn('We got a string/Buffer value as body for JSON');
                    encoded.body = response.body;
                } else {
                    if (Array.isArray(response.body)) {
                        if (process.env.NODE_ENV === 'development') {
                            encoded.body = JSON.stringify(response.body.map(e => e.encode({ version, medium: EncodeMedium.Network })), undefined, 2);
                        } else {
                            encoded.body = JSON.stringify(response.body.map(e => e.encode({ version, medium: EncodeMedium.Network })));
                        }
                    } else {
                        if (process.env.NODE_ENV === 'development') {
                            encoded.body = JSON.stringify(response.body.encode({ version, medium: EncodeMedium.Network }), undefined, 2);
                        } else {
                            encoded.body = JSON.stringify(response.body.encode({ version, medium: EncodeMedium.Network }));
                        }
                    }
                }
            } else {
                if (typeof response.body === 'string' || response.body instanceof Uint8Array || response.body instanceof Buffer || isReadableStream(response.body)) {
                    encoded.body = response.body;
                } else {
                    console.error('Unexpected non-string value as body');
                    encoded.body = '';
                }
            }
        } else {
            encoded.body = '';
        }
        return encoded;
    }
}
