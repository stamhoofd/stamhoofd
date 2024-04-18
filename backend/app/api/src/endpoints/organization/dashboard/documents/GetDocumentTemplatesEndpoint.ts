import { DecodedRequest, Endpoint, Request, Response } from "@simonbackx/simple-endpoints";
import { SimpleError } from "@simonbackx/simple-errors";
import { DocumentTemplate, Token } from "@stamhoofd/models";
import { DocumentTemplatePrivate } from "@stamhoofd/structures";

import { Context } from "../../../../helpers/Context";

type Params = Record<string, never>;
type Query = undefined;
type Body = undefined
type ResponseBody = DocumentTemplatePrivate[]

export class GetDocumentTemplatesEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
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

    async handle(_: DecodedRequest<Params, Query, Body>) {
        const organization = await Context.setOrganizationScope();
        await Context.authenticate()

        if (!Context.auth.canManageDocuments()) {
            throw Context.auth.error()
        }

        const templates = await DocumentTemplate.where(
            { 
                organizationId: organization.id 
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
