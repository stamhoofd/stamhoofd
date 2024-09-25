import { DecodedRequest, Endpoint, Request, Response } from '@simonbackx/simple-endpoints';
import { CachedOutstandingBalance, Member, Organization } from '@stamhoofd/models';
import { OrganizationBillingStatus, OrganizationBillingStatusItem } from '@stamhoofd/structures';

import { Formatter } from '@stamhoofd/utility';
import { AuthenticatedStructures } from '../../../helpers/AuthenticatedStructures';
import { Context } from '../../../helpers/Context';

type Params = Record<string, never>;
type Query = undefined;
type Body = undefined;
type ResponseBody = OrganizationBillingStatus;

export class GetUserBilingStatusEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method !== 'GET') {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, '/user/billing/status', {});

        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    async handle(_: DecodedRequest<Params, Query, Body>) {
        const organization = await Context.setUserOrganizationScope();
        const { user } = await Context.authenticate();

        const memberIds = await Member.getMemberIdsWithRegistrationForUser(user);

        return new Response(await GetUserBilingStatusEndpoint.getBillingStatusForObjects([user.id, ...memberIds], organization));
    }

    static async getBillingStatusForObjects(objectIds: string[], organization?: Organization | null) {
        // Load cached balances
        const cachedOutstandingBalances = await CachedOutstandingBalance.getForObjects(objectIds, organization?.id);

        const organizationIds = Formatter.uniqueArray(cachedOutstandingBalances.map(b => b.organizationId));

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

        const billingStatus = OrganizationBillingStatus.create({});

        for (const organization of authenticatedOrganizations) {
            const items = cachedOutstandingBalances.filter(b => b.organizationId === organization.id);

            let amount = 0;
            let amountPending = 0;

            for (const item of items) {
                amount += item.amount;
                amountPending += item.amountPending;
            }

            billingStatus.organizations.push(OrganizationBillingStatusItem.create({
                organization,
                amount,
                amountPending,
            }));
        }

        return billingStatus;
    }
}
