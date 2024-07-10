import { DecodedRequest, Endpoint, Request, Response } from "@simonbackx/simple-endpoints";
import { Email } from '@stamhoofd/models';
import { EmailPreview, EmailStatus, Email as EmailStruct } from "@stamhoofd/structures";

import { SimpleError } from '@simonbackx/simple-errors';
import { Context } from '../../../helpers/Context';
import { AutoEncoderPatchType, Decoder, patchObject } from "@simonbackx/simple-encoding";

type Params = {id: string};
type Query = undefined;
type Body = AutoEncoderPatchType<EmailStruct>
type ResponseBody = EmailPreview;

/**
 * One endpoint to create, patch and delete groups. Usefull because on organization setup, we need to create multiple groups at once. Also, sometimes we need to link values and update multiple groups at once
 */

export class PatchEmailEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    bodyDecoder = EmailStruct.patchType() as Decoder<AutoEncoderPatchType<EmailStruct>>

    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method != "PATCH") {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, "/email/@id", {id: String});

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

        const model = await Email.getByID(request.params.id);
        if (!model || model.userId !== user.id || (model.organizationId !== (organization?.id ?? null))) {
            throw new SimpleError({
                code: "not_found",
                human: "Email not found",
                message: 'Deze e-mail bestaat niet of is verwijderd',
                statusCode: 404
            })
        }

        if (model.status !== EmailStatus.Draft) {
            throw new SimpleError({
                code: "not_draft",
                human: "Email is not a draft",
                message: 'Deze e-mail is al verzonden en kan niet meer aangepast worden',
                statusCode: 400
            })
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

        await model.save();

        if (rebuild) {
            await model.buildExampleRecipient()
            model.updateCount()

            // Force null - because we have stale data
            model.recipientCount = null
        }

        if (request.body.status === EmailStatus.Sending || request.body.status === EmailStatus.Sent) {
            model.send().catch(console.error)
        }

        return new Response(await model.getPreviewStructure());
    }
}
