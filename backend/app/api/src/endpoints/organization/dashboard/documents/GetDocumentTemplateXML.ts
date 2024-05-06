import { DecodedRequest, Endpoint, Request, Response } from "@simonbackx/simple-endpoints";
import { SimpleError } from "@simonbackx/simple-errors";
import { DocumentTemplate } from '@stamhoofd/models';

import { Context } from "../../../../helpers/Context";

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
        const organization = await Context.setOrganizationScope();
        await Context.authenticate()

        if (!await Context.auth.canManageDocuments(organization.id)) {
            throw Context.auth.error()
        }

        const template = await DocumentTemplate.getByID(request.params.id)
        if (!template || !await Context.auth.canAccessDocumentTemplate(template)) {
            throw Context.auth.notFoundOrNoAccess("Onbekend document")
        }

        // Update documents
        const xml = await template.getRenderedXml(organization);
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
