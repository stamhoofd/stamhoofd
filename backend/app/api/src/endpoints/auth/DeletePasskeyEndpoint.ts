import type { DecodedRequest, Request } from '@simonbackx/simple-endpoints';
import { Endpoint, Response } from '@simonbackx/simple-endpoints';
import { SimpleError } from '@simonbackx/simple-errors';
import { MFATOTP, WebauthnCredential } from '@stamhoofd/models';
import type { MFAStatus } from '@stamhoofd/structures';

import { Context } from '../../helpers/Context.js';
import { TwoFactorHelper } from '../../helpers/TwoFactorHelper.js';

type Params = { id: string };
type Query = undefined;
type Body = undefined;
type ResponseBody = MFAStatus;

export class DeletePasskeyEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method !== 'DELETE') {
            return [false];
        }
        const params = Endpoint.parseParameters(request.url, '/mfa/passkeys/@id', { id: String });
        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    async handle(request: DecodedRequest<Params, Query, Body>) {
        const organization = await Context.setOptionalOrganizationScope();
        const { user } = await Context.authenticateFresh({ allowWithoutAccount: true, allowUnscoped: true });

        const credential = await WebauthnCredential.getByID(request.params.id);
        if (!credential || credential.userId !== user.id) {
            throw new SimpleError({
                code: 'not_found',
                message: 'Passkey not found',
                human: $t('Deze passkey werd niet gevonden.'),
                statusCode: 404,
            });
        }

        const confirmedTotp = await MFATOTP.getConfirmedForUser(user.id);
        const passkeys = await WebauthnCredential.getForUser(user.id);
        const remaining = confirmedTotp.length + passkeys.filter(p => p.id !== credential.id).length;
        if (remaining === 0 && TwoFactorHelper.isTwoFactorRequired(user, organization ?? Context.organization ?? null)) {
            throw new SimpleError({
                code: 'cannot_remove_last_factor',
                message: 'Cannot remove the last two-factor method',
                human: $t('Je kan je laatste tweestapsverificatie niet verwijderen omdat die verplicht is.'),
                statusCode: 400,
            });
        }

        await credential.delete();

        return new Response(await TwoFactorHelper.buildStatus(user.id));
    }
}
