import { DecodedRequest, Endpoint, Request, Response } from "@simonbackx/simple-endpoints";
import { SimpleError } from '@simonbackx/simple-errors';
import { BalanceItem, Order, Token, Webshop } from '@stamhoofd/models';
import { PermissionLevel } from "@stamhoofd/structures";

type Params = { id: string };
type Query = undefined;
type Body = undefined;
type ResponseBody = undefined;

/**
 * One endpoint to create, patch and delete groups. Usefull because on organization setup, we need to create multiple groups at once. Also, sometimes we need to link values and update multiple groups at once
 */

export class DeleteWebshopEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {

    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method != "DELETE") {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, "/webshop/@id", { id: String });

        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    async handle(request: DecodedRequest<Params, Query, Body>) {
        const token = await Token.authenticate(request);
        const user = token.user

        if (!user.permissions ) {
            throw new SimpleError({
                code: "permission_denied",
                message: "You do not have permissions for this endpoint",
                statusCode: 403
            })
        }

        const webshop = await Webshop.getByID(request.params.id)
        if (!webshop || webshop.organizationId != user.organizationId) {
            throw new SimpleError({
                code: "not_found",
                message: "Webshop not found",
                human: "De webshop die je wilt aanpassen bestaat niet (meer)"
            })
        }

        if (!webshop.privateMeta.permissions.userHasAccess(user, PermissionLevel.Full)) {
            throw new SimpleError({
                code: "permission_denied",
                message: "You do not have permissions for this endpoint",
                statusCode: 403
            })
        }

        const orders = await Order.where({ webshopId: webshop.id });
        await BalanceItem.deleteForDeletedOrders(orders.map(o => o.id))
        await webshop.delete()
        return new Response(undefined);
    }
}
