import type { Decoder } from '@simonbackx/simple-encoding';
import type { DecodedRequest, Request } from '@simonbackx/simple-endpoints';
import { Endpoint, Response } from '@simonbackx/simple-endpoints';
import { SimpleError } from '@simonbackx/simple-errors';
import { WebauthnChallenge, WebauthnCredential } from '@stamhoofd/models';
import { MFAEnrollmentResult, WebauthnRegistrationRequest } from '@stamhoofd/structures';

import { Context } from '../../helpers/Context.js';
import { TwoFactorHelper } from '../../helpers/TwoFactorHelper.js';
import { WebauthnHelper } from '../../helpers/WebauthnHelper.js';

type Params = Record<string, never>;
type Query = undefined;
type Body = WebauthnRegistrationRequest;
type ResponseBody = MFAEnrollmentResult;

/**
 * Verify and store a newly registered passkey. On the user's first factor this also
 * returns recovery codes, and during forced enrollment it issues a full session token.
 */
export class RegisterPasskeyEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    bodyDecoder = WebauthnRegistrationRequest as Decoder<WebauthnRegistrationRequest>;

    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method !== 'POST') {
            return [false];
        }
        const params = Endpoint.parseParameters(request.url, '/mfa/passkeys', {});
        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    async handle(request: DecodedRequest<Params, Query, Body>) {
        await Context.setOptionalOrganizationScope();
        const { user, setupToken } = await Context.authenticateMFAEnrollment();

        const challenge = await WebauthnChallenge.consumeForUser(user.id);
        if (!challenge) {
            throw new SimpleError({
                code: 'invalid_challenge',
                message: 'No valid registration challenge found',
                human: $t('De registratie is verlopen. Probeer opnieuw.'),
                statusCode: 400,
            });
        }

        const result = await WebauthnHelper.verifyRegistration(request.body.response, challenge);
        if (!result) {
            throw new SimpleError({
                code: 'invalid_passkey',
                message: 'Could not verify the passkey',
                human: $t('De passkey kon niet geverifieerd worden.'),
                statusCode: 400,
            });
        }

        if (await WebauthnCredential.getByCredentialId(result.credentialId)) {
            throw new SimpleError({
                code: 'passkey_already_registered',
                message: 'This passkey is already registered',
                human: $t('Deze passkey is al geregistreerd.'),
                statusCode: 400,
            });
        }

        const wasFirstFactor = !(await TwoFactorHelper.userHasFactors(user.id));

        const credential = new WebauthnCredential();
        credential.userId = user.id;
        credential.credentialId = result.credentialId;
        credential.publicKey = result.publicKey;
        credential.counter = result.counter;
        credential.transports = result.transports ? JSON.stringify(result.transports) : null;
        credential.backedUp = result.backedUp;
        credential.name = request.body.name.trim() || $t('Passkey');
        credential.lastUsedAt = new Date();
        await credential.save();

        return new Response(await TwoFactorHelper.completeEnrollment(user, setupToken, wasFirstFactor));
    }
}
