import { DecodedRequest, Endpoint, Request, Response } from "@simonbackx/simple-endpoints";
import { SimpleError } from '@simonbackx/simple-errors';
import { Webshop, WebshopDiscountCode } from '@stamhoofd/models';
import { DiscountCode, PermissionLevel } from "@stamhoofd/structures";

import { Context } from "../../../../helpers/Context";

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
        const organization = await Context.setOrganizationScope();
        await Context.authenticate()

        // Fast throw first (more in depth checking for patches later)
        if (!await Context.auth.hasSomeAccess(organization.id)) {
            throw Context.auth.error()
        }

        const webshop = await Webshop.getByID(request.params.id)
        if (!webshop || !await Context.auth.canAccessWebshop(webshop, PermissionLevel.Full)) {
            throw Context.auth.notFoundOrNoAccess()
        }
        
        const discountCodes = await WebshopDiscountCode.where({webshopId: request.params.id})

        return new Response(
            discountCodes.map(d => d.getStructure())
        );
    }
}
