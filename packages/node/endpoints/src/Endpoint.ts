import { Decoder, Encodeable } from '@simonbackx/simple-encoding';
import http from 'http';
import { Readable } from 'node:stream';

import { DecodedRequest } from './DecodedRequest.js';
import { EncodedResponse } from './EncodedResponse.js';
import { Request } from './Request.js';
import { Response } from './Response.js';

/** A route with independently typed URL parameters, query, request body and response body. */
export abstract class Endpoint<Params, Query, RequestBody, ResponseBody extends Encodeable | Encodeable[] | string | Buffer | Uint8Array | Readable | undefined> {
    /** Decodes query parameters using the request version and Network medium; omitted means no decoded query. */
    protected queryDecoder: Decoder<Query> | undefined;
    /** Decodes JSON or form-urlencoded input; omitted means the body is not read here. */
    protected bodyDecoder: Decoder<RequestBody> | undefined;

    /** Match the method/path and return URL parameters, or `[false]` to try another endpoint. */
    protected abstract doesMatch(request: Request, response?: http.ServerResponse): [true, Params] | [false];
    abstract handle(request: DecodedRequest<Params, Query, RequestBody>): Promise<Response<ResponseBody>>;

    /** Matches, decodes, handles and checks response encoding; throws when the route does not match. */
    async test(request: Request): Promise<Response<ResponseBody>> {
        const decodedRequest = await this.decode(request);
        if (decodedRequest) {
            const response = await this.handle(decodedRequest);

            // Check if encoding works (ignoring the response)
            EncodedResponse.encode(response, request);

            return response;
        }
        throw new Error('Route is not matching');
    }

    /**
     * Checks whether the request matches this endpoint and returns the decoded request if it does.
     * Next you'll need to pass this to the handle method to get a response.
     */
    async decode(request: Request, response?: http.ServerResponse): Promise<DecodedRequest<Params, Query, RequestBody> | null> {
        const [match, params] = this.doesMatch(request, response);
        if (match) {
            if (!params) {
                throw new Error("Compiler doesn't optimize for this, but this should not be able to run");
            }
            return await DecodedRequest.fromRequest(request, params, this.queryDecoder, this.bodyDecoder);
        }
        return null;
    }

    /**
     * Matches slash-separated paths such as `/items/@id`. Declare placeholders with
     * String or Number; numeric values must be integers. Returns undefined on mismatch.
     * Does not match the HTTP method; pass the request path without a query string.
     */
    static parseParameters<Keys extends string>(
        url: string,
        template: string,
        params: Record<Keys, NumberConstructor | StringConstructor>,
    ): Record<Keys, number | string> | undefined {
        const parts = url.split('/');
        const templateParts = template.split('/');

        if (parts.length !== templateParts.length) {
            // No match
            return;
        }

        const resultParams = {} as any;

        for (let index = 0; index < parts.length; index++) {
            const part = parts[index];

            const templatePart = templateParts[index];
            if (templatePart !== part) {
                const param = templatePart.substr(1);
                if (params[param]) {
                    // Found a param
                    resultParams[param] = params[param](part);

                    if (typeof resultParams[param] === 'number') {
                        // Force integers
                        if (!Number.isInteger(resultParams[param])) {
                            return;
                        }
                    }
                    continue;
                }
                // no match
                return;
            }
        }

        return resultParams;
    }
}
