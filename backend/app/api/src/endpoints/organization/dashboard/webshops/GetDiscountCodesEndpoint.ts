import type { Decoder } from '@simonbackx/simple-encoding';
import type { DecodedRequest, Request } from '@simonbackx/simple-endpoints';
import { Endpoint, Response } from '@simonbackx/simple-endpoints';
import { Webshop, WebshopDiscountCode } from '@stamhoofd/models';
import type { CountFilteredRequest, DiscountCode, StamhoofdFilter } from '@stamhoofd/structures';
import { assertSort, getSortFilter, LimitedFilteredRequest, PaginatedResponse, PermissionLevel } from '@stamhoofd/structures';
import type { SQLFilterDefinitions, SQLSortDefinitions } from '@stamhoofd/sql';
import { applySQLSorter, compileToSQLFilter, SQL } from '@stamhoofd/sql';

import { Context } from '../../../../helpers/Context.js';
import { LimitedFilteredRequestHelper } from '../../../../helpers/LimitedFilteredRequestHelper.js';
import { discountCodeFilterCompilers } from '../../../../sql-filters/discount-codes.js';
import { discountCodeSorters } from '../../../../sql-sorters/discount-codes.js';

type Params = { id: string };
type Query = LimitedFilteredRequest;
type Body = undefined;
type ResponseBody = PaginatedResponse<DiscountCode[], LimitedFilteredRequest>;

const filterCompilers: SQLFilterDefinitions = discountCodeFilterCompilers;
const sorters: SQLSortDefinitions<WebshopDiscountCode> = discountCodeSorters;
type QueryScope = { webshopId?: string };

export class GetWebshopDiscountCodesEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    queryDecoder = LimitedFilteredRequest as Decoder<LimitedFilteredRequest>;

    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method !== 'GET') {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, '/webshop/@id/discount-codes', { id: String });

        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    static async buildQuery(q: CountFilteredRequest | LimitedFilteredRequest, scope: QueryScope = {}) {
        const organization = Context.organization!;
        const table = WebshopDiscountCode.table;

        const query = SQL
            .select(SQL.wildcard(table))
            .from(SQL.table(table))
            .where(await compileToSQLFilter({
                organizationId: organization.id,
            }, filterCompilers));

        if (scope.webshopId) {
            query.where(await compileToSQLFilter({
                webshopId: scope.webshopId,
            }, filterCompilers));
        }

        if (q.filter) {
            query.where(await compileToSQLFilter(q.filter, filterCompilers));
        }

        if (q.search) {
            const searchFilter = getDiscountCodeSearchFilter(q.search);

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

    static async buildData(requestQuery: LimitedFilteredRequest, scope: QueryScope = {}) {
        const query = await this.buildQuery(requestQuery, scope);
        const data = await query.fetch();

        const discountCodes = WebshopDiscountCode.fromRows(data, WebshopDiscountCode.table);

        let next: LimitedFilteredRequest | undefined;

        if (discountCodes.length >= requestQuery.limit) {
            const lastObject = discountCodes[discountCodes.length - 1];
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

        return new PaginatedResponse<DiscountCode[], LimitedFilteredRequest>({
            results: discountCodes.map(d => d.getStructure()),
            next,
        });
    }

    async handle(request: DecodedRequest<Params, Query, Body>) {
        const organization = await Context.setOrganizationScope();
        await Context.authenticate();

        // Fast throw first (more in depth checking for patches later)
        if (!await Context.auth.hasSomeAccess(organization.id)) {
            throw Context.auth.error();
        }

        const webshop = await Webshop.getByID(request.params.id);
        if (!webshop || !await Context.auth.canAccessWebshop(webshop, PermissionLevel.Full)) {
            throw Context.auth.notFoundOrNoAccess();
        }

        LimitedFilteredRequestHelper.throwIfInvalidLimit({
            request: request.query,
            maxLimit: Context.auth.hasSomePlatformAccess() ? 1000 : 100,
        });

        return new Response(
            await GetWebshopDiscountCodesEndpoint.buildData(request.query, { webshopId: webshop.id }),
        );
    }
}

function getDiscountCodeSearchFilter(search: string | null): StamhoofdFilter | null {
    if (search === null || search === undefined) {
        return null;
    }

    return {
        $or: [
            {
                code: {
                    $contains: search,
                },
            },
            {
                description: {
                    $contains: search,
                },
            },
            {
                email: {
                    $contains: search,
                },
            },
        ],
    };
}
