import type { Decoder } from '@simonbackx/simple-encoding';
import type { DecodedRequest, Request } from '@simonbackx/simple-endpoints';
import { Endpoint, Response } from '@simonbackx/simple-endpoints';
import { SimpleError } from '@simonbackx/simple-errors';
import { MFAToken } from '@stamhoofd/models';
import type { MFAChallengeResponse } from '@stamhoofd/structures';
import { MFAChallengeRequest } from '@stamhoofd/structures';

import { Context } from '../../helpers/Context.js';
import { TwoFactorHelper } from '../../helpers/TwoFactorHelper.js';

type Params = Record<string, never>;
type Query = undefined;
type Body = MFAChallengeRequest;
type ResponseBody = MFAChallengeResponse;

/**
 * Describe the second factors that can complete a pending login.
 *
 * Password logins receive this as the `meta` of the `require_mfa` error, but an SSO login
 * ends in a browser redirect that can only carry the token itself. The client posts that
 * token here to learn which methods it may offer.
 *
 * Holding the token means the primary credential was already accepted, and the response
 * carries no secrets: only which method types are enrolled, plus fresh WebAuthn options.
 */
export class GetMFAChallengeEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    bodyDecoder = MFAChallengeRequest as Decoder<MFAChallengeRequest>;

    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method !== 'POST') {
            return [false];
        }
        const params = Endpoint.parseParameters(request.url, '/mfa/challenge', {});
        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    async handle(request: DecodedRequest<Params, Query, Body>) {
        await Context.setOptionalOrganizationScope({ willAuthenticate: false });

        const mfaToken = await MFAToken.getValid(request.body.token, 'login');
        if (!mfaToken) {
            throw new SimpleError({
                code: 'invalid_mfa_token',
                message: 'The MFA session is invalid or expired',
                human: $t('%ZhJ'),
                statusCode: 400,
            });
        }

        return new Response(await TwoFactorHelper.describeLoginChallenge(mfaToken));
    }
}
