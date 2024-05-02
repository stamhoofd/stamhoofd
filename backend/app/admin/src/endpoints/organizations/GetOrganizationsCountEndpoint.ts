import { DecodedRequest, Endpoint, Request, Response } from '@simonbackx/simple-endpoints';
import { CountResponse, CountFilteredRequest } from '@stamhoofd/structures';

import { Decoder } from '@simonbackx/simple-encoding';
import { AdminToken } from '../../models/AdminToken';
import { GetOrganizationsEndpoint } from './GetOrganizationsEndpoint';

type Params = Record<string, never>;
type Query = CountFilteredRequest;
type Body = undefined;
type ResponseBody = CountResponse;

export class GetOrganizationsCountEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    queryDecoder = CountFilteredRequest as Decoder<CountFilteredRequest>

    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method != "GET") {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, "/organizations-count", {});

        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    async handle(request: DecodedRequest<Params, Query, Body>) {
        await AdminToken.authenticate(request);
        const query = GetOrganizationsEndpoint.buildQuery(request.query)
        
        const count = await query
            .count();

        return new Response(
            CountResponse.create({
                count
            })
        );
    }
}
