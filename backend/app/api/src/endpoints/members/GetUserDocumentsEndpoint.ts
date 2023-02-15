import { DecodedRequest, Endpoint, Request, Response } from "@simonbackx/simple-endpoints";
import { Document, DocumentTemplate, Member, Token } from '@stamhoofd/models';
import { Document as DocumentStruct, DocumentStatus } from "@stamhoofd/structures";
import { Sorter } from "@stamhoofd/utility";
type Params = Record<string, never>;
type Query = undefined;
type Body = undefined
type ResponseBody = DocumentStruct[];

/**
 * Get the members of the user
 */
export class GetUserMembersEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method != "GET") {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, "/documents", {});

        if (params) {
            return [true, params as Params];
        }

        return [false];
    }

    async handle(request: DecodedRequest<Params, Query, Body>) {
        const token = await Token.authenticate(request);
        const user = token.user

        const members = await Member.getMembersWithRegistrationForUser(user)
        const templates = await DocumentTemplate.where({ status: 'Published', organizationId: user.organizationId })
        const memberIds = members.map(m => m.id)
        const templateIds = templates.map(t => t.id)

        if (memberIds.length == 0) {
            return new Response([]);
        }

        const documents = (await Document.where({ 
            memberId: {
                sign: 'IN',
                value: memberIds
            },
            templateId: {
                sign: 'IN',
                value: templateIds
            },
            status: {
                sign: 'IN',
                value: [DocumentStatus.MissingData, DocumentStatus.Published]
            },
        })).filter(document => {
            const template = templates.find(t => t.id == document.templateId)
            if (!template || (!template.updatesEnabled && document.status === DocumentStatus.MissingData)) {
                return false
            }
            return true;
        })

        documents.sort((a, b) => Sorter.byDateValue(a.createdAt, b.createdAt))
        
        return new Response(documents.map(d => d.getStructure()));
    }
}
