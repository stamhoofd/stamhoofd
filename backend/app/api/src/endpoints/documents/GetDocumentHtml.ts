import { DecodedRequest, Endpoint, Request, Response } from "@simonbackx/simple-endpoints";
import { SimpleError } from "@simonbackx/simple-errors";
import { signInternal } from "@stamhoofd/backend-env";
import { Document, Member, Token } from "@stamhoofd/models";
type Params = { id: string };
type Query = undefined;
type Body = undefined
type ResponseBody = Buffer

/**
 * One endpoint to create, patch and delete groups. Usefull because on organization setup, we need to create multiple groups at once. Also, sometimes we need to link values and update multiple groups at once
 */

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
        const token = await Token.authenticate(request);
        const user = token.user

        const document = await Document.getByID(request.params.id)
        if (!document || document.organizationId != user.organizationId) {
            throw new SimpleError({
                code: "not_found",
                message: "Onbekend document"
            })
        }

        if (!user.permissions || !user.permissions.hasFullAccess()) {
            // Get members
            const members = !document.memberId ? [] : (await Member.getMembersWithRegistrationForUser(user))
            if (!document.memberId || !members.find(m => m.id == document.memberId)) {
                throw new SimpleError({
                    code: "permission_denied",
                    message: "Je hebt geen toegang tot documenten"
                })
            }
        }


        const html = await document.getRenderedHtml(user.organization);
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
