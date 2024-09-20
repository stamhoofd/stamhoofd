/* eslint-disable @typescript-eslint/no-unsafe-argument */
import { Decoder } from '@simonbackx/simple-encoding';
import { DecodedRequest, Endpoint, Request, Response } from '@simonbackx/simple-endpoints';
import { SimpleError } from '@simonbackx/simple-errors';
import { Organization } from '@stamhoofd/models';
import { SQL, compileToSQLFilter, compileToSQLSorter } from "@stamhoofd/sql";
import { CountFilteredRequest, LimitedFilteredRequest, Organization as OrganizationStruct, PaginatedResponse, PermissionLevel, StamhoofdFilter, assertSort, getSortFilter } from '@stamhoofd/structures';

import { AuthenticatedStructures } from '../../../helpers/AuthenticatedStructures';
import { Context } from '../../../helpers/Context';
import { organizationFilterCompilers } from '../../../sql-filters/organizations';
import { organizationSorters } from '../../../sql-sorters/organizations';

type Params = Record<string, never>;
type Query = LimitedFilteredRequest;
type Body = undefined;
type ResponseBody = PaginatedResponse<OrganizationStruct[], LimitedFilteredRequest>

const sorters = organizationSorters
const filterCompilers = organizationFilterCompilers

export class GetOrganizationsEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    queryDecoder = LimitedFilteredRequest as Decoder<LimitedFilteredRequest>

    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method != "GET") {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, "/admin/organizations", {});

        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    static buildQuery(q: CountFilteredRequest|LimitedFilteredRequest) {
        const tags = Context.auth.getPlatformAccessibleOrganizationTags(PermissionLevel.Read)
        if (tags != 'all' && tags.length === 0) {
            throw Context.auth.error()
        }

        let scopeFilter: StamhoofdFilter|undefined = undefined;

        if (tags !== 'all') {
            // Add organization scope filter
            scopeFilter = {
                tags: {
                    $in: tags
                }
            };
        }
        
        const query = SQL
            .select(
                SQL.wildcard('organizations')
            )
            .from(
                SQL.table('organizations')
            );
            
        if (scopeFilter) {
            query.where(compileToSQLFilter(scopeFilter, filterCompilers))
        }

        if (q.filter) {
            query.where(compileToSQLFilter(q.filter, filterCompilers))
        }

        if (q.search) {
            let searchFilter: StamhoofdFilter|null = null

            // todo: auto detect e-mailaddresses and search on admins
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

            q.sort = assertSort(q.sort, [{key: 'id'}])
            query.orderBy(compileToSQLSorter(q.sort, sorters))
            query.limit(q.limit)
        }
       
        return query
    }

    async handle(request: DecodedRequest<Params, Query, Body>) {
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
        
        const data = await GetOrganizationsEndpoint.buildQuery(request.query).fetch()
        const organizations = Organization.fromRows(data, 'organizations');

        let next: LimitedFilteredRequest|undefined;

        if (organizations.length >= request.query.limit) {
            const lastObject = organizations[organizations.length - 1];
            const nextFilter = getSortFilter(lastObject, sorters, request.query.sort);

            next = new LimitedFilteredRequest({
                filter: request.query.filter,
                pageFilter: nextFilter,
                sort: request.query.sort,
                limit: request.query.limit,
                search: request.query.search
            })

            if (JSON.stringify(nextFilter) === JSON.stringify(request.query.pageFilter)) {
                console.error('Found infinite loading loop for', request.query);
                next = undefined;
            }
        }

        return new Response(
            new PaginatedResponse<OrganizationStruct[], LimitedFilteredRequest>({
                results: await AuthenticatedStructures.organizations(organizations),
                next
            })
        );
    }
}
