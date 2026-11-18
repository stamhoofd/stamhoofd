import type { Decoder } from '@common/encoding';
import { AutoEncoder, field, StringDecoder } from '@common/encoding';
import type { DecodedRequest, Request } from '@node/endpoints';
import { Endpoint } from '@node/endpoints';

import { BelcotaxConnectionService } from '../../../services/belcotax/connection/BelcotaxConnectionService.js';

type Params = Record<string, never>;

class Query extends AutoEncoder {
    @field({ decoder: StringDecoder, optional: true })
    code?: string;

    @field({ decoder: StringDecoder, optional: true })
    state?: string;

    @field({ decoder: StringDecoder, optional: true })
    iss?: string;

    @field({ decoder: StringDecoder, optional: true })
    client_id?: string;

    @field({ decoder: StringDecoder, optional: true })
    error?: string;

    @field({ decoder: StringDecoder, optional: true })
    error_description?: string;
}

type Body = undefined;
type ResponseBody = undefined;

/**
 * Redirect URI registered at FOD Financiën. The authorization code is only valid for 10 seconds,
 * so it is exchanged here, before the browser goes back to the dashboard.
 */
export class BelcotaxCallbackEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    queryDecoder = Query as Decoder<Query>;

    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method !== 'GET') {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, '/oauth/belcotax', {});

        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    async handle(request: DecodedRequest<Params, Query, Body>) {
        return await BelcotaxConnectionService.handleCallback(request.query);
    }
}
