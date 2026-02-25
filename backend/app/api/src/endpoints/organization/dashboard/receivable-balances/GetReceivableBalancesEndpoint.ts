import { Decoder } from '@simonbackx/simple-encoding';
import { DecodedRequest, Endpoint, Request, Response } from '@simonbackx/simple-endpoints';
import { SimpleError } from '@simonbackx/simple-errors';
import { CachedBalance } from '@stamhoofd/models';
import { applySQLSorter, compileToSQLFilter } from '@stamhoofd/sql';
import { assertSort, CountFilteredRequest, DetailedReceivableBalance, getSortFilter, LimitedFilteredRequest, PaginatedResponse, ReceivableBalance as ReceivableBalanceStruct, StamhoofdFilter } from '@stamhoofd/structures';

import { AuthenticatedStructures } from '../../../../helpers/AuthenticatedStructures.js';
import { Context } from '../../../../helpers/Context.js';
import { receivableBalanceFilterCompilers } from '../../../../sql-filters/receivable-balances.js';
import { receivableBalanceSorters } from '../../../../sql-sorters/receivable-balances.js';

type Params = Record<string, never>;
type Query = LimitedFilteredRequest;
type Body = undefined;
type ResponseBody = PaginatedResponse<ReceivableBalanceStruct[], LimitedFilteredRequest>;

const sorters = receivableBalanceSorters;
const filterCompilers = receivableBalanceFilterCompilers;

export class GetReceivableBalancesEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    queryDecoder = LimitedFilteredRequest as Decoder<LimitedFilteredRequest>;

    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method !== 'GET') {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, '/receivable-balances', {});

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
        };

        const query = CachedBalance
            .select();

        if (scopeFilter) {
            query.where(await compileToSQLFilter(scopeFilter, filterCompilers));
        }

        if (q.filter) {
            query.where(await compileToSQLFilter(q.filter, filterCompilers));
        }

        if (q.search) {
            let searchFilter: StamhoofdFilter | null = null;

            searchFilter = {
                $or: [
                    {
                        organizations: {
                            $elemMatch: {
                                $or: [
                                    { name: { $contains: q.search } },
                                    { uri: q.search },
                                ],
                            },
                        },
                    },
                    {
                        members: {
                            $elemMatch: { name: { $contains: q.search } },
                        },
                    },
                    {
                        users: {
                            $elemMatch: {
                                $or: {
                                    name: { $contains: q.search },
                                    email: { $contains: q.search },
                                },
                            },
                        },
                    },
                ],
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

    static async buildDataHelper(requestQuery: LimitedFilteredRequest) {
        const query = await GetReceivableBalancesEndpoint.buildQuery(requestQuery);
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

        return { data, next };
    }

    static async buildData(requestQuery: LimitedFilteredRequest) {
        const { data, next } = await GetReceivableBalancesEndpoint.buildDataHelper(requestQuery);

        return new PaginatedResponse<ReceivableBalanceStruct[], LimitedFilteredRequest>({
            results: await AuthenticatedStructures.receivableBalances(data),
            next,
        });
    }

    static async buildDetailedData(requestQuery: LimitedFilteredRequest) {
        const organization = Context.organization ?? await Context.setOrganizationScope({ willAuthenticate: false });
        const { data, next } = await GetReceivableBalancesEndpoint.buildDataHelper(requestQuery);

        return new PaginatedResponse<DetailedReceivableBalance[], LimitedFilteredRequest>({
            results: await AuthenticatedStructures.detailedReceivableBalances(organization.id, data),
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
            await GetReceivableBalancesEndpoint.buildData(request.query),
        );
    }
}
