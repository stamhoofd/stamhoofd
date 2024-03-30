import { AnyDecoder, Decoder } from '@simonbackx/simple-encoding';
import { DecodedRequest, Endpoint, Request } from "@simonbackx/simple-endpoints";
import { SimpleError } from '@simonbackx/simple-errors';
import { Organization, Webshop } from '@stamhoofd/models';

import { OpenIDConnectHelper } from '../../../../helpers/OpenIDConnectHelper';

type Params = Record<string, never>;
type Query = undefined;
type Body = any;
type ResponseBody = undefined;

export class OpenIDConnectCallbackEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    bodyDecoder = AnyDecoder as Decoder<any>;

    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method != "POST") {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, "/openid/callback", {});

        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    async handle(request: DecodedRequest<Params, Query, Body>) {
        const organization = await Organization.fromApiHost(request.host);
        const configuration = organization.serverMeta.ssoConfiguration

        if (!configuration) {
            throw new SimpleError({
                code: "invalid_configuration",
                message: "Invalid configuration",
                statusCode: 400
            });
        }

        const helper = new OpenIDConnectHelper(organization, configuration)
        return await helper.callback(request)
    }
}