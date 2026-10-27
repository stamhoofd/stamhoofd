import { Decoder, EncodeMedium, ObjectData } from '@simonbackx/simple-encoding';
import http from 'http';
import { parse } from 'querystring';

import { HttpMethod, Request } from './Request.js';
import { SimpleError } from '@simonbackx/simple-errors';

export class DecodedRequest<Params, Query, Body> {
    method: HttpMethod;
    url: string;
    host: string;
    headers: http.IncomingHttpHeaders;
    params: Params;
    body: Body;
    query: Query;

    /**
     * Reference to not yet decoded request (usefull for uploads and special request bodies)
     */
    request: Request;

    /**
     * Decodes only inputs with supplied decoders, requiring a request version when either
     * decoder is present. Malformed JSON throws a 400 SimpleError; decoder errors propagate.
     */
    static async fromRequest<Params, Query, Body>(
        request: Request,
        params: Params,
        queryDecoder: Decoder<Query> | undefined,
        bodyDecoder: Decoder<Body> | undefined,
    ): Promise<DecodedRequest<Params, Query, Body>> {
        const r = new DecodedRequest<Params, Query, Body>();
        r.method = request.method;
        r.url = request.url;
        r.host = request.host;
        r.headers = request.headers;
        r.request = request;
        r.params = params;

        if (queryDecoder !== undefined || bodyDecoder !== undefined) {
            // Only require version if we have to decode something
            const version = request.getVersion();

            const query = queryDecoder !== undefined ? queryDecoder.decode(new ObjectData(request.query, { version, medium: EncodeMedium.Network })) : undefined;
            r.query = query as Query;

            // Read body type
            if (r.headers['content-type']?.toLowerCase().startsWith('application/x-www-form-urlencoded')) {
                if (bodyDecoder !== undefined) {
                    const str = await request.body;
                    let parsed;
                    try {
                        parsed = parse(str);
                    } catch (e) {
                        throw new SimpleError({
                            statusCode: 400,
                            code: 'invalid_json',
                            message: 'body is malformed (application/x-www-form-urlencoded) or wrong content-type',
                        });
                    }

                    const body = bodyDecoder.decode(new ObjectData(parsed, { version, medium: EncodeMedium.Network }));
                    r.body = body as Body;
                }
            } else {
                if (bodyDecoder !== undefined) {
                    const str = await request.body;
                    let parsed;
                    try {
                        parsed = JSON.parse(str);
                    } catch (e) {
                        throw new SimpleError({
                            statusCode: 400,
                            code: 'invalid_json',
                            message: 'JSON is malformed or wrong content-type',
                        });
                    }

                    const body = bodyDecoder.decode(new ObjectData(parsed, { version, medium: EncodeMedium.Network }));
                    r.body = body as Body;
                }
            }
        }

        return r;
    }
}
