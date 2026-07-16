import type { DecodedRequest, Request } from '@simonbackx/simple-endpoints';
import { Endpoint, Response } from '@simonbackx/simple-endpoints';
import { MFATOTP } from '@stamhoofd/models';
import { TOTPSetupResponse } from '@stamhoofd/structures';

import { Context } from '../../helpers/Context.js';
import { TOTPHelper } from '../../helpers/TOTPHelper.js';

type Params = Record<string, never>;
type Query = undefined;
type Body = undefined;
type ResponseBody = TOTPSetupResponse;

/**
 * Start enrolling a new TOTP authenticator. Creates an unconfirmed row and returns the
 * secret (shown once). Confirm it with ConfirmTOTPEndpoint.
 */
export class SetupTOTPEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method !== 'POST') {
            return [false];
        }
        const params = Endpoint.parseParameters(request.url, '/mfa/totp', {});
        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    async handle(request: DecodedRequest<Params, Query, Body>) {
        await Context.setOptionalOrganizationScope();
        const { user } = await Context.authenticateMFAEnrollment();

        // Drop any unconfirmed authenticators from earlier, abandoned setup attempts so
        // they don't pile up as orphaned rows holding an (encrypted) unused secret.
        await MFATOTP.deleteUnconfirmedForUser(user.id);

        const secret = TOTPHelper.generateSecret();
        const totp = new MFATOTP();
        totp.userId = user.id;
        totp.name = '';
        totp.secret = TOTPHelper.encrypt(secret);
        totp.confirmedAt = null;
        await totp.save();

        const otpauthUri = TOTPHelper.keyuri(user.email, secret);

        return new Response(TOTPSetupResponse.create({
            totpId: totp.id,
            secret,
            otpauthUri,
        }));
    }
}
