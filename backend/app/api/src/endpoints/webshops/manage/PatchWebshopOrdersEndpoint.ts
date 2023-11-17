import { ArrayDecoder, AutoEncoderPatchType, Data, Decoder, PatchableArray, PatchableArrayAutoEncoder, PatchableArrayDecoder, StringDecoder } from '@simonbackx/simple-encoding';
import { DecodedRequest, Endpoint, Request, Response } from "@simonbackx/simple-endpoints";
import { SimpleError } from "@simonbackx/simple-errors";
import { BalanceItem, BalanceItemPayment, Order, Payment, Token, Webshop } from '@stamhoofd/models';
import { QueueHandler } from '@stamhoofd/queues';
import { BalanceItemStatus, OrderStatus, PaymentMethod, PaymentStatus, PermissionLevel, PrivateOrder, PrivatePayment,Webshop as WebshopStruct } from "@stamhoofd/structures";

type Params = { id: string };
type Query = undefined;
type Body = AutoEncoderPatchType<PrivateOrder>[] | PatchableArrayAutoEncoder<PrivateOrder>
type ResponseBody = PrivateOrder[]

class VersionSpecificDecoder<A, B> implements Decoder<A | B> {
    oldDecoder: Decoder<A>;
    version: number;
    newerDecoder: Decoder<B>;

    constructor(oldDecoder: Decoder<A>, version: number, newerDecoder: Decoder<B>) {
        this.oldDecoder = oldDecoder;
        this.version = version;
        this.newerDecoder = newerDecoder;
    }

    decode(data: Data): A | B {
        // Set the version of the decoding context of "data"
        const v = data.context.version

        if (v >= this.version) {
            return this.newerDecoder.decode(data);
        }

       return this.oldDecoder.decode(data);
    }
}

