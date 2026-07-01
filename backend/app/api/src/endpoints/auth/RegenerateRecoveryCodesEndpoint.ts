import type { DecodedRequest, Request } from '@simonbackx/simple-endpoints';
import { Endpoint, Response } from '@simonbackx/simple-endpoints';
import { SimpleError } from '@simonbackx/simple-errors';
import { RecoveryCodes } from '@stamhoofd/structures';

import { Context } from '../../helpers/Context.js';
import { RecoveryCodeHelper } from '../../helpers/RecoveryCodeHelper.js';
import { TwoFactorHelper } from '../../helpers/TwoFactorHelper.js';

type Params = Record<string, never>;
type Query = undefined;
type Body = undefined;
type ResponseBody = RecoveryCodes;

/**
 * Regenerate the user's recovery codes (replacing the previous batch). Returns the new
 * plaintext codes once. Requires the user to already have a factor enrolled.
 */
export class RegenerateRecoveryCodesEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method !== 'POST') {
            return [false];
        }
        const params = Endpoint.parseParameters(request.url, '/mfa/recovery-codes', {});
        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    async handle(request: DecodedRequest<Params, Query, Body>) {
        await Context.setOptionalOrganizationScope();
        const { user } = await Context.authenticateFresh({ allowWithoutAccount: true, allowUnscoped: true });

        if (!(await TwoFactorHelper.userHasFactors(user.id))) {
            throw new SimpleError({
                code: 'no_factors',
                message: 'You need at least one two-factor method before generating recovery codes',
                human: $t('Je moet eerst tweestapsverificatie instellen.'),
                statusCode: 400,
            });
        }

        const codes = await RecoveryCodeHelper.regenerateForUser(user.id);
        return new Response(RecoveryCodes.create({ codes }));
    }
}
