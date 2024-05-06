import { Decoder } from '@simonbackx/simple-encoding';
import { DecodedRequest, Endpoint, Request, Response } from "@simonbackx/simple-endpoints";
import { OpenIDClientConfiguration } from "@stamhoofd/structures";

import { Context } from '../../../../helpers/Context';
import { OpenIDConnectHelper } from '../../../../helpers/OpenIDConnectHelper';

type Params = Record<string, never>;
type Query = undefined;
type Body = OpenIDClientConfiguration;
type ResponseBody = OpenIDClientConfiguration

/**
 * One endpoint to create, patch and delete groups. Usefull because on organization setup, we need to create multiple groups at once. Also, sometimes we need to link values and update multiple groups at once
 */

export class SetOrganizationSSOEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    bodyDecoder = OpenIDClientConfiguration as Decoder<OpenIDClientConfiguration>

    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method != "POST") {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, "/organization/sso", {});

        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    async handle(request: DecodedRequest<Params, Query, Body>) {
        const organization = await Context.setOrganizationScope();
        await Context.authenticate()

        if (!await Context.auth.canManageSSOSettings(organization.id)) {
            throw Context.auth.error()
        }

        // Validate configuration
        const helper = new OpenIDConnectHelper(organization, request.body)
        await helper.getClient()

        organization.serverMeta.ssoConfiguration = request.body
        await organization.save()

        return new Response(request.body);
    }
}
