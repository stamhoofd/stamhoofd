import { DecodedRequest, Endpoint, Request, Response } from "@simonbackx/simple-endpoints";
import { OrganizationDetailedBillingStatus, OrganizationDetailedBillingStatusItem, PaymentStatus } from "@stamhoofd/structures";

import { BalanceItem, Organization, Payment } from "@stamhoofd/models";
import { SQL } from "@stamhoofd/sql";
import { Formatter } from "@stamhoofd/utility";
import { AuthenticatedStructures } from "../../../../helpers/AuthenticatedStructures";
import { Context } from "../../../../helpers/Context";

type Params = Record<string, never>;
type Query = undefined;
type ResponseBody = OrganizationDetailedBillingStatus;
type Body = undefined;

export class GetDetailedBillingStatusEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method != "GET") {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, "/billing/status/detailed", {});

        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    async handle(_: DecodedRequest<Params, Query, Body>) {
        const organization = await Context.setOrganizationScope();
        await Context.authenticate()

        // If the user has permission, we'll also search if he has access to the organization's key
        if (!await Context.auth.canManageFinances(organization.id)) {
            throw Context.auth.error()
        }
        
        const balanceItemModels = await BalanceItem.balanceItemsForOrganization(organization.id);

        const paymentModels = await Payment.select()
            .where('payingOrganizationId', organization.id)
            .andWhere(
                SQL.whereNot('status', PaymentStatus.Failed)
            )
            .fetch()

        const organizationIds = Formatter.uniqueArray([
            ...balanceItemModels.map(b => b.organizationId),
            ...paymentModels.map(p => p.organizationId).filter(p => p !== null)
        ])
        
        // Group by organization you'll have to pay to
        if (organizationIds.length === 0) {
            return new Response(
                OrganizationDetailedBillingStatus.create({})
            )
        }

        const balanceItems = await BalanceItem.getStructureWithPayments(balanceItemModels)
        const organizationModels = await Organization.getByIDs(...organizationIds)
        const organizations = await AuthenticatedStructures.organizations(organizationModels)
        const payments = await AuthenticatedStructures.paymentsGeneral(paymentModels, false)

        return new Response(
            OrganizationDetailedBillingStatus.create({
                organizations: organizations.map(o => {
                    return OrganizationDetailedBillingStatusItem.create({
                        organization: o,
                        balanceItems: balanceItems.filter(b => b.organizationId == o.id),
                        payments: payments.filter(p => p.organizationId === o.id)
                    })
                })
            })
        )
    }
}
