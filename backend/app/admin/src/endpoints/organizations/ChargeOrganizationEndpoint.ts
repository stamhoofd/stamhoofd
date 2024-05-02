import { DecodedRequest, Endpoint, Request, Response } from '@simonbackx/simple-endpoints';
import { SimpleError } from '@simonbackx/simple-errors';
import { Organization, STInvoice, STPackage, STPendingInvoice, User } from '@stamhoofd/models';
import { OrganizationStats, OrganizationSummary, PermissionLevel, Permissions, User as UserStruct } from '@stamhoofd/structures';

import { AdminToken } from '../../models/AdminToken';
import { Statistic } from '../../models/Statistic';

type Params = { id: string};
type Query = undefined;
type Body = undefined;
type ResponseBody = OrganizationSummary;

export class PatchOrganizationEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method != "POST") {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, "/organizations/@id/charge", { id: String });

        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    async handle(request: DecodedRequest<Params, Query, Body>) {
        await AdminToken.authenticate(request);
       
        const organization = await Organization.getByID(request.params.id)
        if (!organization) {
            throw new SimpleError({
                code: "not_found",
                message: "Organization not found",
                statusCode: 404
            })
        }

        // Charge here
        await STPendingInvoice.addAutomaticItems(organization)
        await STPendingInvoice.charge(organization)

        await STPackage.updateOrganizationPackages(organization.id)
        const structure = await organization.getStructure({emptyGroups: true})
        const billingStatus = await STInvoice.getBillingStatus(organization, false)

        // Get all admins
        const admins = await User.getAdmins([organization.id]) 

        // Stats
        const start = new Date()
        start.setDate(start.getDate() - 60)

        const end = new Date()
        end.setDate(end.getDate() + 1)
        const stats = await Statistic.buildTimeAggregation([organization.id], start, end)

        return new Response(OrganizationSummary.create(Object.assign({}, structure, {
            billingStatus,
            admins: admins.map(a => UserStruct.create({...a, hasAccount: a.hasAccount()})),
            createdAt: organization.createdAt,
            lastActiveAt: await Statistic.getLastActiveDate(organization.id),
            stats: OrganizationStats.create(stats[0] ?? new Statistic()),
            acquisitionTypes: organization.privateMeta.acquisitionTypes
        })));      
    }
}
