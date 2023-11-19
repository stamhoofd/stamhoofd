import { AutoEncoder, Decoder,field, StringDecoder } from '@simonbackx/simple-encoding';
import { DecodedRequest, Endpoint, Request, Response } from '@simonbackx/simple-endpoints'
import { SimpleError } from '@simonbackx/simple-errors'
import { MollieToken } from '@stamhoofd/models';
import { Token } from '@stamhoofd/models';
import { CheckMollieResponse, Organization as OrganizationStruct  } from "@stamhoofd/structures";

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
        const token = await Token.authenticate(request);
        const user = token.user

        if (!user.permissions || !user.permissions.hasFullAccess()) {
            throw new SimpleError({
                code: "permission_denied",
                message: "Je moet hoofdbeheerder zijn om mollie te kunnen connecteren"
            })
        }

        const mollie = await MollieToken.getTokenFor(user.organizationId)

        if (!mollie) {
            const organization = user.organization
            organization.privateMeta.mollieOnboarding = null
            organization.privateMeta.mollieProfile = null
            await organization.save()

            if (request.request.getVersion() < 200) {
                return new Response(await user.getOrganizatonStructure(organization));
            }

            return new Response(CheckMollieResponse.create({
                organization: await user.getOrganizatonStructure(organization),
                profiles: []
            }));
        }
        const profiles = await mollie.getProfiles();

        const status = await mollie.getOnboardingStatus();
        const organization = user.organization
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
            return new Response(await user.getOrganizatonStructure(organization));
        }

        return new Response(CheckMollieResponse.create({
            organization: await user.getOrganizatonStructure(organization),
            profiles
        }));
    }
}
