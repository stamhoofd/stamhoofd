import { AutoEncoderPatchType, Decoder } from '@simonbackx/simple-encoding';
import { DecodedRequest, Endpoint, Request, Response } from '@simonbackx/simple-endpoints';
import { OpenIDClientConfiguration } from '@stamhoofd/structures';

import { Context } from '../../../helpers/Context';
import { OpenIDConnectHelper } from '../../../helpers/OpenIDConnectHelper';
import { Platform } from '@stamhoofd/models';

type Params = Record<string, never>;
type Query = undefined;
type Body = AutoEncoderPatchType<OpenIDClientConfiguration>;
type ResponseBody = OpenIDClientConfiguration;

/**
 * One endpoint to create, patch and delete groups. Usefull because on organization setup, we need to create multiple groups at once. Also, sometimes we need to link values and update multiple groups at once
 */

export class SetOrganizationSSOEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    bodyDecoder = OpenIDClientConfiguration.patchType() as Decoder<AutoEncoderPatchType<OpenIDClientConfiguration>>;

    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method !== 'POST') {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, '/sso', {});

        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    async handle(request: DecodedRequest<Params, Query, Body>) {
        const organization = await Context.setOptionalOrganizationScope();
        await Context.authenticate();

        if (!await Context.auth.canManageSSOSettings(organization?.id ?? null)) {
            throw Context.auth.error();
        }

        let newConfig: OpenIDClientConfiguration;

        if (organization) {
            newConfig = (organization.serverMeta.ssoConfiguration ?? OpenIDClientConfiguration.create({})).patch(request.body);

            // Validate configuration
            const helper = new OpenIDConnectHelper(organization, newConfig);
            await helper.getClient();

            organization.serverMeta.ssoConfiguration = newConfig;
            await organization.save();
        }
        else {
            const platform = await Platform.getShared();
            newConfig = (platform.serverConfig.ssoConfiguration ?? OpenIDClientConfiguration.create({})).patch(request.body);

            // Validate configuration
            const helper = new OpenIDConnectHelper(null, newConfig);
            await helper.getClient();

            platform.serverConfig.ssoConfiguration = newConfig;
            await platform.save();
        }

        return new Response(newConfig);
    }
}
