import { AutoEncoder, Decoder, field, StringDecoder } from '@simonbackx/simple-encoding';
import { DecodedRequest, Endpoint, Request, Response } from "@simonbackx/simple-endpoints";
import { Organization } from "@stamhoofd/models";
import { Organization as OrganizationStruct,OrganizationSimple } from "@stamhoofd/structures"; 
import { AuthenticatedStructures } from '../../../helpers/AuthenticatedStructures';

type Params = Record<string, never>;

class Query extends AutoEncoder {
    @field({ decoder: StringDecoder })
    query: string
}

type Body = undefined;
type ResponseBody = (OrganizationSimple | OrganizationStruct)[]

export class SearchOrganizationEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    protected queryDecoder = Query as Decoder<Query>

    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method != "GET") {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, "/organizations/search", {});

        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    async handle(request: DecodedRequest<Params, Query, Body>) {
        // Escape query
        const query = request.query.query.replace(/([-+><()~*"@\s]+)/g, " ").replace(/[^\w\d]+$/, "")
        if (query.length == 0) {
            // Do not try searching...
            return new Response([])
        }

        const match = {
            sign: "MATCH",
            value: query + "*", // We replace special operators in boolean mode with spaces since special characters aren't indexed anyway
            mode: "BOOLEAN"
        };

        // We had to add an order by in the query to fix the limit. MySQL doesn't want to limit the results correctly if we don't explicitly sort the results on their relevance
        const organizations = await Organization.where({ searchIndex: match }, {
            limit: 15,
            sort: [
                {
                    column: { searchIndex: match },
                    direction: "DESC"
                }
            ]
        });
        
        if (request.request.getVersion() < 169) {
            return new Response(organizations.map(o => OrganizationSimple.create(o)));
        }
        return new Response(await Promise.all(organizations.map(o => AuthenticatedStructures.organization(o))));
    }
}
