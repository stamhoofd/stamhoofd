import { DecodedRequest, Endpoint, Request, Response } from "@simonbackx/simple-endpoints";
import { SimpleError } from "@simonbackx/simple-errors";
import { Document, DocumentTemplate, Token } from "@stamhoofd/models";
import { Document as DocumentStruct } from "@stamhoofd/structures";

type Params = { id: string };
type Query = undefined;
type Body = undefined
type ResponseBody = DocumentStruct[]

/**
 * One endpoint to create, patch and delete groups. Usefull because on organization setup, we need to create multiple groups at once. Also, sometimes we need to link values and update multiple groups at once
 */

export class GetGroupMembersEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
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
        const token = await Token.authenticate(request);
        const user = token.user

        if (!user.hasFullAccess()) {
            throw new SimpleError({
                code: "permission_denied",
                message: "Je hebt geen toegang tot documenten"
            })
        }

        const template = await DocumentTemplate.getByID(request.params.id)
        if (!template || template.organizationId != user.organizationId) {
            throw new SimpleError({
                code: "not_found",
                message: "Onbekend document"
            })
        }

        const documents = await Document.where({ templateId: template.id });

        return new Response(
            documents.map(t => t.getStructure())
        );
    }
}
