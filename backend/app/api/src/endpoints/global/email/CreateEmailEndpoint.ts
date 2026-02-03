import { Decoder } from '@simonbackx/simple-encoding';
import { DecodedRequest, Endpoint, Request, Response } from '@simonbackx/simple-endpoints';
import { Email, Platform, RateLimiter } from '@stamhoofd/models';
import { EmailPreview, EmailStatus, Email as EmailStruct, EmailTemplate as EmailTemplateStruct } from '@stamhoofd/structures';

import { Context } from '../../../helpers/Context.js';
import { SimpleError } from '@simonbackx/simple-errors';

type Params = Record<string, never>;
type Query = undefined;
type Body = EmailStruct;
type ResponseBody = EmailPreview;

export const paidEmailRateLimiter = new RateLimiter({
    limits: [
        {
            // Max 5.000 emails a day
            limit: 5000,
            duration: 24 * 60 * 1000 * 60,
        },
        {
            // 10.000 requests per week
            limit: 10000,
            duration: 24 * 60 * 1000 * 60 * 7,
        },
    ],
});

export const freeEmailRateLimiter = new RateLimiter({
    limits: [
        {
            // Max 100 a day
            limit: 100,
            duration: 24 * 60 * 1000 * 60,
        },
        {
            // Max 200 a week
            limit: 200,
            duration: 7 * 24 * 60 * 1000 * 60,
        },
    ],
});

/**
 * One endpoint to create, patch and delete groups. Usefull because on organization setup, we need to create multiple groups at once. Also, sometimes we need to link values and update multiple groups at once
 */

export class CreateEmailEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    bodyDecoder = EmailStruct as Decoder<EmailStruct>;

    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method !== 'POST') {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, '/email', {});

        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    async handle(request: DecodedRequest<Params, Query, Body>) {
        const organization = await Context.setOptionalOrganizationScope();
        const { user } = await Context.authenticate();

        if (!await Context.auth.canSendEmails(organization)) {
            throw Context.auth.error({
                message: 'Cannot send emails',
                human: $t('f7b7ac75-f7df-49cc-8961-b2478d9683e3'),
            });
        }

        const model = new Email();
        model.userId = user.id;
        model.organizationId = organization?.id ?? null;
        model.recipientFilter = request.body.recipientFilter;

        model.subject = request.body.subject;
        model.html = request.body.html;
        model.text = request.body.text;
        model.json = request.body.json;
        model.status = request.body.status;
        model.attachments = request.body.attachments;
        model.sendAsEmail = request.body.sendAsEmail ?? true;
        model.showInMemberPortal = request.body.showInMemberPortal ?? false;

        if (model.showInMemberPortal) {
            if (!model.recipientFilter.canShowInMemberPortal) {
                model.showInMemberPortal = false;
            }
        }

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
        }
        else {
            if (request.body.senderId) {
                throw new SimpleError({
                    code: 'invalid_sender',
                    message: 'Sender not found',
                    human: $t(`94adb4e0-2ef1-4ee8-9f02-5a76efa51c1d`),
                    statusCode: 400,
                });
            }
        }

        model.validateAttachments();

        // Check default
        if (JSON.stringify(model.json).length < 3 && model.recipientFilter.filters[0].type && EmailTemplateStruct.getDefaultForRecipient(model.recipientFilter.filters[0].type)) {
            const type = EmailTemplateStruct.getDefaultForRecipient(model.recipientFilter.filters[0].type);
            if (type) {
                await model.setFromTemplate(type);
            }
        }

        await model.save();
        await model.buildExampleRecipient();
        await model.updateCount();

        if (request.body.status === EmailStatus.Sending || request.body.status === EmailStatus.Sent || request.body.status === EmailStatus.Queued) {
            if (!await Context.auth.canSendEmail(model)) {
                throw Context.auth.error({
                    message: 'Cannot send emails from this sender',
                    human: $t('1b509614-30b0-484c-af72-57d4bc9ea788'),
                });
            }
            await model.queueForSending();
        }

        // Delete open drafts with the same content, from the same user
        const duplicates = await Email.select()
            .where('userId', user.id)
            .where('organizationId', model.organizationId)
            .where('status', EmailStatus.Draft)
            .where('subject', model.subject)
            .where('html', model.html)
            .where('text', model.text)
            .where('deletedAt', null)
            .whereNot('id', model.id)
            .limit(100)
            .fetch();

        for (const duplicate of duplicates) {
            duplicate.deletedAt = new Date();
            await duplicate.save();
        }

        return new Response(await model.getPreviewStructure());
    }
}
