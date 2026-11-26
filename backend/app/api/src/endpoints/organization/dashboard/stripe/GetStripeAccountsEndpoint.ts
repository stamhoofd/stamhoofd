import type { DecodedRequest, Request } from '@node/endpoints';
import { Endpoint, Response } from '@node/endpoints';
import { StripeAccount } from '@stamhoofd/models';
import { PermissionLevel } from '@stamhoofd/types/PermissionLevel';
import type { StripeAccount as StripeAccountStruct } from '@stamhoofd/structures';

import { Context } from '../../../../helpers/Context.js';

type Params = Record<string, never>;
type Body = undefined;
type Query = undefined;
type ResponseBody = StripeAccountStruct[];

export class GetStripeAccountLinkEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method !== 'GET') {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, '/stripe/accounts', {});

        if (params) {
            return [true, params as Params];
        }

        return [false];
    }

    async handle(_: DecodedRequest<Params, Query, Body>) {
        const organization = await Context.setOrganizationScope();
        await Context.authenticate();

        // Fast throw first (more in depth checking for patches later)
        if (!(await Context.auth.canManagePaymentAccounts(organization.id, PermissionLevel.Read))) {
            throw Context.auth.error();
        }

        const models = await StripeAccount.where({
            organizationId: organization.id,
            status: 'active',
        });
        const includeBlob = Context.auth.isStamhoofdStaff();
        return new Response(models.map((m) => m.getStructure({ includeBlob })));
    }
}
