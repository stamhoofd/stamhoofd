import { Decoder } from "@simonbackx/simple-encoding";
import { DecodedRequest, Endpoint, Request, Response } from "@simonbackx/simple-endpoints";
import { SimpleError } from '@simonbackx/simple-errors';
import { Token, Webshop, WebshopDiscountCode } from '@stamhoofd/models';
import { DiscountCode, PermissionLevel, WebshopOrdersQuery } from "@stamhoofd/structures";

type Params = { id: string };
type Query = undefined
type Body = undefined
type ResponseBody = DiscountCode[]

export class GetWebshopDiscountCodesEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method != "GET") {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, "/webshop/@id/discount-codes", { id: String });

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

        if (!webshop.privateMeta.permissions.userHasAccess(token.user, PermissionLevel.Read)) {
            throw new SimpleError({
                code: "permission_denied",
                message: "No permissions for this webshop",
                human: "Je hebt geen toegang tot deze webshop",
                statusCode: 403
            })
        }
        
        const discountCodes = await WebshopDiscountCode.where({webshopId: request.params.id})

        return new Response(
            discountCodes.map(d => d.getStructure())
        );
    }
}
