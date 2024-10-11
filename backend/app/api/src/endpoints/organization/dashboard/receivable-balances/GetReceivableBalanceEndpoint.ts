import { DecodedRequest, Endpoint, Request, Response } from '@simonbackx/simple-endpoints';
import { PayableBalanceCollection } from '@stamhoofd/structures';

import { Context } from '../../../../helpers/Context';
import { GetUserPayableBalanceEndpoint } from '../../../global/registration/GetUserPayableBalanceEndpoint';

type Params = { id: string; type: string };
type Query = undefined;
type ResponseBody = PayableBalanceCollection;
type Body = undefined;

export class GetReceivableBalanceEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method !== 'GET') {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, '/receivable-balances/@type/@id', {
            type: String,
            id: String,
        });

        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    async handle(_: DecodedRequest<Params, Query, Body>) {
        const organization = await Context.setOrganizationScope();
        await Context.authenticate();

        // If the user has permission, we'll also search if he has access to the organization's key
        if (!await Context.auth.canManageFinances(organization.id)) {
            throw Context.auth.error();
        }

        return new Response(await GetUserPayableBalanceEndpoint.getBillingStatusForObjects([organization.id], null));
    }
}
