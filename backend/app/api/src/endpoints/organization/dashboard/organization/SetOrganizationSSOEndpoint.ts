import { Decoder } from '@simonbackx/simple-encoding';
import { DecodedRequest, Endpoint, Request, Response } from "@simonbackx/simple-endpoints";
import { SimpleError } from '@simonbackx/simple-errors';
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

        if (!Context.auth.canManageSSOSettings()) {
            throw Context.auth.error()
        }

        const body = request.body.clone()

        if (request.body.clientSecret === OpenIDClientConfiguration.placeholderClientSecret) {
            body.clientSecret = organization.serverMeta.ssoConfiguration?.clientSecret ?? ""
        }

        // Validate configuration
        try {
            const helper = new OpenIDConnectHelper(organization, body)
            await helper.getClient()
        } catch (e) {
            console.error(e)
            throw new SimpleError({
                code: 'invalid_configuration',
                message: 'Invalid configuration',
                human: 'Deze configuratie is ongeldig. Controleer of de gegevens correct zijn ingevuld.',
            })
        }

        organization.serverMeta.ssoConfiguration = body
        await organization.save()

        const response = body.clone()

         // Remove secret by placeholder asterisks
        if (response.clientSecret.length > 0) {
            response.clientSecret = OpenIDClientConfiguration.placeholderClientSecret;
        }

        return new Response(response);
    }
}
