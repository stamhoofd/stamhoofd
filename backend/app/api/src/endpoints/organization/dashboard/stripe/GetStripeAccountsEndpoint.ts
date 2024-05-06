
import { DecodedRequest, Endpoint, Request, Response } from '@simonbackx/simple-endpoints';
import { StripeAccount } from '@stamhoofd/models';
import { PermissionLevel, StripeAccount as StripeAccountStruct } from '@stamhoofd/structures';

import { Context } from '../../../../helpers/Context';

type Params = Record<string, never>;
type Body = undefined;
type Query = undefined
type ResponseBody = StripeAccountStruct[]

export class GetStripeAccountLinkEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {    
    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method != "GET") {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, "/stripe/accounts", {});

        if (params) {
            return [true, params as Params];
        }

        return [false];
    }

    async handle(_: DecodedRequest<Params, Query, Body>) {
        const organization = await Context.setOrganizationScope();
        await Context.authenticate()

        // Fast throw first (more in depth checking for patches later)
        if (!await Context.auth.canManagePaymentAccounts(organization.id, PermissionLevel.Read)) {
            throw Context.auth.error()
        }

        const models = await StripeAccount.where({ organizationId: organization.id, status: 'active' })
        return new Response(models.map(m => StripeAccountStruct.create(m)));
    }
}
