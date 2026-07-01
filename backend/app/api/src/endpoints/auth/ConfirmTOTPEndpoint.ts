import type { Decoder } from '@simonbackx/simple-encoding';
import type { DecodedRequest, Request } from '@simonbackx/simple-endpoints';
import { Endpoint, Response } from '@simonbackx/simple-endpoints';
import { SimpleError } from '@simonbackx/simple-errors';
import { MFATOTP } from '@stamhoofd/models';
import { MFAEnrollmentResult, TOTPConfirmRequest } from '@stamhoofd/structures';

import { Context } from '../../helpers/Context.js';
import { TOTPHelper } from '../../helpers/TOTPHelper.js';
import { TwoFactorHelper } from '../../helpers/TwoFactorHelper.js';

type Params = { id: string };
type Query = undefined;
type Body = TOTPConfirmRequest;
type ResponseBody = MFAEnrollmentResult;

/**
 * Confirm a pending TOTP authenticator by verifying the first code. On the user's first
 * factor this also returns recovery codes, and during forced enrollment it issues a
 * full session token.
 */
export class ConfirmTOTPEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    bodyDecoder = TOTPConfirmRequest as Decoder<TOTPConfirmRequest>;

    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method !== 'POST') {
            return [false];
        }
        const params = Endpoint.parseParameters(request.url, '/mfa/totp/@id/confirm', { id: String });
        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    async handle(request: DecodedRequest<Params, Query, Body>) {
        await Context.setOptionalOrganizationScope();
        const { user, setupToken } = await Context.authenticateMFAEnrollment();

        const totp = await MFATOTP.getByID(request.params.id);
        if (!totp || totp.userId !== user.id) {
            throw new SimpleError({
                code: 'not_found',
                message: 'TOTP authenticator not found',
                human: $t('Deze authenticator werd niet gevonden.'),
                statusCode: 404,
            });
        }

        if (totp.confirmedAt) {
            throw new SimpleError({
                code: 'already_confirmed',
                message: 'This authenticator is already confirmed',
                human: $t('Deze authenticator is al bevestigd.'),
                statusCode: 400,
            });
        }

        if (!TOTPHelper.verify(request.body.code, totp.secret)) {
            throw new SimpleError({
                code: 'invalid_mfa_code',
                message: 'Invalid code',
                human: $t('De ingevoerde code is ongeldig.'),
                field: 'code',
                statusCode: 400,
            });
        }

        const wasFirstFactor = !(await TwoFactorHelper.userHasFactors(user.id));

        totp.confirmedAt = new Date();
        totp.name = request.body.name.trim() || $t('Authenticator');
        totp.lastUsedAt = new Date();
        await totp.save();

        return new Response(await TwoFactorHelper.completeEnrollment(user, setupToken, wasFirstFactor));
    }
}
