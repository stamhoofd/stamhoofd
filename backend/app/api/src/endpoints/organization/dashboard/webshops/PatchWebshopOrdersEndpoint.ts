import { ArrayDecoder, AutoEncoderPatchType, Data, Decoder, PatchableArray, PatchableArrayAutoEncoder, PatchableArrayDecoder, StringDecoder } from '@simonbackx/simple-encoding';
import { DecodedRequest, Endpoint, Request, Response } from "@simonbackx/simple-endpoints";
import { SimpleError } from "@simonbackx/simple-errors";
import { BalanceItem, BalanceItemPayment, Order, Payment, Token, Webshop } from '@stamhoofd/models';
import { QueueHandler } from '@stamhoofd/queues';
import { BalanceItemStatus, OrderStatus, PaymentMethod, PaymentStatus, PermissionLevel, PrivateOrder, PrivatePayment,Webshop as WebshopStruct } from "@stamhoofd/structures";

import { Context } from '../../../../helpers/Context';

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
        const organization = await Context.setOrganizationScope();
        await Context.authenticate()

        // Fast throw first (more in depth checking for patches later)
        if (!await Context.auth.hasSomeAccess(organization.id)) {
            throw Context.auth.error()
        }

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
            if (!webshop || !await Context.auth.canAccessWebshop(webshop, PermissionLevel.Write)) {
                throw Context.auth.notFoundOrNoAccess()
            }

            const orders = body.getPatches().length > 0 ? await Order.where({
                webshopId: webshop.id,
                id: {
                    sign: "IN",
                    value: body.getPatches().map(o => o.id)
                }
            }) : []

            // We use a getter because we need to have an up to date webshop struct
            // otherwise we won't validate orders on the latest webshop with the latest stock information
            const webshopGetter = {
                get struct() {
                    return WebshopStruct.create(webshop);
                }
            }

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

                const order = model.setRelation(Order.webshop, webshop.setRelation(Webshop.organization, organization))

                // TODO: validate before updating stock
                order.data.validate(webshopGetter.struct, organization.meta, request.i18n, true);
                
                try {
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
                        balanceItem.status = BalanceItemStatus.Pending;
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

                        balanceItem.description = order.generateBalanceDescription(webshop)
                        await balanceItem.save()
                    }
                } catch (e) {
                    await order.deleteOrderBecauseOfCreationError()
                    throw e;
                }
                
                orders.push(order)
            }

            for (const patch of body.getPatches()) {
                const model = orders.find(p => p.id == patch.id)
                if (!model) {
                    throw new SimpleError({
                        code: "not_found",
                        message: "Order with id "+patch.id+" does not exist"
                    })
                }
                const previousToPay = model.totalToPay;
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
                        model.data.validate(webshopGetter.struct, organization.meta, request.i18n, true);
                    }
                }

                if (model.status === OrderStatus.Deleted) {
                    model.data.removePersonalData()
                }

                if (model.status === OrderStatus.Deleted || model.status === OrderStatus.Canceled) {
                    model.markUpdated()
                    // Cancel payment if still pending
                    await BalanceItem.deleteForDeletedOrders([model.id])
                } else {
                    if (previousStatus === OrderStatus.Canceled || previousStatus === OrderStatus.Deleted) {
                        model.markUpdated()
                        // Undo deletion
                        await BalanceItem.undoForDeletedOrders([model.id])
                    }
                }

                // Update balance item prices for this order if price has changed
                if (previousToPay !== model.totalToPay) {
                    const items = await BalanceItem.where({ orderId: model.id })
                    if (items.length >= 1) {
                        model.markUpdated()
                        items[0].price = model.totalToPay
                        items[0].description = model.generateBalanceDescription(webshop)
                        items[0].updateStatus();
                        await items[0].save()

                        // Zero out the other items
                        const otherItems = items.slice(1)
                        await BalanceItem.deleteItems(otherItems)
                    } else if (items.length === 0
                         && model.totalToPay > 0) {
                        model.markUpdated()
                        const balanceItem = new BalanceItem();
                        balanceItem.orderId = model.id;
                        balanceItem.price = model.totalToPay
                        balanceItem.description = model.generateBalanceDescription(webshop)
                        balanceItem.pricePaid = 0
                        balanceItem.organizationId = organization.id;
                        balanceItem.status = BalanceItemStatus.Pending;
                        await balanceItem.save();
                    }
                }

                await model.save()
                await model.setRelation(Order.webshop, webshop).updateStock(previousData)
                await model.setRelation(Order.webshop, webshop).updateTickets()
            }

            const mapped = orders.map(order => order.setRelation(Order.webshop, webshop))
            return mapped
        })

        return new Response(
            await Order.getPrivateStructures(orders)
        );
    }
}
