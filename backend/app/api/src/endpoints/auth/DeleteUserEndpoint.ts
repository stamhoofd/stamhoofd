import type { DecodedRequest, Request } from '@simonbackx/simple-endpoints';
import { Endpoint, Response } from '@simonbackx/simple-endpoints';

import { getDefaultEmailFrom, sendEmailTemplate } from '../../helpers/EmailBuilder.js';
import { EmailTemplateType, Recipient } from '@stamhoofd/structures';
import { Context } from '../../helpers/Context.js';

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
        const { user, token } = await Context.authenticate({ allowWithoutAccount: true });

        // This deletes the account of the session, which while impersonating is the
        // administrator's own - never what they meant to do from inside somebody else's
        // account.
        Context.assertNotImpersonating();

        // Send an e-mail to inform everyone about this action

        // Delete the account

        const bcc = (await getDefaultEmailFrom(STAMHOOFD.userMode === 'platform' ? null : organization, {
            template: {},
        }));
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
        await user.save();
        await token.delete();

        return new Response(undefined);
    }
}
