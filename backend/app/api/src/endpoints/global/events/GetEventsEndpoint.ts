/* eslint-disable @typescript-eslint/no-unsafe-argument */
import { Decoder } from '@simonbackx/simple-encoding';
import { DecodedRequest, Endpoint, Request, Response } from '@simonbackx/simple-endpoints';
import { SimpleError } from '@simonbackx/simple-errors';
import { Event } from '@stamhoofd/models';
import { SQL, SQLFilterDefinitions, SQLOrderBy, SQLOrderByDirection, SQLSortDefinitions, baseSQLFilterCompilers, compileToSQLFilter, compileToSQLSorter, createSQLColumnFilterCompiler, createSQLExpressionFilterCompiler } from "@stamhoofd/sql";
import { CountFilteredRequest, Event as EventStruct, LimitedFilteredRequest, PaginatedResponse, StamhoofdFilter, getSortFilter } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';

import { AuthenticatedStructures } from '../../../helpers/AuthenticatedStructures';
import { Context } from '../../../helpers/Context';

type Params = Record<string, never>;
type Query = LimitedFilteredRequest;
type Body = undefined;
type ResponseBody = PaginatedResponse<EventStruct[], LimitedFilteredRequest>

const filterCompilers: SQLFilterDefinitions = {
    ...baseSQLFilterCompilers,
    id: createSQLColumnFilterCompiler('id'),
    name: createSQLColumnFilterCompiler('name'),
    organizationId: createSQLColumnFilterCompiler('organizationId'),
    startDate: createSQLColumnFilterCompiler('startDate'),
    endDate: createSQLColumnFilterCompiler('endDate'),
    groupIds: createSQLExpressionFilterCompiler(
        SQL.jsonValue(SQL.column('meta'), '$.value.groupIds'),
        undefined,
        true,
        true
    ),
    defaultAgeGroupIds: createSQLExpressionFilterCompiler(
        SQL.jsonValue(SQL.column('meta'), '$.value.defaultAgeGroupIds'),
        undefined,
        true,
        true
    ),
    organizationTagIds: createSQLExpressionFilterCompiler(
        SQL.jsonValue(SQL.column('meta'), '$.value.organizationTagIds')
    )
}

const sorters: SQLSortDefinitions<Event> = {
    'id': {
        getValue(a) {
            return a.id
        },
        toSQL: (direction: SQLOrderByDirection): SQLOrderBy => {
            return new SQLOrderBy({
                column: SQL.column('id'),
                direction
            })
        }
    },
    'name': {
        getValue(a) {
            return a.name
        },
        toSQL: (direction: SQLOrderByDirection): SQLOrderBy => {
            return new SQLOrderBy({
                column: SQL.column('name'),
                direction
            })
        }
    },
    'startDate': {
        getValue(a) {
            return Formatter.dateTimeIso(a.startDate)
        },
        toSQL: (direction: SQLOrderByDirection): SQLOrderBy => {
            return new SQLOrderBy({
                column: SQL.column('startDate'),
                direction
            })
        }
    },
    'endDate': {
        getValue(a) {
            return Formatter.dateTimeIso(a.endDate)
        },
        toSQL: (direction: SQLOrderByDirection): SQLOrderBy => {
            return new SQLOrderBy({
                column: SQL.column('endDate'),
                direction
            })
        }
    },
}

export class GetEventsEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    queryDecoder = LimitedFilteredRequest as Decoder<LimitedFilteredRequest>

    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method != "GET") {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, "/events", {});

        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    static buildQuery(q: CountFilteredRequest|LimitedFilteredRequest) {
        const organization = Context.organization
        let scopeFilter: StamhoofdFilter|undefined = undefined;

        if (organization) {
            scopeFilter = {
                $or: [
                    {
                        organizationId: organization.id
                    },
                    {
                        organizationId: null
                    }
                ]
            };
        }

        const query = SQL
            .select(
                SQL.wildcard(Event.table)
            )
            .from(
                SQL.table(Event.table)
            );
            
        if (scopeFilter) {
            query.where(compileToSQLFilter(scopeFilter, filterCompilers))
        }

        if (q.filter) {
            query.where(compileToSQLFilter(q.filter, filterCompilers))
        }

        if (q.search) {
            let searchFilter: StamhoofdFilter|null = null

            // todo: detect special search patterns and adjust search filter if needed
            searchFilter = {
                name: {
                    $contains: q.search
                }
            }

            if (searchFilter) {
                query.where(compileToSQLFilter(searchFilter, filterCompilers))
            }
        }

        if (q instanceof LimitedFilteredRequest) {
            if (q.pageFilter) {
                query.where(compileToSQLFilter(q.pageFilter, filterCompilers))
            }

            query.orderBy(compileToSQLSorter(q.sort, sorters))
            query.limit(q.limit)
        }
       
        return query
    }

    static async buildData(requestQuery: LimitedFilteredRequest) {
        const query = GetEventsEndpoint.buildQuery(requestQuery)
        const data = await query.fetch()
        
        const events = Event.fromRows(data, Event.table);

        let next: LimitedFilteredRequest|undefined;

        if (events.length >= requestQuery.limit) {
            const lastObject = events[events.length - 1];
            const nextFilter = getSortFilter(lastObject, sorters, requestQuery.sort);

            next = new LimitedFilteredRequest({
                filter: requestQuery.filter,
                pageFilter: nextFilter,
                sort: requestQuery.sort,
                limit: requestQuery.limit,
                search: requestQuery.search
            })

            if (JSON.stringify(nextFilter) === JSON.stringify(requestQuery.pageFilter)) {
                console.error('Found infinite loading loop for', requestQuery);
                next = undefined;
            }
        }

        return new PaginatedResponse<EventStruct[], LimitedFilteredRequest>({
            results: await AuthenticatedStructures.events(events),
            next
        });
    }

    async handle(request: DecodedRequest<Params, Query, Body>) {
        await Context.setOptionalOrganizationScope();
        await Context.authenticate()

        const maxLimit = Context.auth.hasSomePlatformAccess() ? 1000 : 100;

        if (request.query.limit > maxLimit) {
            throw new SimpleError({
                code: 'invalid_field',
                field: 'limit',
                message: 'Limit can not be more than ' + maxLimit
            })
        }

        if (request.query.limit < 1) {
            throw new SimpleError({
                code: 'invalid_field',
                field: 'limit',
                message: 'Limit can not be less than 1'
            })
        }
        
        return new Response(
            await GetEventsEndpoint.buildData(request.query)
        );
    }
}
