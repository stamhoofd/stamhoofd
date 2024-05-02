import { createMollieClient } from '@mollie/api-client';
import { DecodedRequest, Endpoint, Request, Response } from '@simonbackx/simple-endpoints';
import { SimpleError } from '@simonbackx/simple-errors';
import { Organization, STInvoice, User } from '@stamhoofd/models';
import { OrganizationPaymentMandate, OrganizationPaymentMandateDetails, OrganizationStats, OrganizationSummary, PermissionLevel, Permissions, User as UserStruct } from '@stamhoofd/structures';

import { AdminToken } from '../../models/AdminToken';
import { Statistic } from '../../models/Statistic';

type Params = { id: string};
type Query = undefined;
type Body = undefined;
type ResponseBody = OrganizationSummary;

export class GetOrganizationEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {

    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method != "GET") {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, "/organizations/@id", { id: String });

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

        // Poll mollie status
        // Mollie payment is required
        const mandates: OrganizationPaymentMandate[] = []

        try {
            const apiKey = STAMHOOFD.MOLLIE_API_KEY
            if (!apiKey) {
                throw new SimpleError({
                    code: "",
                    message: "Mollie niet correct gekoppeld"
                })
            }
            
            const mollieClient = createMollieClient({ apiKey });

            if (organization.serverMeta.mollieCustomerId) {
                const m = await mollieClient.customers_mandates.list({ customerId: organization.serverMeta.mollieCustomerId, limit: 250 })
                for (const mandate of m) {
                    try {
                        const details = mandate.details as any
                        mandates.push(OrganizationPaymentMandate.create({
                            ...mandate,
                            createdAt: new Date(mandate.createdAt),
                            details: OrganizationPaymentMandateDetails.create({
                                consumerName: details.consumerName ?? undefined,
                                consumerAccount: details.consumerAccount ?? undefined,
                                consumerBic: details.consumerBic ?? undefined,
                            })
                        }))
                    } catch (e) {
                        console.error(e)
                    }
                }
            }
        } catch (e) {
            console.error(e)
        }

        const features = [
            ...(await organization.getConnectedPaymentProviders()).map(p => p.toString()),
        ];

        return new Response(OrganizationSummary.create({ 
            ...structure, 
            billingStatus,
            admins: admins.map(a => UserStruct.create({...a, hasAccount: a.hasAccount()})),
            createdAt: organization.createdAt,
            lastActiveAt: await Statistic.getLastActiveDate(organization.id),
            stats: OrganizationStats.create(stats[0] ?? new Statistic()),
            acquisitionTypes: organization.privateMeta.acquisitionTypes,
            mollieCustomerId: organization.serverMeta.mollieCustomerId ?? null,
            paymentMandates: mandates,
            features
        }));      
    }
}
