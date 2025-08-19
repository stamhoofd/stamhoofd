import { Decoder } from '@simonbackx/simple-encoding';
import { DecodedRequest, Endpoint, Request, Response } from '@simonbackx/simple-endpoints';
import { Email, Platform, RateLimiter } from '@stamhoofd/models';
import { EmailPreview, EmailStatus, Email as EmailStruct, EmailTemplate as EmailTemplateStruct } from '@stamhoofd/structures';

import { Context } from '../../../helpers/Context';
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
                human: $t('Je hebt nog geen toegangsrechten gekregen om berichten te versturen. Vraag aan een hoofdbeheerder om jou toegang te geven via de instellingen van #platform.'),
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

        const list = organization ? organization.privateMeta.emails : (await Platform.getShared()).privateConfig.emails;
        const sender = list.find(e => e.id === request.body.senderId);
        if (sender) {
            if (!await Context.auth.canSendEmailsFrom(organization, sender.id)) {
                throw Context.auth.error({
                    message: 'Cannot send emails from this sender',
                    human: $t('Je hebt geen toegangsrechten om emails te versturen naar deze afzender.'),
                });
            }
            model.senderId = sender.id;
            model.fromAddress = sender.email;
            model.fromName = sender.name;
        }
        else {
            throw new SimpleError({
                code: 'invalid_sender',
                human: 'Sender not found',
                message: $t(`De afzender die je hebt gekozen bestaat niet meer. Probeer een andere afzender te kiezen.`),
                statusCode: 400,
            });
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
        model.updateCount();

        if (request.body.status === EmailStatus.Sending || request.body.status === EmailStatus.Sent) {
            model.send().catch(console.error);
        }

        return new Response(await model.getPreviewStructure());
    }
}
