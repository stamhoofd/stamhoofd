import { Decoder } from "@simonbackx/simple-encoding";
import { DecodedRequest, Endpoint, Request, Response } from "@simonbackx/simple-endpoints";
import { Order, Webshop } from '@stamhoofd/models';
import { PaginatedResponse, PermissionLevel, PrivateOrder, WebshopOrdersQuery } from "@stamhoofd/structures";

import { Context } from "../../../../helpers/Context";

type Params = { id: string };
type Query = WebshopOrdersQuery
type Body = undefined
type ResponseBody = PaginatedResponse<PrivateOrder[], Query>

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
        const organization = await Context.setOrganizationScope();
        await Context.authenticate()

        // Fast throw first (more in depth checking for patches later)
        if (!await Context.auth.hasSomeAccess(organization.id)) {
            throw Context.auth.error()
        }

        const webshop = await Webshop.getByID(request.params.id)
        if (!webshop || !await Context.auth.canAccessWebshop(webshop, PermissionLevel.Read)) {
            throw Context.auth.notFoundOrNoAccess("Je hebt geen toegang tot de bestellingen van deze webshop")
        }

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

        //const paymentIds = orders.map(o => o.paymentId).filter(p => !!p) as string[]
        //if (paymentIds.length > 0) {
        //    const payments = await Payment.getByIDs(...paymentIds)
        //    for (const order of orders) {
        //        const payment = payments.find(p => p.id === order.paymentId)
        //        order.setOptionalRelation(Order.payment, payment ?? null)
        //    }
        //} else {
        //     for (const order of orders) {
        //        order.setOptionalRelation(Order.payment, null)
        //    }
        //}

        const structures = await Order.getPrivateStructures(orders)
       
        return new Response(
            new PaginatedResponse({ 
                results: structures,
                next: orders.length >= limit ? WebshopOrdersQuery.create({
                    updatedSince: orders[orders.length - 1].updatedAt ?? undefined,
                    afterNumber: orders[orders.length - 1].number ?? undefined
                }) : undefined
            })
        );
    }
}
