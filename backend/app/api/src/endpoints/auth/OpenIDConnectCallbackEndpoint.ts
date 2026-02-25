import { AnyDecoder, Decoder } from '@simonbackx/simple-encoding';
import { DecodedRequest, Endpoint, Request } from '@simonbackx/simple-endpoints';

import { Context } from '../../helpers/Context.js';
import { SSOServiceWithSession } from '../../services/SSOService.js';

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
        await Context.setUserOrganizationScope({ willAuthenticate: false });
        const ssoService = await SSOServiceWithSession.fromSession(request);
        return await ssoService.callback();
    }
}
