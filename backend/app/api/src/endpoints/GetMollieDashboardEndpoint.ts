
import { AutoEncoder, Decoder,field, StringDecoder } from '@simonbackx/simple-encoding';
import { DecodedRequest, Endpoint, Request, Response } from '@simonbackx/simple-endpoints'
import { SimpleError } from '@simonbackx/simple-errors'
import { MollieToken } from '@stamhoofd/models';
import { Token } from '@stamhoofd/models';
import { Organization as OrganizationStruct  } from "@stamhoofd/structures";

type Params = Record<string, never>;
type Body = undefined
type Query = undefined
type ResponseBody = string

export class GetMollieDashboardEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {    
    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method != "GET") {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, "/mollie/dashboard", {});

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
                message: "Je moet hoofdbeheerder zijn om mollie te kunnen connecteren"
            })
        }

        const mollie = await MollieToken.getTokenFor(user.organizationId)

        if (!mollie) {
            throw new SimpleError({
                code: "not_yet_linked",
                message: "Mollie is nog niet gekoppeld. Koppel Mollie eerst voor je de gegevens aanvult"
            })
        }

        const url = await mollie.getOnboardingLink()

        const response = new Response(url)
        response.headers['Content-Type'] = "text/plain"
        return response
    }
}
