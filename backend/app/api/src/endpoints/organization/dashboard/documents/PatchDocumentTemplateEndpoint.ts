import { AutoEncoderPatchType, Decoder, PatchableArrayAutoEncoder, PatchableArrayDecoder, StringDecoder } from '@simonbackx/simple-encoding';
import { DecodedRequest, Endpoint, Request, Response } from "@simonbackx/simple-endpoints";
import { SimpleError } from "@simonbackx/simple-errors";
import { DocumentTemplate, Token } from '@stamhoofd/models';
import { DocumentTemplatePrivate, PermissionLevel } from "@stamhoofd/structures";

import { Context } from '../../../../helpers/Context';

type Params = Record<string, never>;
type Query = undefined;
type Body = PatchableArrayAutoEncoder<DocumentTemplatePrivate>
type ResponseBody = DocumentTemplatePrivate[]

/**
 * One endpoint to create, patch and delete groups. Usefull because on organization setup, we need to create multiple groups at once. Also, sometimes we need to link values and update multiple groups at once
 */

export class PatchDocumentTemplateEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    bodyDecoder = new PatchableArrayDecoder(DocumentTemplatePrivate as Decoder<DocumentTemplatePrivate>, DocumentTemplatePrivate.patchType() as Decoder<AutoEncoderPatchType<DocumentTemplatePrivate>>, StringDecoder)

    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method != "PATCH") {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, "/organization/document-templates", {});

        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    async handle(request: DecodedRequest<Params, Query, Body>) {
        const organization = await Context.setOrganizationScope();
        await Context.authenticate()

        if (!Context.auth.canManageDocuments(PermissionLevel.Write)) {
            throw Context.auth.error()
        }

        const updatedTemplates: DocumentTemplatePrivate[] = []

        for (const {put} of request.body.getPuts()) {
            // Creating new templates
            const template = new DocumentTemplate()
            template.privateSettings = put.privateSettings
            template.settings = put.settings
            template.status = put.status
            template.html = put.html
            template.updatesEnabled = put.updatesEnabled
            template.organizationId = organization.id
            await template.save();

            // todo: Generate documents (maybe in background)
            template.buildAll().catch(console.error)

            // Return in response
            updatedTemplates.push(template.getPrivateStructure())
        }

        for (const patch of request.body.getPatches()) {
            const template = await DocumentTemplate.getByID(patch.id)
            if (!template || !Context.auth.canAccessDocumentTemplate(template, PermissionLevel.Full)) {
                throw Context.auth.notFoundOrNoAccess("Onbekende template")
            }

            if (patch.privateSettings) {
                template.privateSettings.patchOrPut(patch.privateSettings)
            }

            if (patch.settings) {
                template.settings.patchOrPut(patch.settings)
            }

            if (patch.status) {
                template.status = patch.status
            }

            if (patch.updatesEnabled !== undefined) {
                template.updatesEnabled = patch.updatesEnabled
            }

            if (patch.html) {
                template.html = patch.html
            }

            await template.save();

            // Update documents
            await template.buildAll()

            // Return in response
            updatedTemplates.push(template.getPrivateStructure())
        }

        for (const id of request.body.getDeletes()) {
            const template = await DocumentTemplate.getByID(id)
            if (!template || !Context.auth.canAccessDocumentTemplate(template, PermissionLevel.Full)) {
                throw new SimpleError({
                    code: "not_found",
                    message: "Template not found",
                    human: "Template niet gevonden"
                })
            }

            await template.delete()
        }

        return new Response(
            updatedTemplates
        );
    }
}
