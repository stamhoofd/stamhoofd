import { AutoEncoder, field, StringDecoder } from '@simonbackx/simple-encoding';
import { DecodedRequest, Endpoint, Request, Response } from '@simonbackx/simple-endpoints';

import { Context } from '../../helpers/Context.js';
import { SSOService } from '../../services/SSOService.js';
import { OpenIDAuthTokenResponse } from '@stamhoofd/structures';

type Params = Record<string, never>;
type Query = undefined;
type Body = undefined;
type ResponseBody = OpenIDAuthTokenResponse;

/**
 * This endpoint does nothing but build a URL to start the OpenID Connect flow.
 * It is used to provide authenticateion data to the url that is temporarily valid (allows to connect an SSO provider to an existing account)
 */
export class OpenIDConnectAuthTokenEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method !== 'POST') {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, '/openid/auth-token', {});

        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    async handle(request: DecodedRequest<Params, Query, Body>) {
        // Check webshop and/or organization
        await Context.setUserOrganizationScope();
        await Context.authenticate({ allowWithoutAccount: false });

        // Create a SSO auth token that can only be used once
        const token = await SSOService.createToken();

        return new Response(OpenIDAuthTokenResponse.create({
            ssoAuthToken: token,
        }));
    }
}
