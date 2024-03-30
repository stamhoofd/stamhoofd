import { DecodedRequest, Endpoint, Request, Response } from "@simonbackx/simple-endpoints";
import { SimpleError } from "@simonbackx/simple-errors";
import { DocumentTemplate, Token } from '@stamhoofd/models';

type Params = { id: string };
type Query = undefined;
type Body = undefined;
type ResponseBody = Buffer

/**
 * One endpoint to create, patch and delete groups. Usefull because on organization setup, we need to create multiple groups at once. Also, sometimes we need to link values and update multiple groups at once
 */

export class GetDocumentTemplateXMLEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method != "GET") {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, "/organization/document-templates/@id/xml", { id: String});

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

        const template = await DocumentTemplate.getByID(request.params.id)
        if (!template || template.organizationId != user.organizationId) {
            throw new SimpleError({
                code: "not_found",
                message: "Document not found",
                human: "Document niet gevonden"
            })
        }

        // Update documents
        const xml = await template.getRenderedXml(user.organization);
        if (!xml) {
            throw new SimpleError({
                code: "failed_generating",
                message: "Er ging iets mis bij het aanmaken van het document. Probeer later opieuw en neem contact met ons op als het probleem blijft herhalen."
            })
        }

        const response = new Response(Buffer.from(xml, 'utf8'))
        response.headers["content-type"] = "text/plain; charset=utf-8" // avoid JS execution
        response.headers["content-length"] = Buffer.byteLength(xml, 'utf8').toString()
        return response
    }
}
