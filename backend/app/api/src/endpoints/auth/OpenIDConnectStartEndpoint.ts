import { Decoder } from '@simonbackx/simple-encoding';
import { DecodedRequest, Endpoint, Request } from '@simonbackx/simple-endpoints';
import { StartOpenIDFlowStruct } from '@stamhoofd/structures';

import { Context } from '../../helpers/Context';
import { SSOService } from '../../services/SSOService';

type Params = Record<string, never>;
type Query = undefined;
type Body = StartOpenIDFlowStruct;
type ResponseBody = undefined;

export class OpenIDConnectStartEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    bodyDecoder = StartOpenIDFlowStruct as Decoder<StartOpenIDFlowStruct>;

    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method !== 'POST') {
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
        await Context.setUserOrganizationScope();
        await Context.optionalAuthenticate({ allowWithoutAccount: false });
        console.log('Full start connect body;', await request.request.body);

        if (Context.user) {
            console.log('User:', Context.user);
        }
        const service = await SSOService.fromContext(request.body.provider);
        return await service.validateAndStartAuthCodeFlow(request.body);
    }
}
