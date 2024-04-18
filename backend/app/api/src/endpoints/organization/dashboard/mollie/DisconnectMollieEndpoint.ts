
import { DecodedRequest, Endpoint, Request, Response } from '@simonbackx/simple-endpoints';
import { MollieToken } from '@stamhoofd/models';
import { Organization as OrganizationStruct, PermissionLevel } from "@stamhoofd/structures";

import { AuthenticatedStructures } from '../../../../helpers/AuthenticatedStructures';
import { Context } from '../../../../helpers/Context';

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

    async handle(_: DecodedRequest<Params, Query, Body>) {
        const organization = await Context.setOrganizationScope();
        await Context.authenticate()

        // Fast throw first (more in depth checking for patches later)
        if (!Context.auth.canManagePaymentAccounts(PermissionLevel.Full)) {
            throw Context.auth.error()
        }

        const mollieToken = await MollieToken.getTokenFor(organization.id)
        await mollieToken?.revoke();
        organization.privateMeta.mollieOnboarding = null;
        organization.privateMeta.mollieProfile = null;

        await organization.save()

        // TODO: disable all payment methods that use this method
        
        return new Response(await AuthenticatedStructures.organization(organization));
    }
}
