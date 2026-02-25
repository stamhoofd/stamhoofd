import { Decoder } from '@simonbackx/simple-encoding';
import { DecodedRequest, Endpoint, Request, Response } from '@simonbackx/simple-endpoints';
import { SimpleError } from '@simonbackx/simple-errors';
import { Event } from '@stamhoofd/models';
import { SQL, SQLSortDefinitions, applySQLSorter, compileToSQLFilter } from '@stamhoofd/sql';
import { CountFilteredRequest, Event as EventStruct, LimitedFilteredRequest, PaginatedResponse, StamhoofdFilter, assertSort, getSortFilter } from '@stamhoofd/structures';

import { AuthenticatedStructures } from '../../../helpers/AuthenticatedStructures.js';
import { Context } from '../../../helpers/Context.js';
import { eventFilterCompilers } from '../../../sql-filters/events.js';
import { eventSorters } from '../../../sql-sorters/events.js';

type Params = Record<string, never>;
type Query = LimitedFilteredRequest;
type Body = undefined;
type ResponseBody = PaginatedResponse<EventStruct[], LimitedFilteredRequest>;

const filterCompilers = eventFilterCompilers;
const sorters: SQLSortDefinitions<Event> = eventSorters;

export class GetEventsEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    queryDecoder = LimitedFilteredRequest as Decoder<LimitedFilteredRequest>;

    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method !== 'GET') {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, '/events', {});

        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    static async buildQuery(q: CountFilteredRequest | LimitedFilteredRequest) {
        const organization = Context.organization;
        let scopeFilter: StamhoofdFilter | undefined = undefined;

        if (organization) {
            scopeFilter = {
                $or: [
                    {
                        organizationId: organization.id,
                    },
                    {
                        organizationId: null,
                    },
                ],
            };
        }

        const query = SQL
            .select(
                SQL.wildcard(Event.table),
            )
            .from(
                SQL.table(Event.table),
            );

        if (scopeFilter) {
            query.where(await compileToSQLFilter(scopeFilter, filterCompilers));
        }

        if (q.filter) {
            query.where(await compileToSQLFilter(q.filter, filterCompilers));
        }

        if (q.search) {
            let searchFilter: StamhoofdFilter | null = null;

            // todo: detect special search patterns and adjust search filter if needed
            searchFilter = {
                name: {
                    $contains: q.search,
                },
            };

            if (searchFilter) {
                query.where(await compileToSQLFilter(searchFilter, filterCompilers));
            }
        }

        if (q instanceof LimitedFilteredRequest) {
            if (q.pageFilter) {
                query.where(await compileToSQLFilter(q.pageFilter, filterCompilers));
            }

            q.sort = assertSort(q.sort, [{ key: 'id' }]);
            applySQLSorter(query, q.sort, sorters);
            query.limit(q.limit);
        }

        return query;
    }

    static async buildData(requestQuery: LimitedFilteredRequest) {
        const query = await GetEventsEndpoint.buildQuery(requestQuery);
        const data = await query.fetch();

        const events = Event.fromRows(data, Event.table);

        let next: LimitedFilteredRequest | undefined;

        if (events.length >= requestQuery.limit) {
            const lastObject = events[events.length - 1];
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

        return new PaginatedResponse<EventStruct[], LimitedFilteredRequest>({
            results: await AuthenticatedStructures.events(events),
            next,
        });
    }

    async handle(request: DecodedRequest<Params, Query, Body>) {
        await Context.setOptionalOrganizationScope();
        await Context.authenticate();

        const maxLimit = Context.auth.hasSomePlatformAccess() ? 1000 : 100;

        if (request.query.limit > maxLimit) {
            throw new SimpleError({
                code: 'invalid_field',
                field: 'limit',
                message: 'Limit can not be more than ' + maxLimit,
            });
        }

        if (request.query.limit < 1) {
            throw new SimpleError({
                code: 'invalid_field',
                field: 'limit',
                message: 'Limit can not be less than 1',
            });
        }

        return new Response(
            await GetEventsEndpoint.buildData(request.query),
        );
    }
}
