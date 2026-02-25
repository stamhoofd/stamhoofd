import { DecodedRequest, Endpoint, Request, Response } from '@simonbackx/simple-endpoints';
import { OrganizationRegistrationPeriod as OrganizationRegistrationPeriodStruct, SetupStepType } from '@stamhoofd/structures';

import { AutoEncoder, BooleanDecoder, Decoder, EnumDecoder, field } from '@simonbackx/simple-encoding';
import { SimpleError } from '@simonbackx/simple-errors';
import { OrganizationRegistrationPeriod } from '@stamhoofd/models';
import { AuthenticatedStructures } from '../../../../helpers/AuthenticatedStructures.js';
import { Context } from '../../../../helpers/Context.js';

type Params = { readonly id: string };
type Query = undefined;

class Body extends AutoEncoder {
    @field({ decoder: new EnumDecoder(SetupStepType) })
    type: SetupStepType;

    @field({ decoder: BooleanDecoder })
    isReviewed: boolean;
}

type ResponseBody = OrganizationRegistrationPeriodStruct;

/**
 * Endpoint to mark a setup step as reviewed
 */

export class SetupStepReviewEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    bodyDecoder = Body as Decoder<Body>;

    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method !== 'POST') {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, '/organization/registration-period/@id/setup-steps/review', { id: String });

        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    async handle(request: DecodedRequest<Params, Query, Body>) {
        const organization = await Context.setOrganizationScope();
        const { user } = await Context.authenticate();

        if (!await Context.auth.hasFullAccess(organization.id)) {
            throw Context.auth.error();
        }

        const periodId = request.params.id;
        const stepType = request.body.type;
        const isReviewed = request.body.isReviewed;

        const organizationPeriod = await OrganizationRegistrationPeriod.getByID(periodId);
        if (!organizationPeriod || organizationPeriod.organizationId !== organization.id) {
            throw new SimpleError({
                code: 'not_found',
                message: 'Period not found',
                statusCode: 404,
            });
        }

        const setupSteps = organizationPeriod.setupSteps;

        if (isReviewed) {
            setupSteps.markReviewed(stepType, {
                userId: user.id,
                userName: user.name ?? '?',
            });
        }
        else {
            setupSteps.resetReviewed(stepType);
        }

        await organizationPeriod.save();

        return new Response(
            await AuthenticatedStructures.organizationRegistrationPeriod(organizationPeriod),
        );
    }
}
