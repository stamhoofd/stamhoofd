import { Decoder } from "@simonbackx/simple-encoding";
import { DecodedRequest, Endpoint, Request, Response } from "@simonbackx/simple-endpoints";
import { SimpleError, SimpleErrors } from '@simonbackx/simple-errors';
import { Order as OrderStruct,PaginatedResponse, Payment as PaymentStruct,PermissionLevel,SortDirection, WebshopOrdersQuery } from "@stamhoofd/structures";

import { Order } from '@stamhoofd/models';
import { Payment } from '@stamhoofd/models';
import { Token } from '@stamhoofd/models';
import { Webshop } from '@stamhoofd/models';

type Params = { id: string };
type Query = WebshopOrdersQuery
type Body = undefined
type ResponseBody = PaginatedResponse<OrderStruct, Query>

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

        if (!token.user.permissions || webshop.privateMeta.permissions.getPermissionLevel(token.user.permissions) === PermissionLevel.None) {
            throw new SimpleError({
                code: "permission_denied",
                message: "No permissions for this webshop",
                human: "Je hebt geen toegang tot de bestellingen van deze webshop",
                statusCode: 403
            })
        }
        
        errors.throwIfNotEmpty()

        const q: any = { 
            webshopId: webshop.id,
        }

        if (request.query.afterNumber !== null) {
            q.number = {
                sign: request.query.sort == SortDirection.Ascending ? ">" : "<",
                value: request.query.afterNumber ?? 0,
            }
        }

        const limit = 100

        const orders = await Order.where(q, {
            limit: limit,
            sort: [{
                column: "number",
                direction: request.query.sort == SortDirection.Ascending ? "ASC" : "DESC"
            }]
        })

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
                results: (orders as (Order & { payment: Payment | null })[]).map(order => OrderStruct.create(Object.assign({
                    ...order
                }, { payment: order.payment ? PaymentStruct.create(order.payment) : null }))),
                next: orders.length >= limit ? WebshopOrdersQuery.create({
                    afterNumber: orders[orders.length - 1].number ?? undefined,
                    sort: request.query.sort
                }) : undefined
            })
        );
    }
}
