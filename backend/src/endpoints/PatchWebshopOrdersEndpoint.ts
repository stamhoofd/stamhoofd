import { ArrayDecoder, AutoEncoderPatchType, Decoder } from '@simonbackx/simple-encoding';
import { DecodedRequest, Endpoint, Request, Response } from "@simonbackx/simple-endpoints";
import { SimpleError } from "@simonbackx/simple-errors";
import { Order as OrderStruct,Payment as PaymentStruct } from "@stamhoofd/structures";

import { Order } from '../models/Order';
import { Payment } from '../models/Payment';
import { Token } from '../models/Token';
import { Webshop } from '../models/Webshop';

type Params = { id: string };
type Query = undefined;
type Body = AutoEncoderPatchType<OrderStruct>[]
type ResponseBody = OrderStruct[]

export class PatchWebshopOrdersEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    bodyDecoder = new ArrayDecoder(OrderStruct.patchType() as Decoder<AutoEncoderPatchType<OrderStruct>>)

    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method != "PATCH") {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, "/webshop/@id/orders", { id: String });

        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    async handle(request: DecodedRequest<Params, Query, Body>) {
        const token = await Token.authenticate(request);

        const webshop = await Webshop.getByID(request.params.id)
        if (!webshop || token.user.organizationId != webshop.organizationId) {
            throw new SimpleError({
                code: "not_found",
                message: "Webshop not found",
                human: "Deze webshop bestaat niet (meer)"
            })
        }

        if (!token.user.permissions || !token.user.permissions.hasFullAccess()) {
            throw new SimpleError({
                code: "permission_denied",
                message: "No permissions for this webshop",
                human: "Je hebt geen toegang tot de bestellingen van deze webshop"
            })
        }

        if (request.body.length == 0) {
            return new Response([]);
        }
        
        const orders = await Order.where({
            webshopId: webshop.id,
            id: {
                sign: "IN",
                value: request.body.map(o => o.id)
            }
        })

        for (const patch of request.body) {
            const model = orders.find(p => p.id == patch.id)
            if (!model) {
                throw new SimpleError({
                    code: "not_found",
                    message: "Order with id "+patch.id+" does not exist"
                })
            }

            model.status = patch.status ?? model.status
        }

        for (const order of orders) {
            // Automatically checks if it is changed or not
            await order.save()
        }

        // Load payments
        const paymentIds = orders.map(o => o.paymentId).filter(p => !!p) as string[]
        if (paymentIds.length > 0) {
            const payments = await Payment.getByIDs(...paymentIds)
            for (const order of orders) {
                const payment = payments.find(p => p.id === order.paymentId)
                order.setOptionalRelation(Order.payment, payment ?? null)
            }
        } else {
             for (const order of orders) {
                order.setOptionalRelation(Order.payment, null)
            }
        }
      
        return new Response(
            (orders as (Order & { payment: Payment | null })[]).map(order => OrderStruct.create(Object.assign({
                ...order
            }, { payment: order.payment ? PaymentStruct.create(order.payment) : null }))),
        );
    }
}
