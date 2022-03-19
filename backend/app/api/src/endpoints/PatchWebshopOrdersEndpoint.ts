import { ArrayDecoder, AutoEncoderPatchType, Decoder } from '@simonbackx/simple-encoding';
import { DecodedRequest, Endpoint, Request, Response } from "@simonbackx/simple-endpoints";
import { SimpleError } from "@simonbackx/simple-errors";
import { Order } from '@stamhoofd/models';
import { Payment } from '@stamhoofd/models';
import { Token } from '@stamhoofd/models';
import { Webshop } from '@stamhoofd/models';
import { QueueHandler } from '@stamhoofd/queues';
import { getPermissionLevelNumber, OrderStatus, PaymentStatus, PermissionLevel,PrivateOrder, PrivatePayment } from "@stamhoofd/structures";

type Params = { id: string };
type Query = undefined;
type Body = AutoEncoderPatchType<PrivateOrder>[]
type ResponseBody = PrivateOrder[]

export class PatchWebshopOrdersEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    bodyDecoder = new ArrayDecoder(PrivateOrder.patchType() as Decoder<AutoEncoderPatchType<PrivateOrder>>)

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

            // Todo: handle order creation here

            for (const patch of request.body) {
                const model = orders.find(p => p.id == patch.id)
                if (!model) {
                    throw new SimpleError({
                        code: "not_found",
                        message: "Order with id "+patch.id+" does not exist"
                    })
                }

                model.status = patch.status ?? model.status

                // For now, we don't invalidate tickets, because they will get invalidated at scan time (the order status is checked)
                // This allows you to revalidate a ticket without needing to generate a new one (e.g. when accidentally canceling an order) 
                // -> the user doesn't need to download the ticket again
                // + added benefit: we can inform the user that the ticket was canceled, instead of throwing an 'invalid ticket' error

                const previousData = model.data.clone()
                if (patch.data) {
                    model.data.patchOrPut(patch.data)
                }

                if (model.status === OrderStatus.Deleted) {
                    model.data.removePersonalData()
                }

                await model.save()
                await model.setRelation(Order.webshop, webshop).updateStock(previousData)
            }

            const mapped = orders.map(order => order.setRelation(Order.webshop, webshop))
            return mapped
        })

        // Load payments
        const paymentIds = orders.map(o => o.paymentId).filter(p => !!p) as string[]
        if (paymentIds.length > 0) {
            const payments = await Payment.getByIDs(...paymentIds)
            for (const order of orders) {
                const payment = payments.find(p => p.id === order.paymentId)
                order.setOptionalRelation(Order.payment, payment ?? null)

                if (payment && payment.status === PaymentStatus.Succeeded) {
                    await order.updateTickets()
                }
            }
        } else {
            for (const order of orders) {
                order.setOptionalRelation(Order.payment, null)
            }
        }
    
        return new Response(
            (orders as (Order & Record<"webshop", Webshop> & { payment: Payment | null })[])
                .map(order => PrivateOrder.create({
                    ...order, 
                    payment: order.payment ? PrivatePayment.create(order.payment) : null }
                )),
        );
    }
}
