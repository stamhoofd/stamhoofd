import { AutoEncoderPatchType, Decoder, PatchableArrayAutoEncoder, PatchableArrayDecoder, StringDecoder } from '@simonbackx/simple-encoding';
import { DecodedRequest, Endpoint, Request, Response } from "@simonbackx/simple-endpoints";
import { SimpleError } from '@simonbackx/simple-errors';
import { EmailTemplate, Token, UserWithOrganization, Webshop } from '@stamhoofd/models';
import { EmailTemplate as EmailTemplateStruct, PermissionLevel } from '@stamhoofd/structures';

import { Context } from '../../../../helpers/Context';

type Params = Record<string, never>;
type Body = PatchableArrayAutoEncoder<EmailTemplateStruct>;
type Query = undefined;

type ResponseBody = EmailTemplateStruct[];

export class PatchEmailTemplatesEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    bodyDecoder = new PatchableArrayDecoder(EmailTemplateStruct as Decoder<EmailTemplateStruct>, EmailTemplateStruct.patchType() as Decoder<AutoEncoderPatchType<EmailTemplateStruct>>, StringDecoder)

    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method != "PATCH") {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, "/email-templates", {});

        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    async handle(request: DecodedRequest<Params, Query, Body>) {
        await Context.setOrganizationScope();
        const {user} = await Context.authenticate()

        // Fast throw first (more in depth checking for patches later)
        if (!Context.auth.canReadEmailTemplates()) {
            throw Context.auth.error()
        }  

        const templates: EmailTemplate[] = []

        // Get all patches
        for (const patch of request.body.getPatches()) {
            const template = await EmailTemplate.getByID(patch.id)
            if (!template || template.organizationId !== user.organizationId) {
                throw new SimpleError({
                    code: "invalid_template",
                    message: "Template with id "+patch.id+" not found",
                })
            }

            if (!(await Context.auth.canAccessEmailTemplate(template, PermissionLevel.Write))) {
                throw Context.auth.error("Je hebt geen toegang om deze emailtemplate te bewerken")
            } 
            
            template.html = patch.html ?? template.html
            template.subject = patch.subject ?? template.subject
            template.text = patch.text ?? template.text
            template.json = patch.json ?? template.json

            await template.save()

            templates.push(template)
        }

        for (const put of request.body.getPuts()) {
            const struct = put.put
            const template = new EmailTemplate()
            template.id = struct.id
            template.organizationId = user.organizationId
            template.webshopId = struct.webshopId
            template.groupId = struct.groupId

            template.html = struct.html
            template.subject = struct.subject
            template.text = struct.text
            template.json = struct.json

            template.type = struct.type

            // Check if valid + write permissions
            if (!(await Context.auth.canAccessEmailTemplate(template, PermissionLevel.Write))) {
                throw Context.auth.error("Je hebt geen toegang om deze emailtemplate te maken")
            } 

            await template.save()

            templates.push(template)
        }
        
        return new Response(templates.map(template => EmailTemplateStruct.create(template)))
    }
}