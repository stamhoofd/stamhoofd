import { DecodedRequest, Endpoint, Request, Response } from '@simonbackx/simple-endpoints';
import { CachedBalance, Organization } from '@stamhoofd/models';
import { PayableBalance, PayableBalanceCollection, ReceivableBalanceType } from '@stamhoofd/structures';

import { Formatter } from '@stamhoofd/utility';
import { AuthenticatedStructures } from '../../../helpers/AuthenticatedStructures.js';
import { Context } from '../../../helpers/Context.js';

type Params = Record<string, never>;
type Query = undefined;
type Body = undefined;
type ResponseBody = PayableBalanceCollection;

export class GetUserPayableBalanceEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method !== 'GET') {
            return [false];
        }

        const params = request.getVersion() >= 339
            ? Endpoint.parseParameters(request.url, '/user/payable-balance', {})
            : Endpoint.parseParameters(request.url, '/user/billing/status', {});

        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    async handle(_: DecodedRequest<Params, Query, Body>) {
        const organization = await Context.setUserOrganizationScope();
        const { user } = await Context.authenticate();

        return new Response(await GetUserPayableBalanceEndpoint.getBillingStatusForObjects([user.id], organization, ReceivableBalanceType.user));
    }

    static async getBillingStatusForObjects(objectIds: string[], organization: Organization | null, objectType: ReceivableBalanceType) {
        // Load cached balances
        const receivableBalances = await CachedBalance.getForObjects(objectIds, organization?.id, objectType);

        const organizationIds = Formatter.uniqueArray(receivableBalances.map(b => b.organizationId));

        let addOrganization = false;
        const i = organization ? organizationIds.indexOf(organization.id) : -1;
        if (i !== -1) {
            organizationIds.splice(i, 1);
            addOrganization = true;
        }

        const organizations = await Organization.getByIDs(...organizationIds);

        if (addOrganization && organization) {
            organizations.push(organization);
        }

        const authenticatedOrganizations = await AuthenticatedStructures.organizations(organizations);

        const billingStatus = PayableBalanceCollection.create({});

        for (const organization of authenticatedOrganizations) {
            const items = receivableBalances.filter(b => b.organizationId === organization.id);

            let amountOpen = 0;
            let amountPending = 0;
            let amountPaid = 0;

            for (const item of items) {
                amountOpen += item.amountOpen;
                amountPending += item.amountPending;
                amountPaid += item.amountPaid;
            }

            billingStatus.organizations.push(PayableBalance.create({
                organization,
                amountOpen,
                amountPending,
                amountPaid,
            }));
        }

        return billingStatus;
    }
}
