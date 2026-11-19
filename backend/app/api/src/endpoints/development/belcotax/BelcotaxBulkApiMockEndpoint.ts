import { SimpleError } from '@common/errors';
import type { DecodedRequest, Request } from '@node/endpoints';
import { Endpoint, Response } from '@node/endpoints';

import {
    BelcotaxConfig,
    BelcotaxMockApiPath,
} from '../../../services/belcotax/connection/BelcotaxConfig.js';
import { BelcotaxBulkApiMock } from '../../../services/belcotax/local/BelcotaxBulkApiMock.js';

type Params = { path: string };
type Query = undefined;
type Body = undefined;
type ResponseBody = string;

/**
 * Only loaded by boot.ts for BELCOTAX_ENVIRONMENT=local outside production
 */
export class BelcotaxBulkApiMockEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method !== 'GET' && request.method !== 'POST') {
            return [false];
        }

        if (request.url.startsWith(BelcotaxMockApiPath + '/')) {
            return [true, { path: request.url.substring(BelcotaxMockApiPath.length) }];
        }
        return [false];
    }

    async handle(request: DecodedRequest<Params, Query, Body>) {
        if (!BelcotaxConfig.servesMockApi) {
            throw new SimpleError({
                code: 'not_found',
                message: 'The Belcotax mock is not available',
                statusCode: 404,
            });
        }

        const authorization = request.headers.authorization;
        const [status, json] = await BelcotaxBulkApiMock.handle(
            request.method,
            request.params.path,
            typeof authorization === 'string' ? authorization : undefined,
            {
                body: request.method === 'POST' ? await request.request.body : '',
                contentType: request.headers['content-type'],
            },
        );
        const response = new Response(JSON.stringify(json));
        response.status = status;
        response.headers['content-type'] =
            status >= 400 ? 'application/problem+json' : 'application/json; charset=utf-8';
        return response;
    }
}
