import type { Decoder } from '@simonbackx/simple-encoding';
import type { DecodedRequest, Request } from '@simonbackx/simple-endpoints';
import { Endpoint, Response } from '@simonbackx/simple-endpoints';
import { SimpleError } from '@simonbackx/simple-errors';
import { WebauthnChallenge, WebauthnCredential } from '@stamhoofd/models';
import type { MFAEnrollmentResult } from '@stamhoofd/structures';
import { MFAMethodType, WebauthnRegistrationRequest } from '@stamhoofd/structures';

import { Context } from '../../helpers/Context.js';
import { TwoFactorHelper } from '../../helpers/TwoFactorHelper.js';
import { WebauthnHelper } from '../../helpers/WebauthnHelper.js';
import { TwoFactorAuditLogService } from '../../services/TwoFactorAuditLogService.js';

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
        const { user, setupToken, token } = await Context.authenticateMFAEnrollment();

        if (!user.canUsePasskeys()) {
            throw new SimpleError({
                code: 'passkeys_not_available',
                message: 'Passkeys are not available for this account',
                human: $t('%ZhE'),
                statusCode: 400,
            });
        }

        const challenge = await WebauthnChallenge.consumeForUser(user.id);
        if (!challenge) {
            throw new SimpleError({
                code: 'invalid_challenge',
                message: 'No valid registration challenge found',
                human: $t('%Zi9'),
                statusCode: 400,
            });
        }

        const result = await WebauthnHelper.verifyRegistration(request.body.response, challenge);
        if (!result) {
            throw new SimpleError({
                code: 'invalid_passkey',
                message: 'Could not verify the passkey',
                human: $t('%Zhr'),
                statusCode: 400,
            });
        }

        if (await WebauthnCredential.getByCredentialId(result.credentialId)) {
            throw new SimpleError({
                code: 'passkey_already_registered',
                message: 'This passkey is already registered',
                human: $t('%Zhf'),
                statusCode: 400,
            });
        }

        const wasFirstFactor = !(await TwoFactorHelper.userHasFactors(user.id));

        const credential = new WebauthnCredential();
        credential.userId = user.id;
        credential.credentialId = result.credentialId;
        credential.rpId = result.rpId;
        credential.publicKey = result.publicKey;
        credential.counter = result.counter;
        credential.transports = result.transports ? JSON.stringify(result.transports) : null;
        credential.backedUp = result.backedUp;
        credential.backupEligible = result.backupEligible;
        credential.name = request.body.name?.trim() || '';
        credential.providerId = result.providerId;
        credential.providerName = result.providerName;
        await credential.save();

        await TwoFactorAuditLogService.logMethodAdded(user, MFAMethodType.Passkey, credential.name || credential.providerName || '');

        return new Response(await TwoFactorHelper.completeEnrollment(user, setupToken, wasFirstFactor, token));
    }
}
