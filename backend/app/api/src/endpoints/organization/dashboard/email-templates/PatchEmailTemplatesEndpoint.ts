import { AutoEncoderPatchType, Decoder, PatchableArrayAutoEncoder, PatchableArrayDecoder, StringDecoder } from '@simonbackx/simple-encoding';
import { DecodedRequest, Endpoint, Request, Response } from '@simonbackx/simple-endpoints';
import { EmailTemplate, Group, Webshop } from '@stamhoofd/models';
import { EmailTemplate as EmailTemplateStruct, PermissionLevel } from '@stamhoofd/structures';

import { Context } from '../../../../helpers/Context';
import { SimpleError } from '@simonbackx/simple-errors';

type Params = Record<string, never>;
type Body = PatchableArrayAutoEncoder<EmailTemplateStruct>;
type Query = undefined;

type ResponseBody = EmailTemplateStruct[];

export class PatchEmailTemplatesEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    bodyDecoder = new PatchableArrayDecoder(EmailTemplateStruct as Decoder<EmailTemplateStruct>, EmailTemplateStruct.patchType() as Decoder<AutoEncoderPatchType<EmailTemplateStruct>>, StringDecoder);

    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method !== 'PATCH') {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, '/email-templates', {});

        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    async handle(request: DecodedRequest<Params, Query, Body>) {
        const organization = await Context.setOptionalOrganizationScope();
        await Context.authenticate();

        if (organization) {
            if (!await Context.auth.canReadEmailTemplates(organization.id)) {
                throw Context.auth.error();
            }
        }
        else {
            if (!Context.auth.hasPlatformFullAccess()) {
                throw Context.auth.error();
            }
        }

        const templates: EmailTemplate[] = [];

        // Get all patches
        for (const patch of request.body.getPatches()) {
            const template = await EmailTemplate.getByID(patch.id);
            if (!template || !(await Context.auth.canAccessEmailTemplate(template, PermissionLevel.Write))) {
                throw Context.auth.notFoundOrNoAccess($t(`ca80fb17-1557-491f-9e9d-554d842a74d7`));
            }

            template.html = patch.html ?? template.html;
            template.subject = patch.subject ?? template.subject;
            template.text = patch.text ?? template.text;
            template.json = patch.json ?? template.json;

            await template.save();

            templates.push(template);
        }

        for (const put of request.body.getPuts()) {
            const struct = put.put;

            if (!EmailTemplateStruct.allowOrganizationLevel(struct.type) && organization) {
                throw Context.auth.error();
            }

            if (!EmailTemplateStruct.allowPlatformLevel(struct.type) && !organization) {
                throw Context.auth.error();
            }

            const template = new EmailTemplate();
            template.id = struct.id;
            template.organizationId = organization?.id ?? null;
            template.webshopId = struct.webshopId;
            template.groupId = struct.groupId;

            if (struct.groupId) {
                const group = await Group.getByID(struct.groupId);
                if (!group || !await Context.auth.canAccessGroup(group, PermissionLevel.Full)) {
                    throw Context.auth.error();
                }
                template.organizationId = group.organizationId;
            }

            if (struct.webshopId) {
                const webshop = await Webshop.getByID(struct.webshopId);
                if (!webshop || !await Context.auth.canAccessWebshop(webshop, PermissionLevel.Full)) {
                    throw Context.auth.error();
                }
                template.organizationId = webshop.organizationId;
            }

            template.html = struct.html;
            template.subject = struct.subject;
            template.text = struct.text;
            template.json = struct.json;

            template.type = struct.type;

            // Check if valid + write permissions
            if (!(await Context.auth.canAccessEmailTemplate(template, PermissionLevel.Write))) {
                throw Context.auth.error($t(`a2afb95e-1dc5-452d-a919-70720fd4e8a6`));
            }

            await template.save();

            templates.push(template);
        }

        for (const id of request.body.getDeletes()) {
            const template = await EmailTemplate.getByID(id);
            if (!template || !(await Context.auth.canAccessEmailTemplate(template, PermissionLevel.Write))) {
                throw Context.auth.notFoundOrNoAccess($t(`54599fe6-d0a3-471d-bbe4-b41c367f9aa2`));
            }

            await template.delete();
        }

        return new Response(templates.map(template => EmailTemplateStruct.create(template)));
    }
}
