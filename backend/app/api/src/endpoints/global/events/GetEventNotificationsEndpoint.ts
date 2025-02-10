import { Decoder } from '@simonbackx/simple-encoding';
import { DecodedRequest, Endpoint, Request, Response } from '@simonbackx/simple-endpoints';
import { SimpleError } from '@simonbackx/simple-errors';
import { EventNotification } from '@stamhoofd/models';
import { SQL, SQLFilterDefinitions, SQLSortDefinitions, applySQLSorter, compileToSQLFilter } from '@stamhoofd/sql';
import { CountFilteredRequest, EventNotification as EventNotificationStruct, LimitedFilteredRequest, PaginatedResponse, StamhoofdFilter, assertSort, getSortFilter } from '@stamhoofd/structures';

import { AuthenticatedStructures } from '../../../helpers/AuthenticatedStructures';
import { Context } from '../../../helpers/Context';
import { eventNotificationsFilterCompilers } from '../../../sql-filters/event-notifications';
import { eventNotificationsSorters } from '../../../sql-sorters/event-notifications';
import { SQLResultNamespacedRow } from '@simonbackx/simple-database';

type Params = Record<string, never>;
type Query = LimitedFilteredRequest;
type Body = undefined;
type ResponseBody = PaginatedResponse<EventNotificationStruct[], LimitedFilteredRequest>;

const filterCompilers: SQLFilterDefinitions = eventNotificationsFilterCompilers;
const sorters: SQLSortDefinitions<SQLResultNamespacedRow> = eventNotificationsSorters;

export class GetEventNotificationsEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    queryDecoder = LimitedFilteredRequest as Decoder<LimitedFilteredRequest>;

    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method !== 'GET') {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, '/event-notifications', {});

        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    static async buildQuery(q: CountFilteredRequest | LimitedFilteredRequest) {
        const organization = Context.organization;
        let scopeFilter: StamhoofdFilter | undefined = undefined;

        // todo: add proper scoping and permission checking
        if (organization) {
            scopeFilter = {
                organizationId: organization.id,
            };
        }

        const query = SQL
            .select(
                SQL.wildcard(EventNotification.table),
            )
            .from(
                SQL.table(EventNotification.table),
            );

        if (scopeFilter) {
            query.where(await compileToSQLFilter(scopeFilter, filterCompilers));
        }

        if (q.filter) {
            query.where(await compileToSQLFilter(q.filter, filterCompilers));
        }

        if (q.search) {
            let searchFilter: StamhoofdFilter | null = null;

            searchFilter = {
                events: {
                    $elemMatch: {
                        name: {
                            $contains: q.search,
                        },
                    },
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
        const query = await GetEventNotificationsEndpoint.buildQuery(requestQuery);
        const data = await query.fetch();

        const notifications = EventNotification.fromRows(data, EventNotification.table);

        let next: LimitedFilteredRequest | undefined;

        if (notifications.length >= requestQuery.limit) {
            const lastObject = data[data.length - 1];
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

        return new PaginatedResponse<EventNotificationStruct[], LimitedFilteredRequest>({
            results: await AuthenticatedStructures.eventNotifications(notifications),
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
            await GetEventNotificationsEndpoint.buildData(request.query),
        );
    }
}
