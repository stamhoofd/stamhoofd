import { DecodedRequest, Endpoint, Request, Response } from "@simonbackx/simple-endpoints";
import { SimpleError } from "@simonbackx/simple-errors";
import { Order } from '@stamhoofd/models';
import { Token } from '@stamhoofd/models';
import { Webshop } from '@stamhoofd/models';
import { QueueHandler } from "@stamhoofd/queues";
import { getPermissionLevelNumber, OrderStatus, PermissionLevel } from "@stamhoofd/structures";

type Params = { id: string; orderId: string };
type Query = undefined;
type Body = undefined
type ResponseBody = undefined

export class PatchWebshopOrdersEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method != "DELETE") {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, "/webshop/@id/orders/@orderId", { id: String, orderId: String });

        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    async handle(request: DecodedRequest<Params, Query, Body>) {
        const token = await Token.authenticate(request);

        await QueueHandler.schedule("webshop-stock/"+request.params.id, async () => {
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
                    human: "Je hebt geen toegang om bestellingen te verwijderen van deze webshop",
                    statusCode: 403
                })
            }
            
            const order = await Order.getByID(request.params.orderId)

            if (!order || order.webshopId != webshop.id) {
                throw new SimpleError({
                    code: "order_not_found",
                    message: "No order found",
                    human: "De bestelling die je wilt verwijderen bestaat niet (meer)"
                })
            }

            if (order.shouldIncludeStock()) {
                // Remove from stock
                order.status = OrderStatus.Canceled
                await order.setRelation(Order.webshop, webshop).updateStock()
            }

            await order.delete()      
        });
        return new Response(undefined);
    }
}
