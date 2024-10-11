import { Decoder } from '@simonbackx/simple-encoding';
import { DecodedRequest, Endpoint, Request, Response } from '@simonbackx/simple-endpoints';
import { SimpleError } from '@simonbackx/simple-errors';
import { CachedOutstandingBalance } from '@stamhoofd/models';
import { compileToSQLFilter, compileToSQLSorter } from '@stamhoofd/sql';
import { CachedOutstandingBalance as CachedOutstandingBalanceStruct, CountFilteredRequest, LimitedFilteredRequest, PaginatedResponse, StamhoofdFilter, assertSort, getSortFilter } from '@stamhoofd/structures';

import { AuthenticatedStructures } from '../../../../helpers/AuthenticatedStructures';
import { Context } from '../../../../helpers/Context';
import { cachedOutstandingBalanceFilterCompilers } from '../../../../sql-filters/cached-outstanding-balance';
import { cachedOutstandingBalanceSorters } from '../../../../sql-sorters/cached-outstanding-balance';

type Params = Record<string, never>;
type Query = LimitedFilteredRequest;
type Body = undefined;
type ResponseBody = PaginatedResponse<CachedOutstandingBalanceStruct[], LimitedFilteredRequest>;

const sorters = cachedOutstandingBalanceSorters;
const filterCompilers = cachedOutstandingBalanceFilterCompilers;

export class GetCachedOutstandingBalanceEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    queryDecoder = LimitedFilteredRequest as Decoder<LimitedFilteredRequest>;

    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method !== 'GET') {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, '/cached-outstanding-balance', {});

        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    static async buildQuery(q: CountFilteredRequest | LimitedFilteredRequest) {
        const organization = Context.organization;
        let scopeFilter: StamhoofdFilter | undefined = undefined;

        if (!organization) {
            throw Context.auth.error();
        }

        if (!await Context.auth.canManageFinances(organization.id)) {
            throw Context.auth.error();
        }

        scopeFilter = {
            organizationId: organization.id,
            $or: {
                amount: { $neq: 0 },
                amountPending: { $neq: 0 },
            },
        };

        const query = CachedOutstandingBalance
            .select();

        if (scopeFilter) {
            query.where(compileToSQLFilter(scopeFilter, filterCompilers));
        }

        if (q.filter) {
            query.where(compileToSQLFilter(q.filter, filterCompilers));
        }

        if (q.search) {
            throw new SimpleError({
                code: 'not_implemented',
                message: 'Zoeken in openstaande bedragen is voorlopig nog niet mogelijk',
            });
        }

        if (q instanceof LimitedFilteredRequest) {
            if (q.pageFilter) {
                query.where(compileToSQLFilter(q.pageFilter, filterCompilers));
            }

            q.sort = assertSort(q.sort, [{ key: 'id' }]);
            query.orderBy(compileToSQLSorter(q.sort, sorters));
            query.limit(q.limit);
        }

        return query;
    }

    static async buildData(requestQuery: LimitedFilteredRequest) {
        const query = await GetCachedOutstandingBalanceEndpoint.buildQuery(requestQuery);
        const data = await query.fetch();

        // todo: Create objects from data

        let next: LimitedFilteredRequest | undefined;

        if (data.length >= requestQuery.limit) {
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

        return new PaginatedResponse<CachedOutstandingBalanceStruct[], LimitedFilteredRequest>({
            results: await AuthenticatedStructures.cachedOutstandingBalances(data),
            next,
        });
    }

    async handle(request: DecodedRequest<Params, Query, Body>) {
        await Context.setOrganizationScope();
        await Context.authenticate();

        const maxLimit = Context.auth.hasSomePlatformAccess() ? 100 : 100;

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
            await GetCachedOutstandingBalanceEndpoint.buildData(request.query),
        );
    }
}
