import { DecodedRequest, Endpoint, Request, Response } from '@simonbackx/simple-endpoints';
import { Organization, User } from '@stamhoofd/models';
import { CountFilteredRequest, LimitedFilteredRequest, MemberSummary, OrganizationOverview, OrganizationStats, PaginatedResponse, StamhoofdFilter, User as UserStruct, getSortFilter } from '@stamhoofd/structures';

import { AdminToken } from '../../models/AdminToken';
import { Statistic } from '../../models/Statistic';
import { SQL, SQLConcat, SQLFilterDefinitions, SQLNow, SQLNull, SQLOrderBy, SQLOrderByDirection, SQLScalar, SQLSortDefinitions, SQLWhereEqual, SQLWhereOr, SQLWhereSign, baseSQLFilterCompilers, compileToSQLFilter, compileToSQLSorter, createSQLColumnFilterCompiler, createSQLExpressionFilterCompiler, createSQLRelationFilterCompiler } from '@stamhoofd/sql';
import { DataValidator, Formatter, Sorter } from '@stamhoofd/utility';
import { SimpleError } from '@simonbackx/simple-errors';
import { Decoder } from '@simonbackx/simple-encoding';

type Params = Record<string, never>;
type Query = LimitedFilteredRequest;
type Body = undefined;
type ResponseBody = PaginatedResponse<OrganizationOverview, LimitedFilteredRequest>

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
    users: createSQLRelationFilterCompiler(
        SQL.select().from(
            SQL.table('users')
        ).where(
            SQL.column('organizationId'),
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
            "email": createSQLColumnFilterCompiler('email'),
            "permissions": createSQLColumnFilterCompiler('permissions')
        }
    ),
}

const sorters: SQLSortDefinitions<OrganizationOverview> = {
    'id': {
        getValue(a) {
            return a.id
        },
        sort: (a, b) => {
            return Sorter.byStringValue(a.id, b.id);
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
        sort: (a, b) => {
            return Sorter.byStringValue(a.name, b.name);
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
            return a.type
        },
        sort: (a, b) => {
            return Sorter.byStringValue(a.type, b.type);
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
        sort: (a, b) => {
            return Sorter.byStringValue(a.address.city, b.address.city);
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
        sort: (a, b) => {
            return Sorter.byStringValue(a.address.country, b.address.country);
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

        const params = Endpoint.parseParameters(request.url, "/organizations", {});

        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    static buildQuery(q: CountFilteredRequest|LimitedFilteredRequest) {
        const query = SQL
            .select(
                SQL.wildcard()
            )
            .from(
                SQL.table('organizations')
            );
        
        if (q.filter) {
            query.where(compileToSQLFilter(q.filter, filterCompilers))
        }

        if (q.search) {
            let searchFilter: StamhoofdFilter|null = null

            // todo: email address detection
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
        await AdminToken.authenticate(request);

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
        const admins = await User.getAdmins(organizations.map(o => o.id))

        // Stats
        const start = new Date()
        start.setDate(start.getDate() - 60)

        const end = new Date()
        end.setDate(end.getDate() + 1)
        const stats = organizations.length > 0 ? (await Statistic.buildTimeAggregation(organizations.map(o => o.id), start, end)) : []

        const results: OrganizationOverview[] = [];

        for (const o of organizations) {
            const features = [
                ...(await o.getConnectedPaymentProviders()).map(p => p.toString()),
            ];

            results.push(
                OrganizationOverview.create({
                    ...o,
                    type: o.meta.type,
                    umbrellaOrganization: o.meta.umbrellaOrganization,
                    packages: o.meta.packages,
                    emails: o.privateMeta.emails,
                    admins: admins.filter(admin => admin.organizationId === o.id).map(a => UserStruct.create({...a, hasAccount: a.hasAccount()})),
                    stats: OrganizationStats.create(stats.find(s => s.organizationId == o.id) ?? new Statistic()),
                    features,
                    acquisitionTypes: o.privateMeta.acquisitionTypes,
                })
            )
        }

        let next: LimitedFilteredRequest|undefined;

        if (results.length >= request.query.limit) {
            const lastObject = results[results.length - 1];
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
            new PaginatedResponse<OrganizationOverview, LimitedFilteredRequest>({
                results,
                next
            })
        );    
    }
}
