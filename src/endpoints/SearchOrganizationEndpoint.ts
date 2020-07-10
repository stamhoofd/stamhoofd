import { ArrayDecoder,AutoEncoder, Decoder, field, StringDecoder } from '@simonbackx/simple-encoding';
import { DecodedRequest, Endpoint, EndpointError, Request, Response } from "@simonbackx/simple-endpoints";
import { KeychainItemHelper, Sodium } from '@stamhoofd/crypto';
import { Organization as OrganizationStruct, PaginatedResponse,Token as TokenStruct } from "@stamhoofd/structures"; 
import { Formatter } from "@stamhoofd/utility"; 

import { KeychainItem } from '../models/KeychainItem';
import { Organization } from "../models/Organization";
import { Token } from '../models/Token';
import { User } from "../models/User";

type Params = {};

class Query extends AutoEncoder {
    @field({ decoder: StringDecoder })
    query: string
}

type Body = undefined;
type ResponseBody = OrganizationStruct[]

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
        
        return new Response(organizations.map(o => OrganizationStruct.create(o)));
    }
}
