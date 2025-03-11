import { AutoEncoder, Decoder, field, StringDecoder } from '@simonbackx/simple-encoding';
import { DecodedRequest, Endpoint, Request, Response } from '@simonbackx/simple-endpoints';
import { Organization } from '@stamhoofd/models';
import { SQLWhereSign } from '@stamhoofd/sql';
import { Organization as OrganizationStruct } from '@stamhoofd/structures';
import { AuthenticatedStructures } from '../../../helpers/AuthenticatedStructures';

type Params = Record<string, never>;

class Query extends AutoEncoder {
    @field({ decoder: StringDecoder })
    query: string;
}

type Body = undefined;
type ResponseBody = OrganizationStruct[];

export class SearchOrganizationEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    protected queryDecoder = Query as Decoder<Query>;

    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method !== 'GET') {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, '/organizations/search', {});

        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    async handle(request: DecodedRequest<Params, Query, Body>) {
        // Escape query
        const query = request.query.query.replace(/([-+><()~*"@\s]+)/g, ' ').replace(/[^\w\d]+$/, '').trim();
        if (query.length === 0) {
            // Do not try searching...
            return new Response([]);
        }

        let matchValue: string;

        if (query.includes(' ')) {
            // give higher relevance if the searchindex includes the exact sentence
            matchValue = `>"${query}" ${query}*`;
        }
        else {
            // give higher relevance if the searchindex includes the exact word
            matchValue = `>${query} ${query}*`;
        }

        const organizations = await Organization.select()
            .where('searchIndex', SQLWhereSign.BooleanMatch, matchValue)
            .limit(15).fetch();

        return new Response(await Promise.all(organizations.map(o => AuthenticatedStructures.organization(o))));
    }
}