export class PatchWebshopOrdersEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    bodyDecoder = new VersionSpecificDecoder(
        // Before version 159, accept an array of patches
        new ArrayDecoder(PrivateOrder.patchType() as Decoder<AutoEncoderPatchType<PrivateOrder>>),
        159,
        // After or at version 159, accept a patchable array
        new PatchableArrayDecoder(PrivateOrder as Decoder<PrivateOrder>, PrivateOrder.patchType() as Decoder<AutoEncoderPatchType<PrivateOrder>>, StringDecoder)
    );

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

        let body: PatchableArrayAutoEncoder<PrivateOrder> = new PatchableArray()

        // Migrate old syntax
        if (Array.isArray(request.body)) {
            for (const p of request.body) {
                body.addPatch(p);
            }
        } else {
            body = request.body
        }

        if (body.changes.length == 0) {
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

            if (!webshop.privateMeta.permissions.userHasAccess(token.user, PermissionLevel.Write)) {
                throw new SimpleError({
                    code: "permission_denied",
                    message: "No permissions for this webshop",
                    human: "Je hebt geen toegang om bestellingen te bewerken van deze webshop",
                    statusCode: 403
                })
            }
            
            const orders = body.getPatches().length > 0 ? await Order.where({
                webshopId: webshop.id,
                id: {
                    sign: "IN",
                    value: body.getPatches().map(o => o.id)
                }
            }) : []

            const organization = token.user.organization

            // TODO: handle order creation here
            for (const put of body.getPuts()) {
                const struct = put.put
                const model = new Order()
                model.webshopId = webshop.id
                model.organizationId = webshop.organizationId
                model.status = struct.status
                model.data = struct.data

                // For now, we don't invalidate tickets, because they will get invalidated at scan time (the order status is checked)
                // This allows you to revalidate a ticket without needing to generate a new one (e.g. when accidentally canceling an order) 
                // -> the user doesn't need to download the ticket again
                // + added benefit: we can inform the user that the ticket was canceled, instead of throwing an 'invalid ticket' error

                if (model.status === OrderStatus.Deleted) {
                    model.data.removePersonalData()
                }

                const order = model.setRelation(Order.webshop, webshop.setRelation(Webshop.organization, token.user.organization))

                // TODO: validate before updating stock
                await order.updateStock()
                const totalPrice = order.data.totalPrice

                if (totalPrice == 0) {
                    // Force unknown payment method
                    order.data.paymentMethod = PaymentMethod.Unknown

                    // Mark this order as paid
                    await order.markPaid(null, organization, webshop)
                    await order.save()
                } else {
                    const payment = new Payment()
                    payment.organizationId = organization.id
                    payment.method = struct.data.paymentMethod
                    payment.status = PaymentStatus.Created
                    payment.price = totalPrice
                    payment.paidAt = null

                    // Determine the payment provider (always null because no online payments here)
                    payment.provider = null

                    await payment.save()

                    order.paymentId = payment.id
                    order.setRelation(Order.payment, payment)

                    // Create balance item
                    const balanceItem = new BalanceItem();
                    balanceItem.orderId = order.id;
                    balanceItem.price = totalPrice
                    balanceItem.description = webshop.meta.name
                    balanceItem.pricePaid = 0
                    balanceItem.organizationId = organization.id;
                    balanceItem.status = BalanceItemStatus.Hidden;
                    await balanceItem.save();

                    // Create one balance item payment to pay it in one payment
                    const balanceItemPayment = new BalanceItemPayment()
                    balanceItemPayment.balanceItemId = balanceItem.id;
                    balanceItemPayment.paymentId = payment.id;
                    balanceItemPayment.organizationId = organization.id;
                    balanceItemPayment.price = balanceItem.price;
                    await balanceItemPayment.save();

                    if (payment.method == PaymentMethod.Transfer) {
                        await order.markValid(payment, [])

                        // Only now we can update the transfer description, since we need the order number as a reference
                        payment.transferSettings = webshop.meta.transferSettings.fillMissing(organization.mappedTransferSettings)
                        payment.generateDescription(organization, (order.number ?? "")+"")
                        await payment.save()
                        await order.save()
                    } else if (payment.method == PaymentMethod.PointOfSale) {
                        // Not really paid, but needed to create the tickets if needed
                        await order.markPaid(payment, organization, webshop)
                        await payment.save()
                        await order.save()
                    } else {
                        throw new Error("Unsupported payment method")
                    }

                }
                
                orders.push(order)
            }
            const webshopStruct = WebshopStruct.create(webshop)

            for (const patch of body.getPatches()) {
                const model = orders.find(p => p.id == patch.id)
                if (!model) {
                    throw new SimpleError({
                        code: "not_found",
                        message: "Order with id "+patch.id+" does not exist"
                    })
                }

                const previousStatus = model.status

                model.status = patch.status ?? model.status

                // For now, we don't invalidate tickets, because they will get invalidated at scan time (the order status is checked)
                // This allows you to revalidate a ticket without needing to generate a new one (e.g. when accidentally canceling an order) 
                // -> the user doesn't need to download the ticket again
                // + added benefit: we can inform the user that the ticket was canceled, instead of throwing an 'invalid ticket' error

                const previousData = model.data.clone()
                if (patch.data) {
                    model.data.patchOrPut(patch.data)

                    if (model.status !== OrderStatus.Deleted) {
                        // Make sure all data is up to date and validated (= possible corrections happen here too)
                        model.data.validate(webshopStruct, organization.meta, request.i18n, true);
                    }
                }

                if (model.status === OrderStatus.Deleted) {
                    model.data.removePersonalData()
                }

                if (model.status === OrderStatus.Deleted || model.status === OrderStatus.Canceled) {
                    // Cancel payment if still pending
                    await BalanceItem.deleteForDeletedOrders([model.id])
                } else {
                    if (previousStatus === OrderStatus.Canceled || previousStatus === OrderStatus.Deleted) {
                        // Undo deletion
                        await BalanceItem.undoForDeletedOrders([model.id])
                    }
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

                if (!payment || payment.status === PaymentStatus.Succeeded || payment.method === PaymentMethod.PointOfSale) {
                    await order.updateTickets()
                }
            }
        } else {
            for (const order of orders) {
                order.setOptionalRelation(Order.payment, null)

                if (order.paymentId === null) {
                    await order.updateTickets()
                }
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
