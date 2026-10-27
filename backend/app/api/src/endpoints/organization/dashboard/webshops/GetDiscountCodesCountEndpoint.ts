import type { Decoder } from '@common/encoding';
import type { DecodedRequest, Request } from '@node/endpoints';
import { Endpoint, Response } from '@node/endpoints';
import { Webshop } from '@stamhoofd/models';
import { PermissionLevel } from '@stamhoofd/types/PermissionLevel';
import { CountFilteredRequest, CountResponse } from '@stamhoofd/structures';

import { Context } from '../../../../helpers/Context.js';
import { GetWebshopDiscountCodesEndpoint } from './GetDiscountCodesEndpoint.js';

type Params = { id: string };
type Query = CountFilteredRequest;
type Body = undefined;
type ResponseBody = CountResponse;

export class GetWebshopDiscountCodesCountEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    queryDecoder = CountFilteredRequest as Decoder<CountFilteredRequest>;

    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method !== 'GET') {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, '/webshop/@id/discount-codes/count', { id: String });

        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    async handle(request: DecodedRequest<Params, Query, Body>) {
        const organization = await Context.setOrganizationScope();
        await Context.authenticate();

        if (!await Context.auth.hasSomeAccess(organization.id)) {
            throw Context.auth.error();
        }

        const webshop = await Webshop.getByID(request.params.id);
        if (!webshop || !await Context.auth.canAccessWebshop(webshop, PermissionLevel.Full)) {
            throw Context.auth.notFoundOrNoAccess();
        }

        const query = await GetWebshopDiscountCodesEndpoint.buildQuery(request.query, { webshopId: webshop.id });

        const count = await query.count();

        return new Response(
            CountResponse.create({
                count,
            }),
        );
    }
}
