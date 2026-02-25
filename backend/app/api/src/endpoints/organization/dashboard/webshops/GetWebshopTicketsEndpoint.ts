import { Decoder } from '@simonbackx/simple-encoding';
import { DecodedRequest, Endpoint, Request, Response } from '@simonbackx/simple-endpoints';
import { Ticket } from '@stamhoofd/models';
import { assertSort, CountFilteredRequest, getSortFilter, LimitedFilteredRequest, PaginatedResponse, TicketPrivate } from '@stamhoofd/structures';

import { applySQLSorter, compileToSQLFilter, SQL, SQLFilterDefinitions, SQLSortDefinitions } from '@stamhoofd/sql';
import { AuthenticatedStructures } from '../../../../helpers/AuthenticatedStructures.js';
import { Context } from '../../../../helpers/Context.js';
import { LimitedFilteredRequestHelper } from '../../../../helpers/LimitedFilteredRequestHelper.js';
import { ticketFilterCompilers } from '../../../../sql-filters/tickets.js';
import { ticketSorters } from '../../../../sql-sorters/tickets.js';

type Params = Record<string, never>;
type Query = LimitedFilteredRequest;
type Body = undefined;
type ResponseBody = PaginatedResponse<TicketPrivate[], LimitedFilteredRequest>;

const filterCompilers: SQLFilterDefinitions = ticketFilterCompilers;
const sorters: SQLSortDefinitions<Ticket> = ticketSorters;

export class GetWebshopTicketsEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    queryDecoder = LimitedFilteredRequest as Decoder<LimitedFilteredRequest>;

    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method !== 'GET') {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, '/webshop/tickets/private', {});

        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    static async buildQuery(q: CountFilteredRequest | LimitedFilteredRequest) {
        const organization = Context.organization!;

        const ticketsTable: string = Ticket.table;

        const query = SQL
            .select(SQL.wildcard(ticketsTable))
            .from(SQL.table(ticketsTable))
            .where(await Promise.resolve(compileToSQLFilter({
                organizationId: organization.id,
            }, filterCompilers)));

        if (q.filter) {
            query.where(await Promise.resolve(compileToSQLFilter(q.filter, filterCompilers)));
        }

        // currently no search supported, probably not needed?
        // if (q.search) {
        // }

        if (q instanceof LimitedFilteredRequest) {
            if (q.pageFilter) {
                query.where(await Promise.resolve(compileToSQLFilter(q.pageFilter, filterCompilers)));
            }

            q.sort = assertSort(q.sort, [{ key: 'id' }]);
            applySQLSorter(query, q.sort, sorters);
            query.limit(q.limit);
        }

        return query;
    }

    static async buildData(requestQuery: LimitedFilteredRequest) {
        const query = await this.buildQuery(requestQuery);
        const data = await query.fetch();

        const tickets: Ticket[] = Ticket.fromRows(data, Ticket.table);

        let next: LimitedFilteredRequest | undefined;

        if (tickets.length >= requestQuery.limit) {
            const lastObject = tickets[tickets.length - 1];
            const nextFilter = getSortFilter(lastObject, sorters, requestQuery.sort);

            next = new LimitedFilteredRequest({
                filter: requestQuery.filter,
                pageFilter: nextFilter,
                sort: requestQuery.sort,
                limit: requestQuery.limit,
                search: requestQuery.search,
            });

            if (JSON.stringify(nextFilter) === JSON.stringify(requestQuery.pageFilter)) {
                console.error('Found infinite loading loop for', requestQuery);
                next = undefined;
            }
        }

        return new PaginatedResponse<TicketPrivate[], LimitedFilteredRequest>({
            results: await AuthenticatedStructures.tickets(tickets),
            next,
        });
    }

    async handle(request: DecodedRequest<Params, Query, Body>): Promise<Response<ResponseBody>> {
        const organization = await Context.setOrganizationScope();
        await Context.authenticate();

        // Fast throw first (more in depth checking for patches later)
        if (!await Context.auth.hasSomeAccess(organization.id)) {
            throw Context.auth.error();
        }

        LimitedFilteredRequestHelper.throwIfInvalidLimit({
            request: request.query,
            maxLimit: Context.auth.hasSomePlatformAccess() ? 1000 : 100,
        });

        return new Response(
            await GetWebshopTicketsEndpoint.buildData(request.query),
        );
    }
}
