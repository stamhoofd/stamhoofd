import { DecodedRequest, Endpoint, Request, Response } from '@simonbackx/simple-endpoints';
import { Email, Platform } from '@stamhoofd/models';
import { EmailPreview, EmailRecipientsStatus, EmailStatus, Email as EmailStruct, PermissionLevel } from '@stamhoofd/structures';

import { AutoEncoderPatchType, Decoder, patchObject } from '@simonbackx/simple-encoding';
import { SimpleError } from '@simonbackx/simple-errors';
import { Context } from '../../../helpers/Context.js';

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
        await Context.authenticate();

        if (!await Context.auth.canReadEmails(organization)) {
            // Fast fail before query
            throw Context.auth.error();
        }

        const model = await Email.getByID(request.params.id);
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

        let rebuild = false;

        if (request.body.subject !== undefined) {
            model.subject = request.body.subject;
        }

        if (request.body.senderId !== undefined) {
            const list = organization ? organization.privateMeta.emails : (await Platform.getShared()).privateConfig.emails;
            const sender = list.find(e => e.id === request.body.senderId);
            if (sender) {
                if (!await Context.auth.canSendEmailsFrom(organization, sender.id)) {
                    throw Context.auth.error({
                        message: 'Cannot send emails from this sender',
                        human: $t('1b509614-30b0-484c-af72-57d4bc9ea788'),
                    });
                }
                model.senderId = sender.id;
                model.fromAddress = sender.email;
                model.fromName = sender.name;

                // Check if we still have write access to the email
                if (!await Context.auth.canAccessEmail(model, PermissionLevel.Write)) {
                    throw Context.auth.error();
                }
            }
            else {
                throw new SimpleError({
                    code: 'invalid_sender',
                    message: 'Sender not found',
                    human: $t(`94adb4e0-2ef1-4ee8-9f02-5a76efa51c1d`),
                    statusCode: 400,
                });
            }
        }
        else if (model.senderId) {
            // Update data, to avoid sending from an old address
            const list = organization ? organization.privateMeta.emails : (await Platform.getShared()).privateConfig.emails;
            const sender = list.find(e => e.id === model.senderId);
            if (sender) {
                model.fromAddress = sender.email;
                model.fromName = sender.name;
            }
            else {
                throw new SimpleError({
                    code: 'invalid_sender',
                    message: 'Sender not found',
                    human: $t(`f08cccb3-faf9-473f-b729-16120fadec9c`),
                    statusCode: 400,
                });
            }
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

        if (request.body.recipientFilter) {
            if (model.status !== EmailStatus.Draft) {
                throw new SimpleError({
                    code: 'not_draft',
                    message: 'Email is not a draft',
                    human: $t(`ace4d2e8-88d6-479f-bd8b-d576cc0ed1f2`),
                    statusCode: 400,
                });
            }

            if (model.recipientsStatus === EmailRecipientsStatus.Created) {
                throw new SimpleError({
                    code: 'already_created',
                    message: 'Recipients already created',
                    human: $t(`De ontvangers werden reeds ingesteld en kunnen niet meer worden gewijzigd voor dit bericht`),
                    statusCode: 400,
                });
            }

            model.recipientFilter = patchObject(model.recipientFilter, request.body.recipientFilter);
            rebuild = true;
        }

        if (request.body.sendAsEmail !== undefined) {
            if (model.status !== EmailStatus.Draft) {
                throw new SimpleError({
                    code: 'not_draft',
                    message: 'Email is not a draft',
                    human: $t(`02b05c0d-908b-4200-8fb8-5fc01f539514`),
                    statusCode: 400,
                });
            }

            model.sendAsEmail = request.body.sendAsEmail ?? true;
        }

        if (request.body.showInMemberPortal !== undefined) {
            model.showInMemberPortal = request.body.showInMemberPortal ?? false;

            if (model.showInMemberPortal) {
                if (!model.recipientFilter.canShowInMemberPortal) {
                    model.showInMemberPortal = false;
                }
            }
        }

        // Attachments
        if (request.body.attachments !== undefined) {
            model.attachments = patchObject(model.attachments, request.body.attachments);
            model.validateAttachments();
        }

        if (request.body.deletedAt !== undefined) {
            if (!await Context.auth.canAccessEmail(model, PermissionLevel.Full)) {
                throw Context.auth.error();
            }
            model.deletedAt = request.body.deletedAt;
        }

        await model.save();

        if (rebuild) {
            await model.buildExampleRecipient();
            await model.updateCount();
        }

        if (request.body.status === EmailStatus.Sending || request.body.status === EmailStatus.Sent || request.body.status === EmailStatus.Queued) {
            if (!await Context.auth.canSendEmail(model)) {
                throw Context.auth.error({
                    message: 'Cannot send emails from this sender',
                    human: $t('1b509614-30b0-484c-af72-57d4bc9ea788'),
                });
            }

            // Preview the sending status
            await model.queueForSending();
        }

        return new Response(await model.getPreviewStructure());
    }
}
