import type { Decoder } from '@common/encoding';
import type { DecodedRequest, Request } from '@node/endpoints';
import { Endpoint, Response } from '@node/endpoints';
import { SimpleError } from '@common/errors';
import { Order, Organization, Webshop } from '@stamhoofd/models';
import { SQL, SQLAlias, SQLCount, SQLSelectAs, applySQLSorter, compileToSQLFilter } from '@stamhoofd/sql';
import type { CountFilteredRequest, StamhoofdFilter } from '@stamhoofd/structures';
import { PermissionLevel } from '@stamhoofd/types/PermissionLevel';
import { LimitedFilteredRequest, OrderStatus, PaginatedResponse, WebshopWithOrganization, assertSort, getSortFilter } from '@stamhoofd/structures';

import type { SQLResultNamespacedRow } from '@node/database';
import { Formatter } from '@stamhoofd/utility';
import { AuthenticatedStructures } from '../../../helpers/AuthenticatedStructures.js';
import { Context } from '../../../helpers/Context.js';
import { webshopFilterCompilers } from '../../../sql-filters/webshops.js';
import { webshopSorters } from '../../../sql-sorters/webshops.js';

type Params = Record<string, never>;
type Query = LimitedFilteredRequest;
type Body = undefined;
type ResponseBody = PaginatedResponse<WebshopWithOrganization[], LimitedFilteredRequest>;

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
            if (!await Context.auth.hasSomeAccess(organization.id)) {
                throw Context.auth.error();
            }

            // Organization context: scope to this organization's webshops only
            const scopeFilter: StamhoofdFilter = {
                organizationId: {
                    $eq: organization.id,
                },
            };
            query.where(await compileToSQLFilter(scopeFilter, filterCompilers));
        } else {
            // Platform context: check platform access
            const tags = Context.auth.getPlatformAccessibleOrganizationTags(PermissionLevel.Read);

            if (tags !== 'all' && tags.length === 0) {
                throw Context.auth.error();
            }

            if (tags !== 'all') {
                const tagScopeFilter: StamhoofdFilter = {
                    organization: {
                        tags: {
                            $in: tags,
                        },
                    },
                };
                query.where(await compileToSQLFilter(tagScopeFilter, filterCompilers));
            }
        }

        if (q.filter) {
            query.where(await compileToSQLFilter(q.filter, filterCompilers));
        }

        if (q.search) {
            const searchFilter: StamhoofdFilter = {
                $or: [
                    {
                        name: {
                            $contains: q.search,
                        },
                    },
                ],
            };
            query.where(await compileToSQLFilter(searchFilter, filterCompilers));
        }

        if (q instanceof LimitedFilteredRequest) {
            if (q.pageFilter) {
                query.where(await compileToSQLFilter(q.pageFilter, filterCompilers));
            }

            q.sort = assertSort(q.sort, [{ key: 'id' }]);
            await applySQLSorter(query, q.sort, sorters);
            query.limit(q.limit);
        }

        return query;
    }

    /**
     * Counts the orders per webshop, excluding deleted orders (same as the orders list of a webshop)
     */
    static async getOrderCounts(webshopIds: string[]): Promise<Map<string, number>> {
        const counts = new Map<string, number>();
        if (webshopIds.length === 0) {
            return counts;
        }

        const rows = await SQL
            .select(
                SQL.column(Order.table, 'webshopId'),
                new SQLSelectAs(
                    new SQLCount(),
                    new SQLAlias('data__count'),
                ),
            )
            .setMaxExecutionTime(15 * 1000)
            .from(SQL.table(Order.table))
            .where('webshopId', webshopIds)
            .whereNot('number', null)
            .whereNot('status', OrderStatus.Deleted)
            .groupBy(SQL.column(Order.table, 'webshopId'))
            .fetch();

        for (const row of rows) {
            counts.set(row[Order.table]['webshopId'] as string, row['data']['count'] as number);
        }
        return counts;
    }

    static async buildData(requestQuery: LimitedFilteredRequest): Promise<PaginatedResponse<WebshopWithOrganization[], LimitedFilteredRequest>> {
        const query = await GetWebshopsEndpoint.buildQuery(requestQuery);
        let data: SQLResultNamespacedRow[];

        try {
            data = await query.fetch();
        } catch (error) {
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

        // Batch-load organizations for accessible webshops
        const organizationIds = Formatter.uniqueArray(accessibleWebshops.map(w => w.organizationId));
        const organizationModels = organizationIds.length > 0 ? await Organization.getByIDs(...organizationIds) : [];

        // Only the webshops overview of the administration portal shows the order counts. The endpoint is
        // also used in organization context (e.g. to pick a webshop in filters), where we skip the extra query.
        const orderCounts = Context.organization ? null : await GetWebshopsEndpoint.getOrderCounts(accessibleWebshops.map(w => w.id));

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

        const results: WebshopWithOrganization[] = [];
        for (const webshop of accessibleWebshops) {
            const organizationModel = organizationModels.find(o => o.id === webshop.organizationId);
            if (!organizationModel) {
                // Skip webshops whose organization cannot be found
                console.warn('Organization not found for webshop', webshop.id, webshop.organizationId);
                continue;
            }

            const webshopStruct = await AuthenticatedStructures.webshopPreview(webshop);
            results.push(WebshopWithOrganization.create({
                webshop: webshopStruct,
                organization: organizationModel.getBaseStructure(),
                orderCount: orderCounts ? (orderCounts.get(webshop.id) ?? 0) : null,
            }));
        }

        return new PaginatedResponse<WebshopWithOrganization[], LimitedFilteredRequest>({
            results,
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
