import { AutoEncoder, AutoEncoderPatchType,Decoder, field, StringDecoder } from '@simonbackx/simple-encoding';
import { DecodedRequest, Endpoint, Request, Response } from "@simonbackx/simple-endpoints";
import { SimpleError, SimpleErrors } from '@simonbackx/simple-errors';
import { Token } from '@stamhoofd/models';
import { Webshop } from '@stamhoofd/models';
import { QueueHandler } from '@stamhoofd/queues';
import { PrivateWebshop, WebshopUriAvailabilityResponse } from "@stamhoofd/structures";

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
        const token = await Token.authenticate(request);
        const user = token.user

        if (!user.permissions) {
            throw new SimpleError({
                code: "permission_denied",
                message: "You do not have permissions for this endpoint",
                statusCode: 403
            })
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
