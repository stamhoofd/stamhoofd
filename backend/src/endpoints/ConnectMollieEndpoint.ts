
import { AutoEncoder, Decoder,field, StringDecoder } from '@simonbackx/simple-encoding';
import { DecodedRequest, Endpoint, Request, Response } from '@simonbackx/simple-endpoints'
import { SimpleError } from '@simonbackx/simple-errors'
import { Organization as OrganizationStruct  } from "@stamhoofd/structures";

import { MollieToken } from '../models/MollieToken';
import { Token } from '../models/Token';

type Params = {};

class Body extends AutoEncoder {
    @field({ decoder: StringDecoder })
    code: string
}

type Query = undefined
type ResponseBody = OrganizationStruct

export class ConnectMollieEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {    
    bodyDecoder = Body as Decoder<Body>

    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method != "POST") {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, "/mollie/connect", {});

        if (params) {
            return [true, params as Params];
        }

        return [false];
    }

    async handle(request: DecodedRequest<Params, Query, Body>) {
        const token = await Token.authenticate(request);
        const user = token.user

        if (!user.permissions || !user.permissions.hasFullAccess()) {
            throw new SimpleError({
                code: "permission_denied",
                message: "Je moet administrator zijn om mollie te kunnen connecteren"
            })
        }

        await MollieToken.create(user.organization, request.body.code)
        
        return new Response(await user.getOrganizatonStructure(user.organization));
    }
}
