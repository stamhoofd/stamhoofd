import { DecodedRequest, Endpoint, Request, Response } from "@simonbackx/simple-endpoints";
import { Organization as OrganizationStruct } from "@stamhoofd/structures";

import { Token } from '../models/Token';
type Params = {};
type Query = undefined;
type Body = undefined
type ResponseBody = OrganizationStruct;

/**
 * One endpoint to create, patch and delete groups. Usefull because on organization setup, we need to create multiple groups at once. Also, sometimes we need to link values and update multiple groups at once
 */

export class GetOrganizationEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method != "GET") {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, "/organization", {});

        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    async handle(request: DecodedRequest<Params, Query, Body>) {
        const token = await Token.authenticate(request);
        const user = token.user
        return new Response(await user.organization.getStructure());
    }
}
