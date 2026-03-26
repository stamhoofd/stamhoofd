import type { Decoder } from '@simonbackx/simple-encoding';
import type { DecodedRequest, Request } from '@simonbackx/simple-endpoints';
import { Endpoint, Response } from '@simonbackx/simple-endpoints';
import { SimpleError } from '@simonbackx/simple-errors';
import { Webshop } from '@stamhoofd/models';
import { SQL, applySQLSorter, compileToSQLFilter } from '@stamhoofd/sql';
import type { CountFilteredRequest, StamhoofdFilter, Webshop as WebshopStruct } from '@stamhoofd/structures';
import { LimitedFilteredRequest, PaginatedResponse, PermissionLevel, assertSort, getSortFilter } from '@stamhoofd/structures';

import type { SQLResultNamespacedRow } from '@simonbackx/simple-database';
import { AuthenticatedStructures } from '../../../helpers/AuthenticatedStructures.js';
import { Context } from '../../../helpers/Context.js';
import { organizationFilterCompilers } from '../../../sql-filters/organizations.js';
import { webshopFilterCompilers } from '../../../sql-filters/webshops.js';
import { webshopSorters } from '../../../sql-sorters/webshops.js';

type Params = Record<string, never>;
type Query = LimitedFilteredRequest;
type Body = undefined;
type ResponseBody = PaginatedResponse<WebshopStruct[], LimitedFilteredRequest>;

const sorters = webshopSorters;
const filterCompilers = webshopFilterCompilers;

export class GetWebshopsEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    queryDecoder = LimitedFilteredRequest as Decoder<LimitedFilteredRequest>;

    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method !== 'GET') {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, '/webshops', {});

        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    static async buildQuery(q: CountFilteredRequest | LimitedFilteredRequest) {
        const organization = Context.organization;

        const query = SQL
            .select(
                SQL.wildcard('webshops'),
            )
            .setMaxExecutionTime(15 * 1000)
            .from(
                SQL.table('webshops'),
            );

        if (organization) {
            // Organization context: scope to this organization's webshops only
            const scopeFilter: StamhoofdFilter = {
                organizationId: {
                    $eq: organization.id,
                },
            };
            query.where(await compileToSQLFilter(scopeFilter, filterCompilers));
        }
        else {
            // Platform context: check platform access
            const tags = Context.auth.getPlatformAccessibleOrganizationTags(PermissionLevel.Read);

            if (tags !== 'all' && tags.length === 0) {
                throw Context.auth.error();
            }

            if (tags !== 'all') {
                // Join with organizations table to filter by accessible organization tags
                query.join(
                    SQL.join(SQL.table('organizations'))
                        .where(
                            SQL.column('webshops', 'organizationId'),
                            SQL.column('organizations', 'id'),
                        ),
                );

                // Apply tag scope filter using the organizations filter compiler
                const tagScopeFilter: StamhoofdFilter = {
                    tags: {
                        $in: tags,
                    },
                };
                query.where(await compileToSQLFilter(tagScopeFilter, organizationFilterCompilers));
            }
        }

        if (q.filter) {
            query.where(await compileToSQLFilter(q.filter, filterCompilers));
        }

        if (q.search) {
            const searchFilter: StamhoofdFilter = {
                name: {
                    $contains: q.search,
                },
            };
            query.where(await compileToSQLFilter(searchFilter, filterCompilers));
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

    static async buildData(requestQuery: LimitedFilteredRequest): Promise<PaginatedResponse<WebshopStruct[], LimitedFilteredRequest>> {
        const query = await GetWebshopsEndpoint.buildQuery(requestQuery);
        let data: SQLResultNamespacedRow[];

        try {
            data = await query.fetch();
        }
        catch (error) {
            if (error.message.includes('ER_QUERY_TIMEOUT')) {
                throw new SimpleError({
                    code: 'timeout',
                    message: 'Query took too long',
                    human: $t(`%Cv`),
                });
            }
            throw error;
        }

        const webshops = Webshop.fromRows(data, 'webshops');

        // Filter out webshops the user cannot access (e.g. specific resource-level permissions)
        const accessibleWebshops: Webshop[] = [];
        for (const webshop of webshops) {
            if (await Context.auth.canAccessWebshop(webshop, PermissionLevel.Read)) {
                accessibleWebshops.push(webshop);
            }
        }

        let next: LimitedFilteredRequest | undefined;

        if (webshops.length >= requestQuery.limit) {
            const lastObject = webshops[webshops.length - 1];
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

        return new PaginatedResponse<WebshopStruct[], LimitedFilteredRequest>({
            results: await Promise.all(accessibleWebshops.map(w => AuthenticatedStructures.webshop(w))),
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
            await GetWebshopsEndpoint.buildData(request.query),
        );
    }
}
