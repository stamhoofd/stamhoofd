import { DecodedRequest, Endpoint, Request, Response } from '@simonbackx/simple-endpoints';
import { Email } from '@stamhoofd/models';
import { EmailPreview, EmailStatus, Email as EmailStruct } from '@stamhoofd/structures';

import { AutoEncoderPatchType, Decoder, patchObject } from '@simonbackx/simple-encoding';
import { SimpleError } from '@simonbackx/simple-errors';
import { Context } from '../../../helpers/Context';

type Params = { id: string };
type Query = undefined;
type Body = AutoEncoderPatchType<EmailStruct>;
type ResponseBody = EmailPreview;

export class PatchEmailEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    bodyDecoder = EmailStruct.patchType() as Decoder<AutoEncoderPatchType<EmailStruct>>;

    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method !== 'PATCH') {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, '/email/@id', { id: String });

        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    async handle(request: DecodedRequest<Params, Query, Body>) {
        const organization = await Context.setOptionalOrganizationScope();
        const { user } = await Context.authenticate();

        if (!Context.auth.canSendEmails(organization)) {
            throw Context.auth.error();
        }

        const model = await Email.getByID(request.params.id);
        if (!model || model.userId !== user.id || (model.organizationId !== (organization?.id ?? null))) {
            throw new SimpleError({
                code: 'not_found',
                human: 'Email not found',
                message: $t(`9ddb6616-f62d-4c91-82a9-e5cf398e4c4a`),
                statusCode: 404,
            });
        }

        if (model.status !== EmailStatus.Draft) {
            throw new SimpleError({
                code: 'not_draft',
                human: 'Email is not a draft',
                message: $t(`298b5a46-2899-4aa1-89df-9b634c20806b`),
                statusCode: 400,
            });
        }

        let rebuild = false;

        if (request.body.subject !== undefined) {
            model.subject = request.body.subject;
        }

        if (request.body.html !== undefined) {
            model.html = request.body.html;
        }

        if (request.body.text !== undefined) {
            model.text = request.body.text;
        }

        if (request.body.json !== undefined) {
            model.json = request.body.json;
        }

        if (request.body.fromAddress !== undefined) {
            model.fromAddress = request.body.fromAddress;
        }

        if (request.body.fromName !== undefined) {
            model.fromName = request.body.fromName;
        }

        if (request.body.recipientFilter) {
            model.recipientFilter = patchObject(model.recipientFilter, request.body.recipientFilter);
            rebuild = true;
        }

        // Attachments
        if (request.body.attachments !== undefined) {
            model.attachments = patchObject(model.attachments, request.body.attachments);
            model.validateAttachments();
        }

        await model.save();

        if (rebuild) {
            await model.buildExampleRecipient();
            model.updateCount();

            // Force null - because we have stale data
            model.recipientCount = null;
        }

        if (request.body.status === EmailStatus.Sending || request.body.status === EmailStatus.Sent) {
            model.throwIfNotReadyToSend();

            const replacement = '{{unsubscribeUrl}}';

            if (model.html) {
                // Check email contains an unsubscribe button
                if (!model.html.includes(replacement)) {
                    throw new SimpleError({
                        code: 'missing_unsubscribe_button',
                        message: 'Missing unsubscribe button',
                        human: $t(`dd55e04b-e5d9-4d9a-befc-443eef4175a8`),
                        field: 'html',
                    });
                }
            }

            if (model.text) {
                // Check email contains an unsubscribe button
                if (!model.text.includes(replacement)) {
                    throw new SimpleError({
                        code: 'missing_unsubscribe_button',
                        message: 'Missing unsubscribe button',
                        human: $t(`dd55e04b-e5d9-4d9a-befc-443eef4175a8`),
                        field: 'text',
                    });
                }
            }

            model.send().catch(console.error);
        }

        return new Response(await model.getPreviewStructure());
    }
}
