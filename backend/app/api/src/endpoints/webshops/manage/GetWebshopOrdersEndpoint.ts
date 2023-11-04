import { Decoder } from "@simonbackx/simple-encoding";
import { DecodedRequest, Endpoint, Request, Response } from "@simonbackx/simple-endpoints";
import { SimpleError, SimpleErrors } from '@simonbackx/simple-errors';
import { Order, Payment, Token, Webshop } from '@stamhoofd/models';
import { PaginatedResponse, PermissionLevel, PrivateOrder, PrivatePayment, WebshopOrdersQuery } from "@stamhoofd/structures";

type Params = { id: string };
type Query = WebshopOrdersQuery
type Body = undefined
type ResponseBody = PaginatedResponse<PrivateOrder, Query>

export class GetWebshopOrdersEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    queryDecoder = WebshopOrdersQuery as Decoder<WebshopOrdersQuery>

    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method != "GET") {
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
        const errors = new SimpleErrors()

        const webshop = await Webshop.getByID(request.params.id)
        if (!webshop || token.user.organizationId != webshop.organizationId) {
            throw new SimpleError({
                code: "not_found",
                message: "Webshop not found",
                human: "Deze webshop bestaat niet (meer)"
            })
        }

        if (!webshop.privateMeta.permissions.userHasAccess(token.user, PermissionLevel.Read)) {
            if (!webshop.privateMeta.scanPermissions.userHasAccess(token.user, PermissionLevel.Write)) {
                throw new SimpleError({
                    code: "permission_denied",
                    message: "No permissions for this webshop",
                    human: "Je hebt geen toegang tot de bestellingen van deze webshop",
                    statusCode: 403
                })
            }
        }
        
        errors.throwIfNotEmpty()

        let orders: Order[] | undefined = undefined
        const limit = 50

        if (request.query.updatedSince !== undefined) {
            if (request.query.afterNumber !== undefined) {
                orders = await Order.select("WHERE webshopId = ? AND number is not null AND (updatedAt > ? OR (updatedAt = ? AND number > ?)) ORDER BY updatedAt, number LIMIT ?", [webshop.id, request.query.updatedSince, request.query.updatedSince, request.query.afterNumber, limit])
            } else {
                orders = await Order.select("WHERE webshopId = ? AND number is not null AND updatedAt >= ? ORDER BY updatedAt, number LIMIT ?", [webshop.id, request.query.updatedSince, limit])
            }
        } else if (request.query.afterNumber !== undefined) {
            orders = await Order.select("WHERE webshopId = ? AND number > ? ORDER BY updatedAt, number LIMIT ?", [webshop.id, request.query.afterNumber, limit])
        } else {
            orders = await Order.select("WHERE webshopId = ? AND number is not null ORDER BY updatedAt, number LIMIT ?", [webshop.id, limit])
        }

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
            new PaginatedResponse({ 
                results: (orders as (Order & { payment: Payment | null })[])
                    .map(order => PrivateOrder.create({
                        ...order, payment: order.payment ? PrivatePayment.create(order.payment) : null }
                    )),
                next: orders.length >= limit ? WebshopOrdersQuery.create({
                    updatedSince: orders[orders.length - 1].updatedAt ?? undefined,
                    afterNumber: orders[orders.length - 1].number ?? undefined
                }) : undefined
            })
        );
    }
}
