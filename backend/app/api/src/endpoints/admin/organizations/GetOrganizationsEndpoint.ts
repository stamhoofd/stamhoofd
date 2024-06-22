/* eslint-disable @typescript-eslint/no-unsafe-argument */
import { Decoder } from '@simonbackx/simple-encoding';
import { DecodedRequest, Endpoint, Request, Response } from '@simonbackx/simple-endpoints';
import { SimpleError } from '@simonbackx/simple-errors';
import { Organization } from '@stamhoofd/models';
import { SQL, SQLConcat, SQLFilterDefinitions, SQLNow, SQLNull, SQLOrderBy, SQLOrderByDirection, SQLScalar, SQLSortDefinitions, SQLWhereEqual, SQLWhereOr, SQLWhereSign, baseSQLFilterCompilers, compileToSQLFilter, compileToSQLSorter, createSQLColumnFilterCompiler, createSQLExpressionFilterCompiler, createSQLRelationFilterCompiler } from "@stamhoofd/sql";
import { CountFilteredRequest, LimitedFilteredRequest, Organization as OrganizationStruct, PaginatedResponse, StamhoofdFilter, getSortFilter } from '@stamhoofd/structures';

import { AuthenticatedStructures } from '../../../helpers/AuthenticatedStructures';
import { Context } from '../../../helpers/Context';

type Params = Record<string, never>;
type Query = LimitedFilteredRequest;
type Body = undefined;
type ResponseBody = PaginatedResponse<OrganizationStruct[], LimitedFilteredRequest>

const filterCompilers: SQLFilterDefinitions = {
    ...baseSQLFilterCompilers,
    id: createSQLColumnFilterCompiler('id'),
    name: createSQLColumnFilterCompiler('name'),
    city: createSQLExpressionFilterCompiler(
        SQL.jsonValue(SQL.column('address'), '$.value.city'),
        undefined,
        true,
        false
    ),
    country: createSQLExpressionFilterCompiler(
        SQL.jsonValue(SQL.column('address'), '$.value.country'),
        undefined,
        true,
        false
    ),
    umbrellaOrganization: createSQLExpressionFilterCompiler(
        SQL.jsonValue(SQL.column('meta'), '$.value.umbrellaOrganization'),
        undefined,
        true,
        false
    ),
    type: createSQLExpressionFilterCompiler(
        SQL.jsonValue(SQL.column('meta'), '$.value.type'),
        undefined,
        true,
        false
    ),
    tags: createSQLExpressionFilterCompiler(
        SQL.jsonValue(SQL.column('meta'), '$.value.tags'),
        undefined,
        true,
        true
    ),
    packages: createSQLRelationFilterCompiler(
        SQL.select().from(
            SQL.table('stamhoofd_packages')
        ).where(
            SQL.column('organizationId'),
            SQL.column('organizations', 'id'),
        )
        .andWhere(
            SQL.column('validAt'),
            SQLWhereSign.NotEqual,
            new SQLNull()
        ).andWhere(
            new SQLWhereOr([
                new SQLWhereEqual(
                    SQL.column('validUntil'),
                    SQLWhereSign.Equal,
                    new SQLNull()
                ),
                new SQLWhereEqual(
                    SQL.column('validUntil'),
                    SQLWhereSign.Greater,
                    new SQLNow()
                )
            ])
        ).andWhere(
            new SQLWhereOr([
                new SQLWhereEqual(
                    SQL.column('removeAt'),
                    SQLWhereSign.Equal,
                    new SQLNull()
                ),
                new SQLWhereEqual(
                    SQL.column('removeAt'),
                    SQLWhereSign.Greater,
                    new SQLNow()
                )
            ])
        ),

        // const pack1 = await STPackage.where({ organizationId, validAt: { sign: "!=", value: null }, removeAt: { sign: ">", value: new Date() }})
        // const pack2 = await STPackage.where({ organizationId, validAt: { sign: "!=", value: null }, removeAt: null })
        {
            ...baseSQLFilterCompilers,
            "type": createSQLExpressionFilterCompiler(
                SQL.jsonValue(SQL.column('meta'), '$.value.type'),
                undefined,
                true,
                false
            )
        }
    ),
    members: createSQLRelationFilterCompiler(
        SQL.select().from(
            SQL.table('members')
        ).join(
            SQL.join(
                SQL.table('registrations')
            ).where(
                SQL.column('members', 'id'),
                SQL.column('registrations', 'memberId')
            )
        ).where(
            SQL.column('registrations', 'organizationId'),
            SQL.column('organizations', 'id'),
        ),

        {
            ...baseSQLFilterCompilers,
            name: createSQLExpressionFilterCompiler(
                new SQLConcat(
                    SQL.column('firstName'),
                    new SQLScalar(' '),
                    SQL.column('lastName'),
                )
            ),
            "firstName": createSQLColumnFilterCompiler('firstName'),
            "lastName": createSQLColumnFilterCompiler('lastName'),
            "email": createSQLColumnFilterCompiler('email')
        }
    ),
}

const sorters: SQLSortDefinitions<Organization> = {
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
    'type': {
        getValue(a) {
            return a.meta.type
        },
        toSQL: (direction: SQLOrderByDirection): SQLOrderBy => {
            return new SQLOrderBy({
                column: SQL.jsonValue(SQL.column('meta'), '$.value.type'),
                direction
            })
        }
    },
    'city': {
        getValue(a) {
            return a.address.city
        },
        toSQL: (direction: SQLOrderByDirection): SQLOrderBy => {
            return new SQLOrderBy({
                column: SQL.jsonValue(SQL.column('address'), '$.value.city'),
                direction
            })
        }
    },
    'country': {
        getValue(a) {
            return a.address.country
        },
        toSQL: (direction: SQLOrderByDirection): SQLOrderBy => {
            return new SQLOrderBy({
                column: SQL.jsonValue(SQL.column('address'), '$.value.country'),
                direction
            })
        }
    }
}

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
        if (!Context.auth.hasPlatformFullAccess()) {
            throw new SimpleError({
                code: 'not_implemented',
                message: 'Listing organizations without full permissions is not yet implemented'
            })
        }

        const scopeFilter: StamhoofdFilter|undefined = undefined;

        // todo: add filter protection if no full access
        // if (organization) {
        //     // Add organization scope filter
        //     scopeFilter = {
        //         activeRegistrations: {
        //             $elemMatch: {
        //                 organizationId: organization.id
        //             }
        //         }
        //     };
        // }
        
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

            query.orderBy(compileToSQLSorter(q.sort, sorters))
            query.limit(q.limit)
        }
       
        return query
    }

    async handle(request: DecodedRequest<Params, Query, Body>) {
        await Context.authenticate()

        if (request.query.limit > 100) {
            throw new SimpleError({
                code: 'invalid_field',
                field: 'limit',
                message: 'Limit can not be more than 100'
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
                results: await AuthenticatedStructures.adminOrganizations(organizations),
                next
            })
        );
    }
}
