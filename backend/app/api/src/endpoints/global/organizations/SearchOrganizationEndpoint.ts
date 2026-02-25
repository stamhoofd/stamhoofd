import { AutoEncoder, Decoder, field, StringDecoder } from '@simonbackx/simple-encoding';
import { DecodedRequest, Endpoint, Request, Response } from '@simonbackx/simple-endpoints';
import { Organization } from '@stamhoofd/models';
import { scalarToSQLExpression, SQL, SQLMatch, SQLWhere, SQLWhereLike } from '@stamhoofd/sql';
import { Organization as OrganizationStruct } from '@stamhoofd/structures';
import { AuthenticatedStructures } from '../../../helpers/AuthenticatedStructures.js';

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
            // give lower relevance if the last word is not a complete match
            matchValue = `>("${query}") (${query}) <(${query}*)`;
        }
        else {
            // give higher relevance if the searchindex includes the exact word
            matchValue = `>${query} ${query}*`;
        }

        const limit = 15;

        const whereMatch: SQLWhere = new SQLMatch(SQL.column(Organization.table, 'searchIndex'), scalarToSQLExpression(matchValue));

        let organizations = await Organization.select()
            .where('active', true)
            .where(whereMatch)
            .orderBy(whereMatch, 'DESC')
            .limit(limit).fetch();

        // if the limit is reached it is possible that organizations where the name starts with the query are missing -> fetch them and add them at the start
        if (organizations.length === limit) {
            const organizationsStartingWith = await Organization.select()
                .where(new SQLWhereLike(SQL.column(Organization.table, 'name'), scalarToSQLExpression(`${query}%`)))
                // order by relevance
                .orderBy(whereMatch, 'DESC')
                .limit(limit).fetch();

            const organizationsStartingWithIds = new Set(organizationsStartingWith.map(o => o.id));

            organizations = organizationsStartingWith.concat(organizations.filter(o => !organizationsStartingWithIds.has(o.id)));
        }

        return new Response(await Promise.all(organizations.map(o => AuthenticatedStructures.organization(o))));
    }
}
