import { DecodedRequest, Endpoint, Request, Response } from '@simonbackx/simple-endpoints';
import { MollieToken } from '@stamhoofd/models';
import { CheckMollieResponse, Organization as OrganizationStruct, PermissionLevel } from "@stamhoofd/structures";

import { AuthenticatedStructures } from '../../../../helpers/AuthenticatedStructures';
import { Context } from '../../../../helpers/Context';

type Params = Record<string, never>;
type Body = undefined
type Query = undefined
type ResponseBody = OrganizationStruct|CheckMollieResponse

export class CheckMollieEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {    
    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method != "POST") {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, "/mollie/check", {});

        if (params) {
            return [true, params as Params];
        }

        return [false];
    }

    async handle(request: DecodedRequest<Params, Query, Body>) {
        const organization = await Context.setOrganizationScope();
        await Context.authenticate()

        // Fast throw first (more in depth checking for patches later)
        if (!Context.auth.canManagePaymentAccounts(PermissionLevel.Full)) {
            throw Context.auth.error()
        }

        const mollie = await MollieToken.getTokenFor(organization.id)

        if (!mollie) {
            organization.privateMeta.mollieOnboarding = null
            organization.privateMeta.mollieProfile = null
            await organization.save()

            if (request.request.getVersion() < 200) {
                return new Response(await AuthenticatedStructures.organization(organization));
            }

            return new Response(CheckMollieResponse.create({
                organization: await AuthenticatedStructures.organization(organization),
                profiles: []
            }));
        }
        const profiles = await mollie.getProfiles();

        const status = await mollie.getOnboardingStatus();
        organization.privateMeta.mollieOnboarding = status;

        // Check profile is still valid
        if (organization.privateMeta.mollieProfile) {
            const s = organization.privateMeta.mollieProfile.id
            const profile = profiles.find(p => p.id === s)
            if (!profile) {
                organization.privateMeta.mollieProfile = null
            } else {
                organization.privateMeta.mollieProfile = profile
            }
        }

        await organization.save()

        if (request.request.getVersion() < 200) {
            return new Response(await AuthenticatedStructures.organization(organization));
        }

        return new Response(CheckMollieResponse.create({
            organization: await AuthenticatedStructures.organization(organization),
            profiles
        }));
    }
}
