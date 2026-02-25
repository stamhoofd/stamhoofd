import { DecodedRequest, Endpoint, Request, Response } from '@simonbackx/simple-endpoints';
import { LoginProviderType, OpenIDClientConfiguration } from '@stamhoofd/structures';

import { Context } from '../../../helpers/Context.js';
import { Platform } from '@stamhoofd/models';
import { AutoEncoder, Decoder, EnumDecoder, field } from '@simonbackx/simple-encoding';
import { SSOService } from '../../../services/SSOService.js';

type Params = Record<string, never>;
export class SSOQuery extends AutoEncoder {
    @field({ decoder: new EnumDecoder(LoginProviderType) })
    provider: LoginProviderType;
}
type Query = SSOQuery;
type Body = undefined;
type ResponseBody = OpenIDClientConfiguration;

/**
 * One endpoint to create, patch and delete groups. Usefull because on organization setup, we need to create multiple groups at once. Also, sometimes we need to link values and update multiple groups at once
 */

export class GetOrganizationSSOEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    queryDecoder = SSOQuery as Decoder<Query>;

    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method !== 'GET') {
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

        const configuration = service.configuration.clone();

        // Remove secret by placeholder asterisks
        if (configuration.clientSecret.length > 0) {
            configuration.clientSecret = OpenIDClientConfiguration.placeholderClientSecret;
        }

        return new Response(configuration);
    }
}
