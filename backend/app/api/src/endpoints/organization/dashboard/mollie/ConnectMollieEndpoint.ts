
import { AutoEncoder, Decoder, field, StringDecoder } from '@simonbackx/simple-encoding';
import { DecodedRequest, Endpoint, Request, Response } from '@simonbackx/simple-endpoints';
import { MollieToken } from '@stamhoofd/models';
import { Organization as OrganizationStruct, PermissionLevel } from "@stamhoofd/structures";

import { AuthenticatedStructures } from '../../../../helpers/AuthenticatedStructures';
import { checkMollieSettlementsFor } from '../../../../helpers/CheckSettlements';
import { Context } from '../../../../helpers/Context';

type Params = Record<string, never>;

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
        const organization = await Context.setOrganizationScope();
        await Context.authenticate()

        // Fast throw first (more in depth checking for patches later)
        if (!Context.auth.canManagePaymentAccounts(PermissionLevel.Full)) {
            throw Context.auth.error()
        }

        const mollieToken = await MollieToken.create(organization, request.body.code)

        // Check settlements after linking (shouldn't block)
        checkMollieSettlementsFor(mollieToken.accessToken, true).catch(console.error)
        
        return new Response(await AuthenticatedStructures.organization(organization));
    }
}
