import { DecodedRequest, Endpoint, Request, Response } from '@simonbackx/simple-endpoints';

import { SimpleError } from '@simonbackx/simple-errors';

type Params = { id: string };
type Query = undefined;
type Body = undefined;
type ResponseBody = undefined;

/**
 * @deprecated
 */
export class GetMemberBalanceEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method !== 'GET') {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, '/organization/members/@id/balance', { id: String });

        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    async handle(_: DecodedRequest<Params, Query, Body>): Promise<Response<ResponseBody>> {
        throw new SimpleError({
            code: 'moved',
            message: 'This endpoint has been moved to /receivable-balances/member/@id',
        });
    }
}
