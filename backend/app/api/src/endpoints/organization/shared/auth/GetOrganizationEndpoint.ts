import { DecodedRequest, Endpoint, Request, Response } from "@simonbackx/simple-endpoints";
import { Organization as OrganizationStruct } from "@stamhoofd/structures";

import { AuthenticatedStructures } from "../../../../helpers/AuthenticatedStructures";
import { Context } from "../../../../helpers/Context";

type Params = Record<string, never>;
type Query = undefined;
type Body = undefined
type ResponseBody = OrganizationStruct;

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

    async handle(_: DecodedRequest<Params, Query, Body>) {
        const organization = await Context.setOrganizationScope();
        await Context.optionalAuthenticate({allowWithoutAccount: true})

        return new Response(
            await AuthenticatedStructures.organization(organization)
        );
    }
}
