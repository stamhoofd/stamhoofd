import type { AutoEncoderPatchType, Decoder, PatchableArrayAutoEncoder} from '@simonbackx/simple-encoding';
import { PatchableArrayDecoder, StringDecoder } from '@simonbackx/simple-encoding';
import type { DecodedRequest, Request} from '@simonbackx/simple-endpoints';
import { Endpoint, Response } from '@simonbackx/simple-endpoints';
import { SimpleError } from '@simonbackx/simple-errors';
import { Document, DocumentTemplate, Member, Registration } from '@stamhoofd/models';
import { DocumentStatus, Document as DocumentStruct, PermissionLevel } from '@stamhoofd/structures';

import { Context } from '../../../../helpers/Context.js';

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
                throw Context.auth.notFoundOrNoAccess($t(`%EK`));
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
                        human: $t(`%EL`),
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
                    human: $t(`%EM`),
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
                        human: $t(`%EN`),
                    });
                }
                document.registrationId = put.registrationId;
                put.memberId = registration.memberId;
            }
            if (put.memberId) {
                const member = await Member.getByIdWithUsersAndRegistrations(put.memberId);
                if (!member || !await Context.auth.canAccessMember(member, PermissionLevel.Read)) {
                    throw new SimpleError({
                        code: 'not_found',
                        message: 'Member not found',
                        human: $t(`%EO`),
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
