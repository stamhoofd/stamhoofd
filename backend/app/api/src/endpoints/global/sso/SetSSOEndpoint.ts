import { AutoEncoderPatchType, Decoder } from '@simonbackx/simple-encoding';
import { DecodedRequest, Endpoint, Request, Response } from '@simonbackx/simple-endpoints';
import { OpenIDClientConfiguration } from '@stamhoofd/structures';

import { Context } from '../../../helpers/Context.js';
import { SSOService } from '../../../services/SSOService.js';
import { SSOQuery } from './GetSSOEndpoint.js';

type Params = Record<string, never>;
type Query = SSOQuery;
type Body = AutoEncoderPatchType<OpenIDClientConfiguration>;
type ResponseBody = OpenIDClientConfiguration;

/**
 * One endpoint to create, patch and delete groups. Usefull because on organization setup, we need to create multiple groups at once. Also, sometimes we need to link values and update multiple groups at once
 */

export class SetOrganizationSSOEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    bodyDecoder = OpenIDClientConfiguration.patchType() as Decoder<AutoEncoderPatchType<OpenIDClientConfiguration>>;
    queryDecoder = SSOQuery as Decoder<Query>;

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
        const service = await SSOService.fromContext(request.query.provider);

        if (!await Context.auth.canManageSSOSettings(organization?.id ?? null)) {
            throw Context.auth.error();
        }

        if (request.body.clientSecret === OpenIDClientConfiguration.placeholderClientSecret) {
            delete request.body.clientSecret;
        }

        const newConfig: OpenIDClientConfiguration = service.configuration.patch(request.body);
        await service.setConfiguration(newConfig);

        return new Response(newConfig);
    }
}
