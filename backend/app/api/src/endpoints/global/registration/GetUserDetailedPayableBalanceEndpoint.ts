import { DecodedRequest, Endpoint, Request, Response } from '@simonbackx/simple-endpoints';
import { BalanceItem, Member, Organization, Payment } from '@stamhoofd/models';
import { DetailedPayableBalanceCollection, DetailedPayableBalance } from '@stamhoofd/structures';

import { Formatter } from '@stamhoofd/utility';
import { AuthenticatedStructures } from '../../../helpers/AuthenticatedStructures.js';
import { Context } from '../../../helpers/Context.js';

type Params = Record<string, never>;
type Query = undefined;
type Body = undefined;
type ResponseBody = DetailedPayableBalanceCollection;

export class GetUserDetailedPayableBalanceEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method !== 'GET') {
            return [false];
        }

        const params = request.getVersion() >= 339
            ? Endpoint.parseParameters(request.url, '/user/payable-balance/detailed', {})
            : Endpoint.parseParameters(request.url, '/user/billing/status/detailed', {});

        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    async handle(_: DecodedRequest<Params, Query, Body>) {
        const organization = await Context.setUserOrganizationScope();
        const { user } = await Context.authenticate();

        const memberIds = await Member.getMemberIdsForUser(user);

        const balanceItemModels = await BalanceItem.balanceItemsForUsersAndMembers(organization?.id ?? null, [user.id], memberIds);

        // todo: this is a duplicate query
        const { payments, balanceItemPayments } = await BalanceItem.loadPayments(balanceItemModels);

        return new Response(await GetUserDetailedPayableBalanceEndpoint.getDetailedBillingStatus(balanceItemModels, payments));
    }

    static async getDetailedBillingStatus(balanceItemModels: BalanceItem[], paymentModels: Payment[]) {
        const organizationIds = Formatter.uniqueArray([
            ...balanceItemModels.map(b => b.organizationId),
            ...paymentModels.map(p => p.organizationId).filter(p => p !== null),
        ]);

        // Group by organization you'll have to pay to
        if (organizationIds.length === 0) {
            return DetailedPayableBalanceCollection.create({});
        }

        // Optimization: prevent fetching the organization we already have
        const organization = Context.organization;

        let addOrganization = false;
        const i = organization ? organizationIds.indexOf(organization.id) : -1;
        if (i !== -1) {
            organizationIds.splice(i, 1);
            addOrganization = true;
        }

        const organizationModels = await Organization.getByIDs(...organizationIds);

        if (addOrganization && organization) {
            organizationModels.push(organization);
        }

        const balanceItems = await BalanceItem.getStructureWithPayments(balanceItemModels);
        const organizations = await AuthenticatedStructures.organizations(organizationModels);
        const payments = await AuthenticatedStructures.paymentsGeneral(paymentModels, false);

        return DetailedPayableBalanceCollection.create({
            organizations: organizations.map((o) => {
                return DetailedPayableBalance.create({
                    organization: o,
                    balanceItems: balanceItems.filter(b => b.organizationId == o.id),
                    payments: payments.filter(p => p.organizationId === o.id),
                });
            }),
        });
    }
}
