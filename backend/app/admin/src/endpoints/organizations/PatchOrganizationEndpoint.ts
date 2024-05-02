import { AutoEncoderPatchType, Decoder } from '@simonbackx/simple-encoding';
import { DecodedRequest, Endpoint, Request, Response } from '@simonbackx/simple-endpoints';
import { SimpleError } from '@simonbackx/simple-errors';
import { Organization, STCredit, STInvoice, STPackage, User } from '@stamhoofd/models';
import { OrganizationStats, OrganizationSummary, PermissionLevel, Permissions, User as UserStruct } from '@stamhoofd/structures';

import { AdminToken } from '../../models/AdminToken';
import { Statistic } from '../../models/Statistic';

type Params = { id: string};
type Query = undefined;
type Body = AutoEncoderPatchType<OrganizationSummary>;
type ResponseBody = OrganizationSummary;

export class PatchOrganizationEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    bodyDecoder = OrganizationSummary.patchType() as Decoder<AutoEncoderPatchType<OrganizationSummary>>

    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method != "PATCH") {
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

        const packages = await STPackage.getForOrganization(organization.id)
        let updatePackages = false

        const credits = await STCredit.getForOrganization(organization.id)

        if (request.body.meta) {
            organization.meta.patchOrPut(request.body.meta)
        }

        if (request.body.mollieCustomerId === null) {
            // Unlink
            organization.serverMeta.mollieCustomerId = undefined
        }
        await organization.save()

        // Check package patches
        if (request.body.billingStatus && request.body.billingStatus.isPatch()) {
            for (const patch of request.body.billingStatus.packages.getPatches()) {
                const pack = packages.find(p => p.id === patch.id)
                if (!pack) {
                    throw new SimpleError({
                        code: "not_found",
                        message: "Package not found with id "+patch.id
                    })
                }

                if (patch.meta !== undefined) {
                    pack.meta.patchOrPut(patch.meta)
                }

                if (patch.validUntil !== undefined) {
                    pack.validUntil = patch.validUntil
                }

                if (patch.removeAt !== undefined) {
                    pack.removeAt = patch.removeAt
                }

                await pack.save()
                updatePackages = true
            }

            for (const put of request.body.billingStatus.packages.getPuts()) {
                const pack = new STPackage()
                pack.validAt = new Date()
                pack.organizationId = organization.id

                pack.meta = put.put.meta
                pack.validUntil = put.put.validUntil
                pack.removeAt = put.put.removeAt

                await pack.save()
                updatePackages = true
            }

            for (const id of request.body.billingStatus.packages.getDeletes()) {
                const pack = packages.find(p => p.id === id)
                if (!pack) {
                    throw new SimpleError({
                        code: "not_found",
                        message: "Package not found with id "+id
                    })
                }

                pack.removeAt = new Date()
                pack.removeAt.setTime(pack.removeAt.getTime() - 1000)
                pack.validUntil = pack.removeAt
                await pack.save()
                updatePackages = true
            }

            // Credits
            for (const patch of request.body.billingStatus.credits.getPatches()) {
                const credit = credits.find(p => p.id === patch.id)
                if (!credit) {
                    throw new SimpleError({
                        code: "not_found",
                        message: "Credit not found with id "+patch.id
                    })
                }

                credit.description = patch.description ?? credit.description
                credit.change = patch.change ?? credit.change
                credit.allowTransactions = patch.allowTransactions ?? credit.allowTransactions

                if (patch.expireAt !== undefined) {
                    credit.expireAt = patch.expireAt
                }

                await credit.save()
            }

            for (const put of request.body.billingStatus.credits.getPuts()) {
                const credit = new STCredit()
                credit.organizationId = organization.id

                credit.description = put.put.description
                credit.change = put.put.change
                credit.expireAt = put.put.expireAt
                credit.allowTransactions = put.put.allowTransactions

                await credit.save()
            }

            for (const id of request.body.billingStatus.credits.getDeletes()) {
                const credit = credits.find(p => p.id === id)
                if (!credit) {
                    throw new SimpleError({
                        code: "not_found",
                        message: "Credit not found with id "+id
                    })
                }

                await credit.delete()
            }

        }
       
        if (updatePackages) {
            await STPackage.updateOrganizationPackages(organization.id)
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

        return new Response(OrganizationSummary.create({
            ...structure,
            billingStatus,
            admins: admins.map(a => UserStruct.create({...a, hasAccount: a.hasAccount()})),
            createdAt: organization.createdAt,
            lastActiveAt: await Statistic.getLastActiveDate(organization.id),
            stats: OrganizationStats.create(stats[0] ?? new Statistic()),
            acquisitionTypes: organization.privateMeta.acquisitionTypes
        }));      
    }
}
