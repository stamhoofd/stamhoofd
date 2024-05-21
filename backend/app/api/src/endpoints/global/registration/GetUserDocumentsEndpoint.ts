import { DecodedRequest, Endpoint, Request, Response } from "@simonbackx/simple-endpoints";
import { Document, DocumentTemplate, Member } from '@stamhoofd/models';
import { Document as DocumentStruct,DocumentStatus } from "@stamhoofd/structures";
import { Sorter } from "@stamhoofd/utility";

import { Context } from "../../../helpers/Context";
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

    async handle(_: DecodedRequest<Params, Query, Body>) {
        const organization = await Context.setUserOrganizationScope();
        const {user} = await Context.authenticate()

        const members = await Member.getMembersWithRegistrationForUser(user)
        let templates = organization ? await DocumentTemplate.where({ status: 'Published', organizationId: organization.id }) : null
        const memberIds = members.map(m => m.id)
        const templateIds = templates ? templates.map(t => t.id) : null

        if (memberIds.length == 0 || (templateIds !== null && templateIds.length == 0)) {
            return new Response([]);
        }

        const w: any = { 
            memberId: {
                sign: 'IN',
                value: memberIds
            },
            status: {
                sign: 'IN',
                value: [DocumentStatus.MissingData, DocumentStatus.Published]
            },
        }

        if (templateIds !== null) {
            w.templateId = {
                sign: 'IN',
                value: templateIds
            }
        }

        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        const documents = await Document.where(w);

        if (!templates) {
            templates = documents.length > 0 ? await DocumentTemplate.getByIDs(...documents.map(d => d.templateId)) : []
        }
        
        const filteredDocuments = documents.filter(document => {
            const template = templates.find(t => t.id == document.templateId)
            if (!template || (!template.updatesEnabled && document.status === DocumentStatus.MissingData)) {
                return false
            }
            return true;
        })

        filteredDocuments.sort((a, b) => Sorter.byDateValue(a.createdAt, b.createdAt))
        
        return new Response(filteredDocuments.map(d => d.getStructure()));
    }
}
