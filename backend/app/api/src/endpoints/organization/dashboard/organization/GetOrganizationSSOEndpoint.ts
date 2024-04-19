import { DecodedRequest, Endpoint, Request, Response } from "@simonbackx/simple-endpoints";
import { OpenIDClientConfiguration } from "@stamhoofd/structures";

import { Context } from "../../../../helpers/Context";

type Params = Record<string, never>;
type Query = undefined;
type Body = undefined;
type ResponseBody = OpenIDClientConfiguration

/**
 * One endpoint to create, patch and delete groups. Usefull because on organization setup, we need to create multiple groups at once. Also, sometimes we need to link values and update multiple groups at once
 */

export class GetOrganizationSSOEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method != "GET") {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, "/organization/sso", {});

        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    async handle(_: DecodedRequest<Params, Query, Body>) {
        const organization = await Context.setOrganizationScope();
        await Context.authenticate()

        if (!Context.auth.canManageSSOSettings()) {
            throw Context.auth.error()
        }
        
        return new Response(organization.serverMeta.ssoConfiguration ?? OpenIDClientConfiguration.create({
            clientId: "",
            clientSecret: "",
            issuer: ""
        }));
    }
}
