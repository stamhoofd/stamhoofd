import { AutoEncoderPatchType, Decoder, PatchableArrayAutoEncoder, PatchableArrayDecoder, StringDecoder } from '@simonbackx/simple-encoding';
import { DecodedRequest, Endpoint, Request, Response } from "@simonbackx/simple-endpoints";
import { SimpleError } from "@simonbackx/simple-errors";
import { DocumentTemplate, Token } from '@stamhoofd/models';
import { DocumentTemplatePrivate } from "@stamhoofd/structures";

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
        const token = await Token.authenticate(request);
        const user = token.user

        // If the user has permission, we'll also search if he has access to the organization's key
        if (!user.permissions || !user.permissions.hasFullAccess()) {
            throw new SimpleError({
                code: "permission_denied",
                message: "You don't have permissions to access documents",
                human: "Je hebt geen toegang tot documenten"
            })
        }

        const updatedTemplates: DocumentTemplatePrivate[] = []

        for (const {put} of request.body.getPuts()) {
            // Creating new templates
            const template = new DocumentTemplate()
            template.privateSettings = put.privateSettings
            template.settings = put.settings
            template.status = put.status
            template.html = put.html
            template.organizationId = user.organizationId
            await template.save();

            // todo: Generate documents (maybe in background)
            template.buildAll().catch(console.error)

            // Return in response
            updatedTemplates.push(template.getPrivateStructure())
        }

        for (const patch of request.body.getPatches()) {
            const template = await DocumentTemplate.getByID(patch.id)
            if (!template || template.organizationId != user.organizationId) {
                throw new SimpleError({
                    code: "not_found",
                    message: "Template not found",
                    human: "Template niet gevonden"
                })
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

            if (patch.html) {
                template.html = patch.html
            }

            await template.save();

            // Update documents
            template.buildAll().catch(console.error)

            // Return in response
            updatedTemplates.push(template.getPrivateStructure())
        }

        return new Response(
            updatedTemplates
        );
    }
}
