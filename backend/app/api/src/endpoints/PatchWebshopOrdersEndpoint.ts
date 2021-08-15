import { ArrayDecoder, AutoEncoderPatchType, Decoder } from '@simonbackx/simple-encoding';
import { DecodedRequest, Endpoint, Request, Response } from "@simonbackx/simple-endpoints";
import { SimpleError } from "@simonbackx/simple-errors";
import { Order } from '@stamhoofd/models';
import { Payment } from '@stamhoofd/models';
import { Token } from '@stamhoofd/models';
import { Webshop } from '@stamhoofd/models';
import { QueueHandler } from '@stamhoofd/queues';
import { getPermissionLevelNumber, Order as OrderStruct, Payment as PaymentStruct, PermissionLevel } from "@stamhoofd/structures";

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

        if (request.body.length == 0) {
            return new Response([]);
        }

        // Need to happen in the queue because we are updating the webshop stock
        const orders = await QueueHandler.schedule("webshop-stock/"+request.params.id, async () => {

            const webshop = await Webshop.getByID(request.params.id)
            if (!webshop || token.user.organizationId != webshop.organizationId) {
                throw new SimpleError({
                    code: "not_found",
                    message: "Webshop not found",
                    human: "Deze webshop bestaat niet (meer)"
                })
            }

            if (!token.user.permissions || getPermissionLevelNumber(webshop.privateMeta.permissions.getPermissionLevel(token.user.permissions)) < getPermissionLevelNumber(PermissionLevel.Write)) {
                throw new SimpleError({
                    code: "permission_denied",
                    message: "No permissions for this webshop",
                    human: "Je hebt geen toegang om bestellingen te bewerken van deze webshop",
                    statusCode: 403
                })
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

                const didIncludeStock = model.shouldIncludeStock()

                model.status = patch.status ?? model.status

                if (didIncludeStock && !model.shouldIncludeStock()) {
                    // Remove from stock
                    await model.setRelation(Order.webshop, webshop).updateStock(false)
                } else if (!didIncludeStock && model.shouldIncludeStock()) {
                    // Add to stock
                    await model.setRelation(Order.webshop, webshop).updateStock()
                }
            }

            // Save best inside the queue to prevent duplicate stock updates
            for (const order of orders) {
                // Automatically checks if it is changed or not
                await order.save()
            }

            return orders
        })

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
