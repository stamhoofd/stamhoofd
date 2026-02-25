import { PartialWithoutMethods } from '@simonbackx/simple-encoding';
import { DecodedRequest, Endpoint, Request, Response } from '@simonbackx/simple-endpoints';
import { SimpleError } from '@simonbackx/simple-errors';
import { Order } from '@stamhoofd/models';
import { Payment } from '@stamhoofd/models';
import { Order as OrderStruct } from '@stamhoofd/structures';

import { Context } from '../../../helpers/Context.js';
type Params = { id: string; paymentId: string };
type Query = undefined;
type Body = undefined;
type ResponseBody = OrderStruct;

export class GetOrderByPaymentEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method !== 'GET') {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, '/webshop/@id/payment/@paymentId/order', { id: String, paymentId: String });

        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    async handle(request: DecodedRequest<Params, Query, Body>) {
        const organization = await Context.setOrganizationScope({ willAuthenticate: false });
        const payment = await Payment.getByID(request.params.paymentId);

        if (!payment || payment.organizationId !== organization.id) {
            throw new SimpleError({
                code: 'not_found',
                message: 'Order not found',
                human: $t(`1aced6e8-6b32-4da5-b176-906df0a1cc0a`),
            });
        }
        const [order] = await Order.where({ paymentId: payment.id }, { limit: 1 });
        if (!order || order.webshopId !== request.params.id || order.organizationId !== organization.id) {
            throw new SimpleError({
                code: 'not_found',
                message: 'Order not found',
                human: $t(`1aced6e8-6b32-4da5-b176-906df0a1cc0a`),
            });
        }

        order.setRelation(Order.payment, payment);
        return new Response(await order.getStructure());
    }
}
