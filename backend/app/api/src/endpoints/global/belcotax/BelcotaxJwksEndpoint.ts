import type { DecodedRequest, Request } from '@node/endpoints';
import { Endpoint, Response } from '@node/endpoints';

import { BelcotaxClientKeys } from '../../../services/belcotax/connection/BelcotaxClientKeys.js';

type Params = Record<string, never>;
type Query = undefined;
type Body = undefined;
type ResponseBody = string;

/**
 * JWKS URI registered at FOD Financiën: FOD checks our client assertion with these keys
 */
export class BelcotaxJwksEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method !== 'GET') {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, '/belcotax/jwks', {});

        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    async handle(_: DecodedRequest<Params, Query, Body>) {
        const response = new Response(JSON.stringify(await BelcotaxClientKeys.getJwks()));
        // Exactly 'application/json' would make the router encode the body as a versioned structure
        response.headers['content-type'] = 'application/json; charset=utf-8';
        response.headers['cache-control'] = 'public, max-age=300';
        return response;
    }
}
