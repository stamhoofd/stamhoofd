import { DecodedRequest, Endpoint, Request, Response } from "@simonbackx/simple-endpoints";
import { SimpleError } from '@simonbackx/simple-errors';
import { Webshop } from '@stamhoofd/models';
import { PrivateWebshop, Webshop as WebshopStruct } from "@stamhoofd/structures";

import { AuthenticatedStructures } from "../../../helpers/AuthenticatedStructures";
import { Context } from "../../../helpers/Context";

type Params = { id: string };
type Query = undefined;
type Body = undefined
type ResponseBody = PrivateWebshop | WebshopStruct;

export class GetWebshopEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method != "GET") {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, "/webshop/@id", { id: String });

        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    async handle(request: DecodedRequest<Params, Query, Body>) {
        if (Context.version < 244) {
            await Context.setOptionalOrganizationScope();
        } else {
            await Context.setOrganizationScope();
        }
        
        await Context.optionalAuthenticate()

        const webshop = await Webshop.getByID(request.params.id)
        if (!webshop) {
            throw new SimpleError({
                code: "not_found",
                message: "Webshop not found",
                human: "Deze webshop bestaat niet (meer)"
            })
        }
        
        return new Response(
            await AuthenticatedStructures.webshop(webshop)
        );
    }
}
