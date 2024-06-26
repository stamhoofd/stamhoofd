/* eslint-disable @typescript-eslint/no-unsafe-argument */
import { Decoder } from '@simonbackx/simple-encoding';
import { DecodedRequest, Endpoint, Request, Response } from '@simonbackx/simple-endpoints';
import { SimpleError } from '@simonbackx/simple-errors';
import { Member, MemberWithRegistrations } from '@stamhoofd/models';
import { SQL, SQLAge, SQLConcat, SQLFilterDefinitions, SQLOrderBy, SQLOrderByDirection, SQLScalar, SQLSortDefinitions, baseSQLFilterCompilers, compileToSQLFilter, compileToSQLSorter, createSQLColumnFilterCompiler, createSQLExpressionFilterCompiler, createSQLFilterNamespace, createSQLRelationFilterCompiler, joinSQLQuery } from "@stamhoofd/sql";
import { CountFilteredRequest, GroupStatus, LimitedFilteredRequest, MembersBlob, PaginatedResponse, PermissionLevel, StamhoofdFilter, getSortFilter } from '@stamhoofd/structures';
import { DataValidator, Formatter } from '@stamhoofd/utility';

import { AuthenticatedStructures } from '../../../helpers/AuthenticatedStructures';
import { Context } from '../../../helpers/Context';
import { filterCompilers as organizationFilterCompilers } from '../../admin/organizations/GetOrganizationsEndpoint';

type Params = Record<string, never>;
type Query = LimitedFilteredRequest;
type Body = undefined;
type ResponseBody = PaginatedResponse<MembersBlob, LimitedFilteredRequest>

const registrationFilterCompilers: SQLFilterDefinitions = {
    ...baseSQLFilterCompilers,
    "price": createSQLColumnFilterCompiler('price'),
    "pricePaid": createSQLColumnFilterCompiler('pricePaid'),
    "waitingList": createSQLColumnFilterCompiler('waitingList'),
    "canRegister": createSQLColumnFilterCompiler('canRegister'),
    "cycle": createSQLColumnFilterCompiler('cycle'),

    "cycleOffset": createSQLExpressionFilterCompiler({
        getSQL(options) {
            return joinSQLQuery([
                SQL.column('groups', 'cycle').getSQL(options),
                ' - ',
                SQL.column('registrations', 'cycle').getSQL(options)
            ])
        },
    }),

    "organizationId": createSQLColumnFilterCompiler('organizationId'),
    "groupId": createSQLColumnFilterCompiler('groupId'),
    "registeredAt": createSQLColumnFilterCompiler('registeredAt'),

    "group": createSQLFilterNamespace({
        ...baseSQLFilterCompilers,
        id: createSQLColumnFilterCompiler('groupId'),
        name: createSQLExpressionFilterCompiler(
            SQL.jsonValue(SQL.column('groups', 'settings'), '$.value.name')
        ),
        status: createSQLExpressionFilterCompiler(
            SQL.column('groups', 'status')
        ),
    })
}

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
    age: createSQLExpressionFilterCompiler(
        new SQLAge(SQL.column('birthDay'))
    ),
    gender: createSQLExpressionFilterCompiler(
        SQL.jsonValue(SQL.column('details'), '$.value.gender'),
        undefined,
        true,
        false
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
        SQL.select()
        .from(
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
        ),
        registrationFilterCompilers
    ),

    activeRegistrations: createSQLRelationFilterCompiler(
        SQL.select()
        .from(
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
        ).whereNot(
            SQL.column('registeredAt'),
            null,
        ).whereNot(
            SQL.column('groups', 'status'),
            GroupStatus.Archived
        ),
        registrationFilterCompilers
    ),

    organizations: createSQLRelationFilterCompiler(
        SQL.select()
        .from(
            SQL.table('registrations')
        ).join(
            SQL.join(
                SQL.table('groups')
            ).where(
                SQL.column('groups', 'id'),
                SQL.column('registrations', 'groupId')
            )
        ).join(
            SQL.join(
                SQL.table('organizations')
            ).where(
                SQL.column('organizations', 'id'),
                SQL.column('registrations', 'organizationId')
            )
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
        organizationFilterCompilers
    ),
}

const sorters: SQLSortDefinitions<MemberWithRegistrations> = {
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
            return a.details.name
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
            return a.details.birthDay ? Formatter.dateIso(a.details.birthDay) : null
        },
        toSQL: (direction: SQLOrderByDirection): SQLOrderBy => {
            return new SQLOrderBy({
                column: SQL.column('birthDay'),
                direction
            })
        }
    }
    // Note: never add mapped sortings, that should happen in the frontend -> e.g. map age to birthDay
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
        const organization = Context.organization
        let scopeFilter: StamhoofdFilter|undefined = undefined;

        if (!organization && !Context.auth.canAccessAllPlatformMembers()) {
            const tags = Context.auth.getPlatformAccessibleOrganizationTags(PermissionLevel.Read)
            if (tags != 'all' && tags.length === 0) {
                throw Context.auth.error()
            }
        
            if (tags !== 'all') {
                // Add organization scope filter
                scopeFilter = {
                    organizations: {
                        $elemMatch: {
                            tags: {
                                $in: tags
                            }
                        }
                    }
                };
            }
        }

        if (organization) {
            // Add organization scope filter
            scopeFilter = {
                activeRegistrations: {
                    $elemMatch: {
                        organizationId: organization.id
                    }
                }
            };
        }
        
        const query = SQL
            .select(
                SQL.column('members', 'id')
            )
            .from(
                SQL.table('members')
            );
            
        if (scopeFilter) {
            query.where(compileToSQLFilter(scopeFilter, filterCompilers))
        }

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
                                [(isCompleteAddress ? '$eq' : '$contains')]: q.search
                            }
                        },
                        {
                            parentEmail: {
                                [(isCompleteAddress ? '$eq' : '$contains')]: q.search
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
        await Context.setOptionalOrganizationScope();
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
        
        const data = await GetMembersEndpoint.buildQuery(request.query).fetch()
        
        const memberIds = data.map((r) => {
            if (typeof r.members.id === 'string') {
                return r.members.id
            }
            throw new Error('Expected string')
        });

        const _members = await Member.getBlobByIds(...memberIds)
        // Make sure members is in same order as memberIds
        const members = memberIds.map(id => _members.find(m => m.id === id)!)

        let next: LimitedFilteredRequest|undefined;

        if (memberIds.length >= request.query.limit) {
            const lastObject = members[members.length - 1];
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
            new PaginatedResponse<MembersBlob, LimitedFilteredRequest>({
                results: await AuthenticatedStructures.membersBlob(members),
                next
            })
        );
    }
}
