import { DecodedRequest, Endpoint, Request, Response } from '@simonbackx/simple-endpoints';

import { getDefaultEmailFrom, sendEmailTemplate } from '@stamhoofd/models';
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

        // Send an e-mail to inform everyone about this action

        // Delete the account

        const bcc = (await getDefaultEmailFrom(null, {
            template: {},
        }));
        await sendEmailTemplate(organization, {
            recipients: [
                Recipient.create({
                    email: user.email,
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
