import { DecodedRequest, Endpoint, Request, Response } from '@simonbackx/simple-endpoints';
import { OrganizationDetailedBillingStatus, PaymentStatus } from '@stamhoofd/structures';

import { BalanceItem, Payment } from '@stamhoofd/models';
import { SQL } from '@stamhoofd/sql';
import { Context } from '../../../../helpers/Context';
import { GetUserDetailedBilingStatusEndpoint } from '../../../global/registration/GetUserDetailedBillingStatusEndpoint';

type Params = Record<string, never>;
type Query = undefined;
type ResponseBody = OrganizationDetailedBillingStatus;
type Body = undefined;

export class GetOrganizationDetailedBillingStatusEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method !== 'GET') {
            return [false];
        }

        if (request.getVersion() <= 334) {
            // Deprecated
            const params = Endpoint.parseParameters(request.url, '/billing/status/detailed', {});

            if (params) {
                return [true, params as Params];
            }
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, '/organization/billing/status/detailed', {});

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

        const balanceItemModels = await BalanceItem.balanceItemsForOrganization(organization.id);

        const paymentModels = await Payment.select()
            .where('payingOrganizationId', organization.id)
            .andWhere(
                SQL.whereNot('status', PaymentStatus.Failed),
            )
            .fetch();

        return new Response(await GetUserDetailedBilingStatusEndpoint.getDetailedBillingStatus(balanceItemModels, paymentModels));
    }
}
