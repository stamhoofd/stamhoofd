import { DecodedRequest, Endpoint, Request, Response } from "@simonbackx/simple-endpoints";
import { OrganizationBillingStatus } from "@stamhoofd/structures";

import { Context } from "../../../../helpers/Context";
import { GetUserBilingStatusEndpoint } from "../../../global/registration/GetUserBillingStatusEndpoint";

type Params = Record<string, never>;
type Query = undefined;
type ResponseBody = OrganizationBillingStatus;
type Body = undefined;

export class GetDetailedBillingStatusEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method != "GET") {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, "/organization/billing/status", {});

        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    async handle(_: DecodedRequest<Params, Query, Body>) {
        const organization = await Context.setOrganizationScope();
        await Context.authenticate()

        // If the user has permission, we'll also search if he has access to the organization's key
        if (!await Context.auth.canManageFinances(organization.id)) {
            throw Context.auth.error()
        }
        
        return new Response(await GetUserBilingStatusEndpoint.getBillingStatusForObjects([organization.id], null));
    }
}
