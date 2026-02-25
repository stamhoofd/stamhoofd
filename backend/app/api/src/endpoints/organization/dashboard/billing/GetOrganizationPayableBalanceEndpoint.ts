import { DecodedRequest, Endpoint, Request, Response } from '@simonbackx/simple-endpoints';
import { PayableBalanceCollection, ReceivableBalanceType } from '@stamhoofd/structures';

import { Context } from '../../../../helpers/Context.js';
import { GetUserPayableBalanceEndpoint } from '../../../global/registration/GetUserPayableBalanceEndpoint.js';

type Params = Record<string, never>;
type Query = undefined;
type ResponseBody = PayableBalanceCollection;
type Body = undefined;

export class GetOrganizationPayableBalanceEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method !== 'GET') {
            return [false];
        }

        const params = request.getVersion() >= 339
            ? Endpoint.parseParameters(request.url, '/organization/payable-balance', {})
            : Endpoint.parseParameters(request.url, '/organization/billing/status', {});

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

        return new Response(await GetUserPayableBalanceEndpoint.getBillingStatusForObjects([organization.id], null, ReceivableBalanceType.organization));
    }
}
