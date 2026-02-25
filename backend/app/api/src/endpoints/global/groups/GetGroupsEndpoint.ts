import { DecodedRequest, Endpoint, Request, Response } from '@simonbackx/simple-endpoints';
import { assertSort, CountFilteredRequest, getSortFilter, Group as GroupStruct, LimitedFilteredRequest, PaginatedResponse, StamhoofdFilter } from '@stamhoofd/structures';

import { Decoder } from '@simonbackx/simple-encoding';
import { SimpleError } from '@simonbackx/simple-errors';
import { Group } from '@stamhoofd/models';
import { applySQLSorter, compileToSQLFilter, SQLFilterDefinitions, SQLSortDefinitions } from '@stamhoofd/sql';
import { AuthenticatedStructures } from '../../../helpers/AuthenticatedStructures.js';
import { Context } from '../../../helpers/Context.js';
import { groupFilterCompilers } from '../../../sql-filters/groups.js';
import { groupSorters } from '../../../sql-sorters/groups.js';

type Params = Record<string, never>;
type Query = LimitedFilteredRequest;
type Body = undefined;
type ResponseBody = PaginatedResponse<GroupStruct[], LimitedFilteredRequest>;

const filterCompilers: SQLFilterDefinitions = groupFilterCompilers;
const sorters: SQLSortDefinitions<Group> = groupSorters;

export class GetGroupsEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    queryDecoder = LimitedFilteredRequest as Decoder<LimitedFilteredRequest>;

    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method !== 'GET') {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, '/groups', {});

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
                organizationId: organization.id,
            };
        }

        const query = Group.select();

        if (scopeFilter) {
            query.where(await compileToSQLFilter(scopeFilter, filterCompilers));
        }

        if (q.filter) {
            query.where(await compileToSQLFilter(q.filter, filterCompilers));
        }

        if (q.search) {
            let searchFilter: StamhoofdFilter | null = null;

            searchFilter = {
                id: q.search,
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
        const query = await GetGroupsEndpoint.buildQuery(requestQuery);
        const groups = await query.fetch();

        let next: LimitedFilteredRequest | undefined;

        if (groups.length >= requestQuery.limit) {
            const lastObject = groups[groups.length - 1];
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

        return new PaginatedResponse<GroupStruct[], LimitedFilteredRequest>({
            results: await AuthenticatedStructures.groups(groups),
            next,
        });
    }

    async handle(request: DecodedRequest<Params, Query, Body>) {
        if (request.request.getVersion() < 373) {
            throw new SimpleError({
                code: 'client_update_required',
                statusCode: 400,
                message: 'Er is een noodzakelijke update beschikbaar. Herlaad de pagina en wis indien nodig de cache van jouw browser.',
                human: $t(`adb0e7c8-aed7-43f5-bfcc-a350f03aaabe`),
            });
        }

        const organization = await Context.setOptionalOrganizationScope();
        await Context.optionalAuthenticate();

        if (!organization) {
            if (!Context.auth.hasSomePlatformAccess()) {
                throw Context.auth.error();
            }
        }

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
            await GetGroupsEndpoint.buildData(request.query),
        );
    }
}
