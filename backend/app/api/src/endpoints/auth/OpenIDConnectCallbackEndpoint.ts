import { AnyDecoder, Decoder } from '@simonbackx/simple-encoding';
import { DecodedRequest, Endpoint, Request } from '@simonbackx/simple-endpoints';
import { SimpleError } from '@simonbackx/simple-errors';

import { Context } from '../../helpers/Context';
import { OpenIDConnectHelper } from '../../helpers/OpenIDConnectHelper';
import { OpenIDClientConfiguration } from '@stamhoofd/structures';
import { Platform } from '@stamhoofd/models';

type Params = Record<string, never>;
type Query = undefined;
type Body = any;
type ResponseBody = undefined;

export class OpenIDConnectCallbackEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    bodyDecoder = AnyDecoder as Decoder<any>;

    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method !== 'POST') {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, '/openid/callback', {});

        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    async handle(request: DecodedRequest<Params, Query, Body>) {
        const organization = await Context.setOptionalOrganizationScope();
        let configuration: OpenIDClientConfiguration | null;
        const platform = await Platform.getShared();

        if (organization) {
            configuration = organization.serverMeta.ssoConfiguration;
        }
        else {
            configuration = platform.serverConfig.ssoConfiguration;
        }

        if (!configuration) {
            throw new SimpleError({
                code: 'invalid_client',
                message: 'SSO not configured',
                statusCode: 400,
            });
        }

        const helper = new OpenIDConnectHelper(organization, configuration);
        return await helper.callback(request);
    }
}
