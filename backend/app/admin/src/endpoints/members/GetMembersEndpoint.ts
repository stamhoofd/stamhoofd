import { DecodedRequest, Endpoint, Request, Response } from '@simonbackx/simple-endpoints';
import { CountFilteredRequest, GroupStatus, LimitedFilteredRequest, MemberSummary, PaginatedResponse, StamhoofdFilter, getSortFilter } from '@stamhoofd/structures';

import { Decoder } from '@simonbackx/simple-encoding';
import { SimpleError } from '@simonbackx/simple-errors';
import { Member, Organization } from '@stamhoofd/models';
import { SQL, SQLConcat, SQLFilterDefinitions, SQLOrderBy, SQLOrderByDirection, SQLScalar, SQLSortDefinitions, SQLWhereSign, baseSQLFilterCompilers, compileToSQLFilter, compileToSQLSorter, createSQLColumnFilterCompiler, createSQLExpressionFilterCompiler, createSQLFilterNamespace, createSQLRelationFilterCompiler } from "@stamhoofd/sql";
import { DataValidator, Formatter, Sorter } from '@stamhoofd/utility';
import { AdminToken } from '../../models/AdminToken';

type Params = Record<string, never>;
type Query = LimitedFilteredRequest;
type Body = undefined;
type ResponseBody = PaginatedResponse<MemberSummary, LimitedFilteredRequest>

const filterCompilers: SQLFilterDefinitions = {
    ...baseSQLFilterCompilers,
    id: createSQLColumnFilterCompiler('id'),
    name: createSQLExpressionFilterCompiler(
        new SQLConcat(
            SQL.column('firstName'),
            new SQLScalar(' '),
            SQL.column('lastName'),
        )
    ),
    birthDay: createSQLColumnFilterCompiler('birthDay', (d) => {
        if (typeof d === 'number') {
            const date = new Date(d)
            return Formatter.dateIso(date);
        }
        return d;
    }),
    organizationName: createSQLExpressionFilterCompiler(
        SQL.column('organizations', 'name')
    ),

    email: createSQLExpressionFilterCompiler(
        SQL.jsonValue(SQL.column('details'), '$.value.email'),
        undefined,
        true,
        false
    ),

    parentEmail: createSQLExpressionFilterCompiler(
        SQL.jsonValue(SQL.column('details'), '$.value.parents[*].email'),
        undefined,
        true,
        true
    ),

    registrations: createSQLRelationFilterCompiler(
        SQL.select().from(
            SQL.table('registrations')
        ).join(
            SQL.join(
                SQL.table('groups')
            ).where(
                SQL.column('groups', 'id'),
                SQL.column('registrations', 'groupId')
            )
        ).where(
            SQL.column('memberId'),
            SQL.column('members', 'id'),
        ).where(
            SQL.column('memberId'),
            SQL.column('members', 'id'),
        ).whereNot(
            SQL.column('registeredAt'),
            null,
        ).whereNot(
            SQL.column('groups', 'status'),
            GroupStatus.Archived
        ).where(
            SQL.column('registrations', 'cycle'),
            SQL.column('groups', 'cycle'),
        ),

        {
            ...baseSQLFilterCompilers,
            "price": createSQLColumnFilterCompiler('price'),
            "pricePaid": createSQLColumnFilterCompiler('pricePaid'),
            "waitingList": createSQLColumnFilterCompiler('waitingList'),
            "canRegister": createSQLColumnFilterCompiler('canRegister'),
            "cycle": createSQLColumnFilterCompiler('cycle'),

            "group": createSQLFilterNamespace({
                ...baseSQLFilterCompilers,
                name: createSQLExpressionFilterCompiler(
                    SQL.jsonValue(SQL.column('groups', 'settings'), '$.value.name')
                ),
            })
        }
    ),
}

const sorters: SQLSortDefinitions<MemberSummary> = {
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
            return SQLOrderBy.combine([
                new SQLOrderBy({
                    column: SQL.column('firstName'),
                    direction
                }),
                new SQLOrderBy({
                    column: SQL.column('lastName'),
                    direction
                })
            ])
        }
    },
    'birthDay': {
        getValue(a) {
            return a.birthDay?.getTime() ?? 0
        },
        sort: (a, b) => {
            return Sorter.byNumberValue(b.birthDay?.getTime() ?? 0, a.birthDay?.getTime() ?? 0);
        },
        toSQL: (direction: SQLOrderByDirection): SQLOrderBy => {
            return new SQLOrderBy({
                column: SQL.column('birthDay'),
                direction
            })
        }
    },
    'organizationName': {
        getValue(a) {
            return a.organizationName
        },
        sort: (a, b) => {
            return Sorter.byStringValue(b.organizationName, a.organizationName);
        },
        toSQL: (direction: SQLOrderByDirection): SQLOrderBy => {
            return new SQLOrderBy({
                column: SQL.column('organizations', 'name'),
                direction
            })
        }
    },
    'email': {
        getValue(a) {
            return a.email
        },
        sort: (a, b) => {
            return Sorter.byStringValue(b.email ?? '', a.email ?? '');
        },
        toSQL: (direction: SQLOrderByDirection): SQLOrderBy => {
            return new SQLOrderBy({
                column: SQL.jsonValue(SQL.column('details'), '$.value.email'),
                direction
            })
        }
    },
}

export class GetMembersEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    queryDecoder = LimitedFilteredRequest as Decoder<LimitedFilteredRequest>

    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method != "GET") {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, "/members", {});

        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    static buildQuery(q: CountFilteredRequest|LimitedFilteredRequest) {
        const query = SQL
            .select(
                SQL.wildcard('members'),
                SQL.column('organizations', 'id'),
                SQL.column('organizations', 'name'),
            )
            .from(
                SQL.table('members')
            )
            .join(
                SQL.leftJoin(
                    SQL.table('organizations')
                ).where(
                    SQL.column('organizations', 'id'),
                    SQL.column('members', 'organizationId')
                )
            )
        
        if (q.filter) {
            query.where(compileToSQLFilter(q.filter, filterCompilers))
        }


        if (q.search) {
            let searchFilter: StamhoofdFilter|null = null

            // Two search modes:
            // e-mail or name based searching
            if (q.search.includes('@')) {
                const isCompleteAddress = DataValidator.isEmailValid(q.search);

                // Member email address contains, or member parent contains
                searchFilter = {
                    '$or': [
                        {
                            email: {
                                [(isCompleteAddress ? '$eq' : '$contains') as '$eq' | '$contains']: q.search
                            }
                        },
                        {
                            parentEmail: {
                                [(isCompleteAddress ? '$eq' : '$contains') as '$eq' | '$contains']: q.search
                            }
                        }
                    ]
                } as any as StamhoofdFilter
            } else {
                searchFilter = {
                    name: {
                        $contains: q.search
                    }
                }
            }

            // todo: Address search detection
            // todo: Phone number search detection

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
        
        const data = await GetMembersEndpoint.buildQuery(request.query).fetch()
        
        const members = Member.fromRows(data, 'members');
        const organizations = Organization.fromRows(data, 'organizations');

        const memberStructures = members.map(m => MemberSummary.create({
            id: m.id,
            organizationName: organizations.find(o => o.id == m.organizationId)?.name ?? "Onbekend",
            organizationId: m.organizationId,
            ...m.details
        }));
        
        let next: LimitedFilteredRequest|undefined;

        if (memberStructures.length >= request.query.limit) {
            const lastObject = memberStructures[memberStructures.length - 1];
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
            new PaginatedResponse<MemberSummary, LimitedFilteredRequest>({
                results: memberStructures,
                next
            })
        );
    }
}
