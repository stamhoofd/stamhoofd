import { DecodedRequest, Endpoint, Request, Response } from "@simonbackx/simple-endpoints";
import { SimpleError } from '@simonbackx/simple-errors';
import { Order as OrderStruct, Payment as PaymentStruct } from "@stamhoofd/structures";

import { Order } from '../models/Order';
import { Payment } from '../models/Payment';
type Params = { id: string; orderId: string };
type Query = undefined;
type Body = undefined
type ResponseBody = OrderStruct

export class GetOrderEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method != "GET") {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, "/webshop/@id/order/@orderId", { id: String, orderId: String });

        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    async handle(request: DecodedRequest<Params, Query, Body>) {
        const order = await Order.getByID(request.params.orderId)

        if (!order || order.webshopId != request.params.id) {
            throw new SimpleError({
                code: "not_found",
                message: "Order not found",
                human: "Deze bestelling bestaat niet (meer)"
            })
        }

        if (order.paymentId) {
            const payment = await Payment.getByID(order.paymentId)
            if (!payment) {
                throw new Error("Failed to load relation payment")
            }
            order.setRelation(Order.payment, payment)
            return new Response(OrderStruct.create(Object.assign({...order}, { payment: PaymentStruct.create(payment) })));
        }
        
        return new Response(OrderStruct.create(Object.assign({}, order, { payment: null })));
    }
}
