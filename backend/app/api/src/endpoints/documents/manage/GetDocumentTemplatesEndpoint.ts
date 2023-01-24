import { DecodedRequest, Endpoint, Request, Response } from "@simonbackx/simple-endpoints";
import { SimpleError } from "@simonbackx/simple-errors";
import { DocumentTemplate, Token } from "@stamhoofd/models";
import { DocumentTemplatePrivate } from "@stamhoofd/structures";

type Params = Record<string, never>;
type Query = undefined;
type Body = undefined
type ResponseBody = DocumentTemplatePrivate[]

/**
 * One endpoint to create, patch and delete groups. Usefull because on organization setup, we need to create multiple groups at once. Also, sometimes we need to link values and update multiple groups at once
 */

export class GetGroupMembersEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method != "GET") {
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

        if (!user.permissions || !user.permissions.hasFullAccess()) {
            throw new SimpleError({
                code: "permission_denied",
                message: "Je hebt geen toegang tot documenten"
            })
        }

        const templates = await DocumentTemplate.where(
            { 
                organizationId: user.organizationId 
            }, 
            { 
                sort: [{
                    column: "createdAt",
                    direction: "ASC"
                }] 
            }
        )
        return new Response(
            templates.map(t => t.getPrivateStructure())
        );
    }
}
