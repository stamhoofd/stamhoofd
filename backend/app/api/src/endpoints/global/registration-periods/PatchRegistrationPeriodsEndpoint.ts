import { ConvertArrayToPatchableArray, Decoder, PatchableArrayAutoEncoder, PatchableArrayDecoder, StringDecoder, patchObject } from '@simonbackx/simple-encoding';
import { DecodedRequest, Endpoint, Request, Response } from "@simonbackx/simple-endpoints";
import { RegistrationPeriod as RegistrationPeriodStruct } from "@stamhoofd/structures";

import { AuthenticatedStructures } from '../../../helpers/AuthenticatedStructures';
import { Context } from '../../../helpers/Context';
import { RegistrationPeriod } from '@stamhoofd/models';
import { SimpleError } from '@simonbackx/simple-errors';

type Params = Record<string, never>;
type Query = undefined;
type Body = PatchableArrayAutoEncoder<RegistrationPeriodStruct>
type ResponseBody = RegistrationPeriodStruct[]

/**
 * One endpoint to create, patch and delete members and their registrations and payments
 */

export class PatchRegistrationPeriodsEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    bodyDecoder = new PatchableArrayDecoder(RegistrationPeriodStruct as any, RegistrationPeriodStruct.patchType(), StringDecoder) as any as Decoder<ConvertArrayToPatchableArray<RegistrationPeriodStruct[]>>

    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method != "PATCH") {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, "/registration-periods", {});

        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    async handle(request: DecodedRequest<Params, Query, Body>) {
        const organization = await Context.setUserOrganizationScope();
        await Context.authenticate()

        // Fast throw first (more in depth checking for patches later)
        if (organization) {
            if (!await Context.auth.hasFullAccess(organization.id)) {
                throw Context.auth.error()
            } 
        } else {
            if (!Context.auth.hasPlatformFullAccess()) {
                throw Context.auth.error()
            } 
        }

        const periods: RegistrationPeriod[] = [];

        for (const {put} of request.body.getPuts()) {
            const period = new RegistrationPeriod();
            period.id = put.id;
            period.startDate = put.startDate;
            period.endDate = put.endDate;
            period.locked = put.locked;
            period.settings = put.settings;
            period.organizationId = organization?.id ?? null;

            await period.save();
            periods.push(period);
        }

        for (const patch of request.body.getPatches()) {
            const model = await RegistrationPeriod.getByID(patch.id);

            if (!model || model.organizationId !== (organization?.id ?? null)) {
                throw new SimpleError({
                    code: "not_found",
                    statusCode: 404,
                    message: "Registration period not found",
                });
            }

            if (patch.startDate !== undefined) {
                model.startDate = patch.startDate;
            }

            if (patch.endDate !== undefined) {
                model.endDate = patch.endDate;
            }

            if (patch.locked !== undefined) {
                model.locked = patch.locked;
            }

            if (patch.settings !== undefined) {
                model.settings = patchObject(model.settings, patch.settings);
            }

            await model.save();
        }

        for (const id of request.body.getDeletes()) {
            const model = await RegistrationPeriod.getByID(id);

            if (!model || model.organizationId !== (organization?.id ?? null)) {
                throw new SimpleError({
                    code: "not_found",
                    statusCode: 404,
                    message: "Registration period not found",
                });
            }

            await model.delete();
        }

        return new Response(
            periods.map(p => p.getStructure())
        );
    }

}
