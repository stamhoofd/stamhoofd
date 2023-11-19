
import { DecodedRequest, Endpoint, Request, Response } from '@simonbackx/simple-endpoints'
import { SimpleError } from '@simonbackx/simple-errors'
import { MollieToken } from '@stamhoofd/models';
import { Token } from '@stamhoofd/models';
import { Organization as OrganizationStruct  } from "@stamhoofd/structures";

type Params = Record<string, never>;
type Body = undefined
type Query = undefined
type ResponseBody = OrganizationStruct

export class DisonnectMollieEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {    
    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method != "POST") {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, "/mollie/disconnect", {});

        if (params) {
            return [true, params as Params];
        }

        return [false];
    }

    async handle(request: DecodedRequest<Params, Query, Body>) {
        const token = await Token.authenticate(request);
        const user = token.user

        if (!user.hasFullAccess()) {
            throw new SimpleError({
                code: "permission_denied",
                message: "Je moet hoofdbeheerder zijn om mollie te kunnen ontkoppelen"
            })
        }

        const mollieToken = await MollieToken.getTokenFor(user.organization.id)
        await mollieToken?.revoke();
        user.organization.privateMeta.mollieOnboarding = null;
        user.organization.privateMeta.mollieProfile = null;

        await user.organization.save()

        // TODO: disable all payment methods that use this method
        
        return new Response(await user.getOrganizationStructure());
    }
}
