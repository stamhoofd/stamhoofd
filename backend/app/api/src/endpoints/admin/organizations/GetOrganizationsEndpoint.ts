import { Decoder } from '@simonbackx/simple-encoding';
import { DecodedRequest, Endpoint, Request, Response } from '@simonbackx/simple-endpoints';
import { SimpleError } from '@simonbackx/simple-errors';
import { Organization } from '@stamhoofd/models';
import { SQL, applySQLSorter, compileToSQLFilter } from '@stamhoofd/sql';
import { CountFilteredRequest, LimitedFilteredRequest, Organization as OrganizationStruct, PaginatedResponse, PermissionLevel, StamhoofdFilter, assertSort, getSortFilter } from '@stamhoofd/structures';

import { SQLResultNamespacedRow } from '@simonbackx/simple-database';
import { AuthenticatedStructures } from '../../../helpers/AuthenticatedStructures.js';
import { Context } from '../../../helpers/Context.js';
import { organizationFilterCompilers } from '../../../sql-filters/organizations.js';
import { organizationSorters } from '../../../sql-sorters/organizations.js';

type Params = Record<string, never>;
type Query = LimitedFilteredRequest;
type Body = undefined;
type ResponseBody = PaginatedResponse<OrganizationStruct[], LimitedFilteredRequest>;

const sorters = organizationSorters;
const filterCompilers = organizationFilterCompilers;

export class GetOrganizationsEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    queryDecoder = LimitedFilteredRequest as Decoder<LimitedFilteredRequest>;

    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method !== 'GET') {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, '/admin/organizations', {});

        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    static async buildQuery(q: CountFilteredRequest | LimitedFilteredRequest) {
        const tags = Context.auth.getPlatformAccessibleOrganizationTags(PermissionLevel.Read);
        if (tags !== 'all' && tags.length === 0) {
            throw Context.auth.error();
        }

        let scopeFilter: StamhoofdFilter | undefined = undefined;

        if (tags !== 'all') {
            // Add organization scope filter
            scopeFilter = {
                tags: {
                    $in: tags,
                },
            };
        }

        const query = SQL
            .select(
                SQL.wildcard('organizations'),
            )
            .setMaxExecutionTime(15 * 1000)
            .from(
                SQL.table('organizations'),
            );

        if (scopeFilter) {
            query.where(await compileToSQLFilter(scopeFilter, filterCompilers));
        }

        if (q.filter) {
            query.where(await compileToSQLFilter(q.filter, filterCompilers));
        }

        if (q.search) {
            let searchFilter: StamhoofdFilter | null = null;

            // todo: auto detect e-mailaddresses and search on admins
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

        console.log('GetOrganizationsEndpoint query', query.getSQL());

        return query;
    }

    static async buildData(requestQuery: LimitedFilteredRequest): Promise<PaginatedResponse<OrganizationStruct[], LimitedFilteredRequest>> {
        const maxLimit = Context.auth.hasSomePlatformAccess() ? 1000 : 100;

        if (requestQuery.limit > maxLimit) {
            throw new SimpleError({
                code: 'invalid_field',
                field: 'limit',
                message: 'Limit can not be more than ' + maxLimit,
            });
        }

        if (requestQuery.limit < 1) {
            throw new SimpleError({
                code: 'invalid_field',
                field: 'limit',
                message: 'Limit can not be less than 1',
            });
        }

        const query = await GetOrganizationsEndpoint.buildQuery(requestQuery);
        let data: SQLResultNamespacedRow[];

        try {
            data = await query.fetch();
        }
        catch (error) {
            if (error.message.includes('ER_QUERY_TIMEOUT')) {
                throw new SimpleError({
                    code: 'timeout',
                    message: 'Query took too long',
                    human: $t(`dce51638-6129-448b-8a15-e6d778f3a76a`),
                });
            }
            throw error;
        }

        const organizations = Organization.fromRows(data, 'organizations');

        let next: LimitedFilteredRequest | undefined;

        if (organizations.length >= requestQuery.limit) {
            const lastObject = organizations[organizations.length - 1];
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

        return new PaginatedResponse<OrganizationStruct[], LimitedFilteredRequest>({
            results: await AuthenticatedStructures.organizations(organizations),
            next,
        });
    }

    async handle(request: DecodedRequest<Params, Query, Body>) {
        await Context.authenticate();

        const paginatedResponse = await GetOrganizationsEndpoint.buildData(request.query);

        return new Response(paginatedResponse);
    }
}
