import { DecodedRequest, Endpoint, Request, Response } from '@simonbackx/simple-endpoints';
import { Email, EmailRecipient } from '@stamhoofd/models';
import { EmailRecipient as EmailRecipientStruct, EmailStatus, PermissionLevel } from '@stamhoofd/structures';

import { SimpleError } from '@simonbackx/simple-errors';
import { Context } from '../../../helpers/Context.js';

type Params = { id: string };
type Query = undefined;
type Body = undefined;
type ResponseBody = EmailRecipientStruct;

export class RetryEmailRecipientEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method !== 'POST') {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, '/email-recipients/@id/retry', { id: String });

        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    async handle(request: DecodedRequest<Params, Query, Body>) {
        const organization = await Context.setOptionalOrganizationScope();
        await Context.authenticate();

        if (!await Context.auth.canReadEmails(organization)) {
            // Fast fail before query
            throw Context.auth.error();
        }
        const emailRecipient = await EmailRecipient.getByID(request.params.id);
        if (!emailRecipient || emailRecipient.organizationId !== (organization?.id ?? null)) {
            throw new SimpleError({
                code: 'not_found',
                message: 'Email recipient not found',
                human: $t(`2e79bf4a-878b-43b0-902b-9d080c8b7fdf`),
                statusCode: 404,
            });
        }

        const model = await Email.getByID(emailRecipient.emailId);
        if (!model || (model.organizationId !== (organization?.id ?? null))) {
            throw new SimpleError({
                code: 'not_found',
                message: 'Email not found',
                human: $t(`9ddb6616-f62d-4c91-82a9-e5cf398e4c4a`),
                statusCode: 404,
            });
        }

        if (!await Context.auth.canAccessEmail(model, PermissionLevel.Write)) {
            throw Context.auth.error();
        }

        if (model.status !== EmailStatus.Sent) {
            throw new SimpleError({
                code: 'not_sent',
                message: 'Cant retry email that is not sent',
                statusCode: 400,
            });
        }

        if (emailRecipient.sentAt) {
            throw new SimpleError({
                code: 'already_sent',
                message: 'Cant retry email recipient that is already sent',
                human: $t(`f3f837eb-d6f7-4c6e-9477-d566a03e09b1`),
                statusCode: 400,
            });
        }

        // Retry
        await model.resumeSending(emailRecipient.id);

        await emailRecipient.refresh();

        return new Response((await EmailRecipient.getStructures([emailRecipient]))[0]);
    }
}
