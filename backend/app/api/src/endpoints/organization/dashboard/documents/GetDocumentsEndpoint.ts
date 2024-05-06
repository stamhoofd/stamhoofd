import { DecodedRequest, Endpoint, Request, Response } from "@simonbackx/simple-endpoints";
import { SimpleError } from "@simonbackx/simple-errors";
import { Document, DocumentTemplate } from "@stamhoofd/models";
import { Document as DocumentStruct } from "@stamhoofd/structures";

import { Context } from "../../../../helpers/Context";

type Params = { id: string };
type Query = undefined;
type Body = undefined
type ResponseBody = DocumentStruct[]

/**
 * One endpoint to create, patch and delete groups. Usefull because on organization setup, we need to create multiple groups at once. Also, sometimes we need to link values and update multiple groups at once
 */

export class GetDocumentsEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method != "GET") {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, "/organization/document-templates/@id/documents", { id: String});

        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    async handle(request: DecodedRequest<Params, Query, Body>) {
        const organization = await Context.setOrganizationScope();
        await Context.authenticate()

        if (!await Context.auth.canManageDocuments(organization.id)) {
            throw Context.auth.error()
        }  

        const template = await DocumentTemplate.getByID(request.params.id)
        if (!template || !await Context.auth.canAccessDocumentTemplate(template)) {
            throw Context.auth.notFoundOrNoAccess("Onbekend document")
        }

        const documents = await Document.where({ templateId: template.id });

        return new Response(
            documents.map(t => t.getStructure())
        );
    }
}
