import type { DecodedRequest, Request } from '@simonbackx/simple-endpoints';
import { Endpoint, Response } from '@simonbackx/simple-endpoints';
import { SimpleError } from '@simonbackx/simple-errors';
import { Order, Webshop } from '@stamhoofd/models';
import type { Order as OrderStruct } from '@stamhoofd/structures';

import { Context } from '../../../helpers/Context.js';
import { WebshopAuthHelper } from './WebshopAuthHelper.js';
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
                human: $t(`%FY`),
            });
        }

        const webshop = await Webshop.getByID(request.params.id);
        if (!webshop || webshop.organizationId !== organization.id) {
            throw new SimpleError({
                code: 'not_found',
                message: 'Webshop not found',
                human: $t(`%FX`),
            });
        }

        await WebshopAuthHelper.checkOrderAccess(webshop, order);

        return new Response(await order.getStructure());
    }
}
