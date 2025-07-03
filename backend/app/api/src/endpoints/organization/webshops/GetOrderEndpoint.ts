import { DecodedRequest, Endpoint, Request, Response } from '@simonbackx/simple-endpoints';
import { SimpleError } from '@simonbackx/simple-errors';
import { Order } from '@stamhoofd/models';
import { Order as OrderStruct } from '@stamhoofd/structures';

import { Context } from '../../../helpers/Context';
type Params = { id: string; orderId: string };
type Query = undefined;
type Body = undefined;
type ResponseBody = OrderStruct;

export class GetOrderEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method !== 'GET') {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, '/webshop/@id/order/@orderId', { id: String, orderId: String });

        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    async handle(request: DecodedRequest<Params, Query, Body>) {
        const organization = await Context.setOrganizationScope({ willAuthenticate: false });
        const order = await Order.getByID(request.params.orderId);

        if (!order || order.webshopId !== request.params.id || order.organizationId !== organization.id) {
            throw new SimpleError({
                code: 'not_found',
                message: 'Order not found',
                human: $t(`1aced6e8-6b32-4da5-b176-906df0a1cc0a`),
            });
        }

        return new Response(await order.getStructure());
    }
}
