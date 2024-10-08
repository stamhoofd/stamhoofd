import { Decoder } from '@simonbackx/simple-encoding';
import { DecodedRequest, Endpoint, Request, Response } from '@simonbackx/simple-endpoints';
import { CountFilteredRequest, CountResponse } from '@stamhoofd/structures';

import { Context } from '../../../../helpers/Context';
import { GetWebshopOrdersEndpoint } from './GetWebshopOrdersEndpoint';

type Params = { id: string };
type Query = CountFilteredRequest;
type Body = undefined;
type ResponseBody = CountResponse;

export class GetWebshopOrdersCountEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    queryDecoder = CountFilteredRequest as Decoder<CountFilteredRequest>;

    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method !== 'GET') {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, '/webshop/@id/orders/count', { id: String });

        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    async handle(request: DecodedRequest<Params, Query, Body>) {
        const organization = await Context.setOrganizationScope();
        await Context.authenticate();

        // Fast throw first (more in depth checking for patches later)
        if (!await Context.auth.hasSomeAccess(organization.id)) {
            throw Context.auth.error();
        }

        const webshopId = request.params.id;
        const query = GetWebshopOrdersEndpoint.buildQuery(webshopId, request.query);

        const count = await query
            .count();

        return new Response(
            CountResponse.create({
                count,
            }),
        );
    }
}
