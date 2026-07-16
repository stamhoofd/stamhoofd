import type { DecodedRequest, Request } from '@simonbackx/simple-endpoints';
import { Endpoint, Response } from '@simonbackx/simple-endpoints';
import { WebauthnChallenge, WebauthnCredential } from '@stamhoofd/models';
import { WebauthnRegistrationOptions } from '@stamhoofd/structures';

import { Context } from '../../helpers/Context.js';
import { WebauthnHelper } from '../../helpers/WebauthnHelper.js';

type Params = Record<string, never>;
type Query = undefined;
type Body = undefined;
type ResponseBody = WebauthnRegistrationOptions;

/**
 * Generate WebAuthn registration options (a challenge) for enrolling a new passkey.
 */
export class RegisterPasskeyOptionsEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method !== 'POST') {
            return [false];
        }
        const params = Endpoint.parseParameters(request.url, '/mfa/passkeys/options', {});
        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    async handle(request: DecodedRequest<Params, Query, Body>) {
        await Context.setOptionalOrganizationScope();
        const { user } = await Context.authenticateMFAEnrollment();

        const existing = await WebauthnCredential.getForUser(user.id);
        const options = await WebauthnHelper.generateRegistration(user, existing);
        await WebauthnChallenge.createFor(user.id, options.challenge);

        return new Response(WebauthnRegistrationOptions.create({ options }));
    }
}
