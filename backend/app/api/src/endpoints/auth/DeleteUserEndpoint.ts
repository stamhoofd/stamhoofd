import type { DecodedRequest, Request } from '@stamhoofd/node-endpoints';
import { Endpoint, Response } from '@stamhoofd/node-endpoints';

import {
    EmailVerificationCode,
    MFARecoveryCode,
    MFATOTP,
    MFAToken,
    PasswordToken,
    WebauthnChallenge,
    WebauthnCredential,
} from '@stamhoofd/models';

import { getDefaultEmailFrom, sendEmailTemplate } from '../../helpers/EmailBuilder.js';
import { EmailTemplateType, Recipient } from '@stamhoofd/structures';
import { Context } from '../../helpers/Context.js';
import { SessionService } from '../../services/SessionService.js';

type Params = Record<string, never>;
type Query = undefined;
type Body = undefined;
type ResponseBody = undefined;

export class DeleteUserEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method !== 'DELETE') {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, '/user', {});

        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    async handle(_: DecodedRequest<Params, Query, Body>) {
        const organization = await Context.setOptionalOrganizationScope();
        // Also refuses impersonated sessions: this deletes the account of the session,
        // which while impersonating is the administrator's own - never what they meant to
        // do from inside somebody else's account.
        const { user } = await Context.authenticateFresh({ allowWithoutAccount: true });

        // Send an e-mail to inform everyone about this action

        // Delete the account

        const bcc = await getDefaultEmailFrom(
            STAMHOOFD.userMode === 'platform' ? null : organization,
            {
                template: {},
            },
        );
        await sendEmailTemplate(STAMHOOFD.userMode === 'platform' ? null : organization, {
            recipients: [
                Recipient.create({
                    email: user.email,
                    language: user.language,
                }),
            ],
            singleBcc: bcc.replyTo || bcc.from,
            template: {
                type: EmailTemplateType.DeleteAccountConfirmation,
            },
            type: 'transactional',
        });

        // Soft delete until processed manually
        user.verified = false;
        user.password = null;

        // Without this, hasAccount() stays true and the identity provider can sign the
        // user back in.
        if (user.meta) {
            user.meta.loginProviderIds = new Map();
        }
        await user.save();

        await SessionService.deleteAllFor({ userId: user.id });
        await PasswordToken.clearFor(user.id);
        await EmailVerificationCode.clearFor(user.id);
        await MFAToken.clearFor(user.id);
        await MFATOTP.deleteForUser(user.id);
        await WebauthnCredential.deleteForUser(user.id);
        await WebauthnChallenge.deleteForUser(user.id);
        await MFARecoveryCode.deleteForUser(user.id);

        return new Response(undefined);
    }
}
