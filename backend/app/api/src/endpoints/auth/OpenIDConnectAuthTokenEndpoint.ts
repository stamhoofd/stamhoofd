import { AutoEncoder, field, StringDecoder } from '@simonbackx/simple-encoding';
import type { DecodedRequest, Request } from '@simonbackx/simple-endpoints';
import { Endpoint, Response } from '@simonbackx/simple-endpoints';

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
        const { token: sessionToken } = await Context.authenticate({ allowWithoutAccount: false });

        // The resulting token links an external login provider to the account of the
        // session, which would hand an administrator a way into the account afterwards.
        Context.assertNotImpersonating();

        // Create a SSO auth token that can only be used once
        const token = await SSOService.createToken(sessionToken);

        return new Response(OpenIDAuthTokenResponse.create({
            ssoAuthToken: token,
        }));
    }
}
