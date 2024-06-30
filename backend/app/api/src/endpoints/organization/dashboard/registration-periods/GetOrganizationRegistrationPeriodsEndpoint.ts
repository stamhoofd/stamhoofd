import { DecodedRequest, Endpoint, Request, Response } from "@simonbackx/simple-endpoints";
import { RegistrationPeriodList, OrganizationRegistrationPeriod as OrganizationRegistrationPeriodStruct } from "@stamhoofd/structures";

import { Group, OrganizationRegistrationPeriod, RegistrationPeriod } from '@stamhoofd/models';
import { Context } from "../../../../helpers/Context";
import { Sorter } from "@stamhoofd/utility";

type Params = Record<string, never>;
type Query = undefined;
type Body = undefined
type ResponseBody = RegistrationPeriodList

/**
 * One endpoint to create, patch and delete members and their registrations and payments
 */

export class PatchRegistrationPeriodsEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method != "GET") {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, "/organization/registration-periods", {});

        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    async handle(request: DecodedRequest<Params, Query, Body>) {
        const organization = await Context.setOrganizationScope();
        await Context.authenticate()

        if (!await Context.auth.hasSomeAccess(organization.id)) {
            throw Context.auth.error()
        } 
        
        const organizationPeriods = await OrganizationRegistrationPeriod.where({ organizationId: organization.id });
        const periods = await RegistrationPeriod.all();
        const groups = await Group.getAll(organization.id, null)

        const structs: OrganizationRegistrationPeriodStruct[] = [];

        for (const period of periods) {
            const organizationPeriod = organizationPeriods.find(p => p.periodId == period.id);
            if (!organizationPeriod) {
                continue;
            }

            const gs = groups.filter(g => g.periodId === period.id);
            structs.push(organizationPeriod.getStructure(period, gs));
        }

        // Sort
        periods.sort((a, b) => Sorter.byDateValue(a.startDate, b.startDate))

        return new Response(
            RegistrationPeriodList.create({
                organizationPeriods: structs,
                periods: periods.map(p => p.getStructure())
            })
        );
    }

}
