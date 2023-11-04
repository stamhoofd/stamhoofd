import { AutoEncoderPatchType, Decoder, PatchableArrayAutoEncoder, PatchableArrayDecoder, StringDecoder } from '@simonbackx/simple-encoding';
import { DecodedRequest, Endpoint, Request, Response } from "@simonbackx/simple-endpoints";
import { SimpleError } from "@simonbackx/simple-errors";
import { Document, DocumentTemplate, Member, Registration, Token } from '@stamhoofd/models';
import { Document as DocumentStruct, DocumentStatus, DocumentTemplatePrivate } from "@stamhoofd/structures";

type Params = Record<string, never>;
type Query = undefined;
type Body = PatchableArrayAutoEncoder<DocumentStruct>
type ResponseBody = DocumentStruct[]

/**
 * One endpoint to create, patch and delete groups. Usefull because on organization setup, we need to create multiple groups at once. Also, sometimes we need to link values and update multiple groups at once
 */

export class PatchDocumentTemplateEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    bodyDecoder = new PatchableArrayDecoder(DocumentStruct as Decoder<DocumentStruct>, DocumentStruct.patchType() as Decoder<AutoEncoderPatchType<DocumentStruct>>, StringDecoder)

    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method != "PATCH") {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, "/organization/documents", {});

        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    async handle(request: DecodedRequest<Params, Query, Body>) {
        const token = await Token.authenticate(request);
        const user = token.user

        // If the user has permission, we'll also search if he has access to the organization's key
        if (!user.hasFullAccess()) {
            throw new SimpleError({
                code: "permission_denied",
                message: "You don't have permissions to access documents",
                human: "Je hebt geen toegang tot documenten"
            })
        }

        const updatedDocuments: DocumentStruct[] = []

        for (const patch of request.body.getPatches()) {
            const document = await Document.getByID(patch.id)
            if (!document || document.organizationId != user.organizationId) {
                throw new SimpleError({
                    code: "not_found",
                    message: "Document not found",
                    human: "Document niet gevonden"
                })
            }
            const template = await DocumentTemplate.getByID(document.templateId)
            if (!template || template.organizationId != user.organizationId) {
                throw new SimpleError({
                    code: "not_found",
                    message: "Document not found",
                    human: "Document niet gevonden"
                })
            }

            if (patch.data) {
                document.data.patchOrPut(patch.data)
            }          

            if (patch.status && (document.status !== DocumentStatus.MissingData || patch.status === DocumentStatus.Deleted)) {
                document.status = patch.status
            }

            if (document.status === DocumentStatus.Draft || document.status === DocumentStatus.Published) {
                document.status = template.status
            }
            
            await document.updateData();
            await document.save();

            // Return in response
            updatedDocuments.push(document.getStructure())
        }

        for (const {put} of request.body.getPuts()) {
            // Create a new document
            const template = await DocumentTemplate.getByID(put.templateId)
            if (!template || template.organizationId != user.organizationId) {
                throw new SimpleError({
                    code: "not_found",
                    message: "Document template not found",
                    human: "Document template niet gevonden"
                })
            }
            const document = new Document();
            document.organizationId = user.organizationId
            document.templateId = template.id
            document.status = put.status
            document.data = put.data

            if (document.status === DocumentStatus.Draft || document.status === DocumentStatus.Published) {
                document.status = template.status
            }

            if (put.registrationId) {
                const registration = await Registration.getByID(put.registrationId)
                if (!registration) {
                    throw new SimpleError({
                        code: "not_found",
                        message: "Registration not found",
                        human: "Inschrijving niet gevonden"
                    })
                }
                document.registrationId = put.registrationId
                put.memberId = registration.memberId
            }
            if (put.memberId) {
                const member = await Member.getByID(put.memberId)
                if (!member || member.organizationId != user.organizationId) {
                    throw new SimpleError({
                        code: "not_found",
                        message: "Member not found",
                        human: "Lid niet gevonden"
                    })
                }
                document.memberId = put.memberId
            }

            await document.updateData();
            await document.save();

            // Return in response
            updatedDocuments.push(document.getStructure())
        }

        return new Response(
            updatedDocuments
        );
    }
}
