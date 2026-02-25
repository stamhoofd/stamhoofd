import { Decoder } from '@simonbackx/simple-encoding';
import { DecodedRequest, Endpoint, Request } from '@simonbackx/simple-endpoints';
import { StartOpenIDFlowStruct } from '@stamhoofd/structures';

import { Context } from '../../helpers/Context.js';
import { SSOService } from '../../services/SSOService.js';

type Params = Record<string, never>;
type Query = StartOpenIDFlowStruct;
type Body = undefined;
type ResponseBody = undefined;

export class OpenIDConnectStartEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    queryDecoder = StartOpenIDFlowStruct as Decoder<StartOpenIDFlowStruct>;

    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method !== 'GET') {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, '/openid/start', {});

        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    async handle(request: DecodedRequest<Params, Query, Body>) {
        // Check webshop and/or organization
        await Context.setUserOrganizationScope({ willAuthenticate: false });
        const service = await SSOService.fromContext(request.query.provider);
        return await service.validateAndStartAuthCodeFlow(request.query);
    }
}
