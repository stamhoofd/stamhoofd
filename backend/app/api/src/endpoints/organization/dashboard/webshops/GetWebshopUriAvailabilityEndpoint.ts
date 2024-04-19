import { AutoEncoder, Decoder, field, StringDecoder } from '@simonbackx/simple-encoding';
import { DecodedRequest, Endpoint, Request, Response } from "@simonbackx/simple-endpoints";
import { Webshop } from '@stamhoofd/models';
import { PermissionLevel, WebshopUriAvailabilityResponse } from "@stamhoofd/structures";

import { Context } from '../../../../helpers/Context';

type Params = { id: string };
type Body = undefined;
class Query extends AutoEncoder {
    @field({ decoder: StringDecoder })
    uri: string;
}
type ResponseBody = WebshopUriAvailabilityResponse;

/**
 * One endpoint to create, patch and delete groups. Usefull because on organization setup, we need to create multiple groups at once. Also, sometimes we need to link values and update multiple groups at once
 */

export class GetWebshopUriAvailabilityEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    queryDecoder = Query as Decoder<Query>

    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method != "GET") {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, "/webshop/@id/check-uri", { id: String });

        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    async handle(request: DecodedRequest<Params, Query, Body>) {
        await Context.setOrganizationScope();
        await Context.authenticate()

        // Fast throw first (more in depth checking for patches later)
        if (!Context.auth.hasSomeAccess()) {
            throw Context.auth.error()
        }

        const webshop = await Webshop.getByID(request.params.id)
        if (!webshop || !Context.auth.canAccessWebshop(webshop, PermissionLevel.Full)) {
            throw Context.auth.notFoundOrNoAccess()
        }
        
        const q = await Webshop.where({ 
            uri: request.query.uri, 
            id: {
                sign: "!=",
                value: request.params.id
            } 
        }, { 
            limit: 1, 
            select: "id" 
        })

        const available = q.length == 0
        
        return new Response(
            WebshopUriAvailabilityResponse.create({
                available
            })
        );
    }
}
