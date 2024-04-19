import { DecodedRequest, Endpoint, Request, Response } from "@simonbackx/simple-endpoints";
import { SimpleError } from "@simonbackx/simple-errors";
import { signInternal } from "@stamhoofd/backend-env";
import { Document } from "@stamhoofd/models";

import { Context } from "../../../helpers/Context";
type Params = { id: string };
type Query = undefined;
type Body = undefined
type ResponseBody = Buffer

export class GetDocumentHtml extends Endpoint<Params, Query, Body, ResponseBody> {
    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method != "GET") {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, "/documents/@id/html", { id: String});

        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    async handle(request: DecodedRequest<Params, Query, Body>) {
        const organization = await Context.setOrganizationScope()
        await Context.authenticate()

        const document = await Document.getByID(request.params.id)
        if (!document || !(await Context.auth.canAccessDocument(document))) {
            throw new SimpleError({
                code: "not_found",
                message: "Onbekend document"
            })
        }

        const html = await document.getRenderedHtml(organization);
        if (!html) {
            throw new SimpleError({
                code: "failed_generating",
                message: "Er ging iets mis bij het aanmaken van het document. Probeer later opieuw en neem contact met ons op als het probleem blijft herhalen."
            })
        }

        const response = new Response(Buffer.from(html, 'utf8'))
        response.headers["content-type"] = "text/plain; charset=utf-8" // avoid JS execution
        response.headers["content-length"] = Buffer.byteLength(html, 'utf8').toString()
        response.headers["x-cache-id"] = 'document-' + document.id;
        response.headers["x-cache-timestamp"] = document.updatedAt.getTime().toString();
        response.headers["x-cache-signature"] = signInternal('document-' + document.id, document.updatedAt.getTime().toString(), html)
        return response
    }
}
