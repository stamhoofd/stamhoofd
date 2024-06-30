import { DecodedRequest, Endpoint, Request, Response } from "@simonbackx/simple-endpoints";
import { RegistrationPeriod as RegistrationPeriodStruct } from "@stamhoofd/structures";

import { RegistrationPeriod } from '@stamhoofd/models';

type Params = Record<string, never>;
type Query = undefined;
type Body = undefined
type ResponseBody = RegistrationPeriodStruct[]

/**
 * One endpoint to create, patch and delete members and their registrations and payments
 */

export class PatchRegistrationPeriodsEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method != "GET") {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, "/registration-periods", {});

        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    async handle(request: DecodedRequest<Params, Query, Body>) {
        const periods = await RegistrationPeriod.all()

        return new Response(
            periods.map(p => p.getStructure())
        );
    }

}
