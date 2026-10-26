import type { Decoder} from '@simonbackx/simple-encoding';
import { AutoEncoder, DateDecoder, field, StringDecoder } from '@simonbackx/simple-encoding';
import type { DecodedRequest, Request} from '@simonbackx/simple-endpoints';
import { Endpoint, Response } from '@simonbackx/simple-endpoints';
import { SimpleError } from '@simonbackx/simple-errors';
import { verifyInternalSignature } from '@stamhoofd/backend-env';

import { FileCache } from '../helpers/FileCache.js';

type Params = Record<string, never>;
class Query extends AutoEncoder {
    @field({ decoder: StringDecoder })
    cacheId: string;

    @field({ decoder: DateDecoder })
    timestamp: Date;

    @field({ decoder: DateDecoder })
    expires: Date;

    @field({ decoder: StringDecoder })
    signature: string;
}
type Body = undefined;
type ResponseBody = Buffer;

/**
 * One endpoint to create, patch and delete groups. Usefull because on organization setup, we need to create multiple groups at once. Also, sometimes we need to link values and update multiple groups at once
 */

export class PdfCacheEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    queryDecoder = Query as Decoder<Query>;

    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method !== 'GET') {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, '/pdf-cache', {});

        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    /**
     * Returns cached PDF bytes only for the ID and exact version in a valid cache-read
     * grant. Expiry must be in the next minute; verification precedes all cache I/O.
     * A valid grant with no readable version produces cache_not_found.
     */
    async handle(request: DecodedRequest<Params, Query, Body>) {
        const { cacheId, timestamp, expires, signature } = request.query;
        if (expires.getTime() <= Date.now() || expires.getTime() > Date.now() + 60000
            || !verifyInternalSignature(signature, 'pdf-cache', cacheId, String(timestamp.getTime()), String(expires.getTime()))) {
            throw new SimpleError({ code: 'invalid_signature', message: 'Invalid signature', statusCode: 403 });
        }
        const pdf = await FileCache.read(request.query.cacheId, request.query.timestamp);
        if (!pdf) {
            throw new SimpleError({
                code: 'cache_not_found',
                message: 'Not cached',
                statusCode: 404,
            });
        }
        const response = new Response(pdf);
        response.headers['Cache-Control'] = 'no-store';
        response.headers['Content-Type'] = 'application/pdf';
        response.headers['Content-Length'] = pdf.byteLength.toString();
        return response;
    }
}
