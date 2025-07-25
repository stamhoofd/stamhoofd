import { AutoEncoderPatchType, Decoder, PatchableArrayAutoEncoder, PatchableArrayDecoder, StringDecoder } from '@simonbackx/simple-encoding';
import { DecodedRequest, Endpoint, Request, Response } from '@simonbackx/simple-endpoints';
import { SimpleError } from '@simonbackx/simple-errors';
import { Document, DocumentTemplate, Member, Registration } from '@stamhoofd/models';
import { DocumentStatus, Document as DocumentStruct, PermissionLevel } from '@stamhoofd/structures';

import { Context } from '../../../../helpers/Context';

type Params = Record<string, never>;
type Query = undefined;
type Body = PatchableArrayAutoEncoder<DocumentStruct>;
type ResponseBody = DocumentStruct[];

export class PatchDocumentEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    bodyDecoder = new PatchableArrayDecoder(DocumentStruct as Decoder<DocumentStruct>, DocumentStruct.patchType() as Decoder<AutoEncoderPatchType<DocumentStruct>>, StringDecoder);

    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method !== 'PATCH') {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, '/organization/documents', {});

        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    async handle(request: DecodedRequest<Params, Query, Body>) {
        const organization = await Context.setOrganizationScope();
        await Context.authenticate();

        if (!await Context.auth.canManageDocuments(organization.id, PermissionLevel.Write)) {
            throw Context.auth.error();
        }

        const updatedDocuments: DocumentStruct[] = [];

        for (const patch of request.body.getPatches()) {
            const document = await Document.getByID(patch.id);
            if (!document || !(await Context.auth.canAccessDocument(document, PermissionLevel.Write))) {
                throw Context.auth.notFoundOrNoAccess($t(`a9860203-6a6d-4612-b4d4-7851e47d4dad`));
            }

            if (patch.data) {
                document.data.patchOrPut(patch.data);
            }

            if (patch.status && (document.status !== DocumentStatus.MissingData || patch.status === DocumentStatus.Deleted)) {
                document.status = patch.status;
            }

            if (document.status === DocumentStatus.Draft || document.status === DocumentStatus.Published) {
                const template = await DocumentTemplate.getByID(document.templateId);
                if (!template) {
                    throw new SimpleError({
                        code: 'not_found',
                        message: 'Document not found',
                        human: $t(`b6ffe33d-566e-4c9a-85b2-82930d653548`),
                    });
                }

                document.status = template.status;
            }

            await document.updateData();
            await document.save();

            // Return in response
            updatedDocuments.push(document.getStructure());
        }

        for (const { put } of request.body.getPuts()) {
            // Create a new document
            const template = await DocumentTemplate.getByID(put.templateId);
            if (!template || !await Context.auth.canAccessDocumentTemplate(template, PermissionLevel.Write)) {
                throw new SimpleError({
                    code: 'not_found',
                    message: 'Document template not found',
                    human: $t(`f428c3d5-9b0f-485b-971e-b7e5d76533d4`),
                });
            }
            const document = new Document();
            document.organizationId = organization.id;
            document.templateId = template.id;
            document.status = put.status;
            document.data = put.data;

            if (document.status === DocumentStatus.Draft || document.status === DocumentStatus.Published) {
                document.status = template.status;
            }

            if (put.registrationId) {
                const registration = await Registration.getByID(put.registrationId);
                if (!registration) {
                    throw new SimpleError({
                        code: 'not_found',
                        message: 'Registration not found',
                        human: $t(`5756fd57-7f2b-4ce4-8be1-ba0dd4313c75`),
                    });
                }
                document.registrationId = put.registrationId;
                put.memberId = registration.memberId;
            }
            if (put.memberId) {
                const member = await Member.getWithRegistrations(put.memberId);
                if (!member || !await Context.auth.canAccessMember(member, PermissionLevel.Read)) {
                    throw new SimpleError({
                        code: 'not_found',
                        message: 'Member not found',
                        human: $t(`9cfa48c7-980c-4cd5-85ed-2656db040b4c`),
                    });
                }
                document.memberId = put.memberId;
            }

            await document.updateData();
            await document.save();

            // Return in response
            updatedDocuments.push(document.getStructure());
        }

        return new Response(
            updatedDocuments,
        );
    }
}
