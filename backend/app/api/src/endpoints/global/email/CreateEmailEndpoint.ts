import { Decoder } from '@simonbackx/simple-encoding';
import { DecodedRequest, Endpoint, Request, Response } from "@simonbackx/simple-endpoints";
import { Email, RateLimiter } from '@stamhoofd/models';
import { EmailPreview, EmailStatus, Email as EmailStruct, Version } from "@stamhoofd/structures";

import { Context } from '../../../helpers/Context';
import { SQL } from '@stamhoofd/sql';

type Params = Record<string, never>;
type Query = undefined;
type Body = EmailStruct
type ResponseBody = EmailPreview;

export const paidEmailRateLimiter = new RateLimiter({
    limits: [
        {   
            // Max 5.000 emails a day
            limit: 5000,
            duration: 24 * 60 * 1000 * 60
        },
        {   
            // 10.000 requests per week
            limit: 10000,
            duration: 24 * 60 * 1000 * 60 * 7
        }
    ]
});

export const freeEmailRateLimiter = new RateLimiter({
    limits: [
        {   
            // Max 100 a day
            limit: 100,
            duration: 24 * 60 * 1000 * 60
        },
        {   
            // Max 200 a week
            limit: 200,
            duration: 7 * 24 * 60 * 1000 * 60
        }
    ]
});

/**
 * One endpoint to create, patch and delete groups. Usefull because on organization setup, we need to create multiple groups at once. Also, sometimes we need to link values and update multiple groups at once
 */

export class CreateEmailEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    bodyDecoder = EmailStruct as Decoder<EmailStruct>

    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method != "POST") {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, "/email", {});

        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    async handle(request: DecodedRequest<Params, Query, Body>) {
        const organization = await Context.setOptionalOrganizationScope();
        const {user} = await Context.authenticate()

        if (!Context.auth.canSendEmails()) {
            throw Context.auth.error()
        }

        const model = new Email();
        model.userId = user.id;
        model.organizationId = organization?.id ?? null;
        model.recipientFilter = request.body.recipientFilter;

        model.subject = request.body.subject;
        model.html = request.body.html;
        model.text = request.body.text;
        model.status = request.body.status;
        model.attachments = request.body.attachments;
        model.fromAddress = request.body.fromAddress;
        model.fromName = request.body.fromName;

        await model.save();
        await model.buildExampleRecipient()
        model.updateCount();

        if (request.body.status === EmailStatus.Sending || request.body.status === EmailStatus.Sent) {
            model.send().catch(console.error)
        }

        return new Response(await model.getPreviewStructure());
    }
}
