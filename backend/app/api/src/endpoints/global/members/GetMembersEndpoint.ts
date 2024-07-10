/* eslint-disable @typescript-eslint/no-unsafe-argument */
import { Decoder } from '@simonbackx/simple-encoding';
import { DecodedRequest, Endpoint, Request, Response } from '@simonbackx/simple-endpoints';
import { SimpleError } from '@simonbackx/simple-errors';
import { Email, Member, MemberWithRegistrations, Platform } from '@stamhoofd/models';
import { SQL, SQLAge, SQLConcat, SQLFilterDefinitions, SQLJSONValue, SQLOrderBy, SQLOrderByDirection, SQLScalar, SQLSortDefinitions, baseSQLFilterCompilers, compileToSQLFilter, compileToSQLSorter, createSQLColumnFilterCompiler, createSQLExpressionFilterCompiler, createSQLFilterNamespace, createSQLRelationFilterCompiler, joinSQLQuery } from "@stamhoofd/sql";
import { CountFilteredRequest, EmailRecipientFilterType, GroupStatus, LimitedFilteredRequest, MembersBlob, PaginatedResponse, PermissionLevel, StamhoofdFilter, getSortFilter, mergeFilters } from '@stamhoofd/structures';
import { DataValidator, Formatter } from '@stamhoofd/utility';

import { AuthenticatedStructures } from '../../../helpers/AuthenticatedStructures';
import { Context } from '../../../helpers/Context';
import { filterCompilers as organizationFilterCompilers } from '../../admin/organizations/GetOrganizationsEndpoint';

type Params = Record<string, never>;
type Query = LimitedFilteredRequest;
type Body = undefined;
type ResponseBody = PaginatedResponse<MembersBlob, LimitedFilteredRequest>

Email.recipientLoaders.set(EmailRecipientFilterType.Members, {
    fetch: async (query: LimitedFilteredRequest) => {
        const result = await GetMembersEndpoint.buildData(query)

        return new PaginatedResponse({
            results: result.results.members.flatMap(m => m.getEmailRecipients(['member'])),
            next: result.next
        });
    },

    count: async (query: LimitedFilteredRequest) => {
        query.filter = mergeFilters([query.filter, {
            'email': {
                $neq: null
            }
        }])
        const q = await GetMembersEndpoint.buildQuery(query)
        return await q.count();
    }
});
Email.recipientLoaders.set(EmailRecipientFilterType.MemberParents, {
    fetch: async (query: LimitedFilteredRequest) => {
        const result = await GetMembersEndpoint.buildData(query)

        return new PaginatedResponse({
            results: result.results.members.flatMap(m => m.getEmailRecipients(['parents'])),
            next: result.next
        });
    },

    count: async (query: LimitedFilteredRequest) => {
        const q = await GetMembersEndpoint.buildQuery(query)
        return await q.sum(
            SQL.jsonLength(SQL.column('details'), '$.value.parents[*].email')
        );
    }
});

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
    "periodId": createSQLColumnFilterCompiler(SQL.column('registrations', 'periodId')),

    "group": createSQLFilterNamespace({
        ...baseSQLFilterCompilers,
        id: createSQLColumnFilterCompiler('groupId'),
        name: createSQLExpressionFilterCompiler(
            SQL.jsonValue(SQL.column('groups', 'settings'), '$.value.name')
        ),
        status: createSQLExpressionFilterCompiler(
            SQL.column('groups', 'status')
        ),
        defaultAgeGroupId: createSQLColumnFilterCompiler(SQL.column('groups', 'defaultAgeGroupId')),
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
        )
        .join(
            SQL.join(
                SQL.table('organizations')
            ).where(
                SQL.column('organizations', 'id'),
                SQL.column('registrations', 'organizationId')
            )
        )
        .where(
            SQL.column('memberId'),
            SQL.column('members', 'id'),
        ),
        {
            ...registrationFilterCompilers,
            "organization": createSQLFilterNamespace(organizationFilterCompilers)
        }
    ),

    responsibilities: createSQLRelationFilterCompiler(
        SQL.select()
        .from(
            SQL.table('member_responsibility_records')
        )
        .where(
            SQL.column('memberId'),
            SQL.column('members', 'id'),
        ),
        {
            ...baseSQLFilterCompilers,
            // Alias for responsibilityId
            "id": createSQLColumnFilterCompiler(SQL.column('member_responsibility_records', 'responsibilityId')),
            "responsibilityId": createSQLColumnFilterCompiler(SQL.column('member_responsibility_records', 'responsibilityId')),
            "organizationId": createSQLColumnFilterCompiler(SQL.column('member_responsibility_records', 'organizationId')),
            "startDate": createSQLColumnFilterCompiler(SQL.column('member_responsibility_records', 'startDate')),
            "endDate": createSQLColumnFilterCompiler(SQL.column('member_responsibility_records', 'endDate')),
        }
    ),

    platformMemberships: createSQLRelationFilterCompiler(
        SQL.select()
        .from(
            SQL.table('member_platform_memberships')
        )
        .where(
            SQL.column('memberId'),
            SQL.column('members', 'id'),
        ),
        {
            ...baseSQLFilterCompilers,
            "id": createSQLColumnFilterCompiler(SQL.column('member_platform_memberships', 'id')),
            "membershipTypeId": createSQLColumnFilterCompiler(SQL.column('member_platform_memberships', 'membershipTypeId')),
            "organizationId": createSQLColumnFilterCompiler(SQL.column('member_platform_memberships', 'organizationId')),
            "periodId": createSQLColumnFilterCompiler(SQL.column('member_platform_memberships', 'periodId')),
            "price": createSQLColumnFilterCompiler(SQL.column('member_platform_memberships', 'price')),
            "invoiceId": createSQLColumnFilterCompiler(SQL.column('member_platform_memberships', 'invoiceId')),
            "startDate": createSQLColumnFilterCompiler(SQL.column('member_platform_memberships', 'startDate')),
            "endDate": createSQLColumnFilterCompiler(SQL.column('member_platform_memberships', 'endDate')),
            "expireDate": createSQLColumnFilterCompiler(SQL.column('member_platform_memberships', 'expireDate')),
        }
    ),

    /**
     * @deprecated?
     */
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
        )
        .where(
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

    static async buildQuery(q: CountFilteredRequest|LimitedFilteredRequest) {
        const organization = Context.organization
        let scopeFilter: StamhoofdFilter|undefined = undefined;

        if (!organization && !Context.auth.canAccessAllPlatformMembers()) {
            const tags = Context.auth.getPlatformAccessibleOrganizationTags(PermissionLevel.Read)
            if (tags != 'all' && tags.length === 0) {
                throw Context.auth.error()
            }
        
            if (tags !== 'all') {
                const platform = await Platform.getShared()

                // Add organization scope filter
                scopeFilter = {
                    registrations: {
                        $elemMatch: {
                            organization: {
                                tags: {
                                    $in: tags
                                }
                            },
                            periodId: platform.periodId,
                            registeredAt: {
                                $neq: null
                            },
                            group: {
                                defaultAgeGroupId: {
                                    $neq: null
                                }
                            }
                        }
                    }
                };
            }
        }

        if (organization) {
            // Add organization scope filter
            scopeFilter = {
                registrations: {
                    $elemMatch: {
                        organizationId: organization.id,
                        periodId: organization.periodId,
                        registeredAt: {
                            $neq: null
                        }
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

    static async buildData(requestQuery: LimitedFilteredRequest) {
        const query = await GetMembersEndpoint.buildQuery(requestQuery)
        const data = await query.fetch()
        
        const memberIds = data.map((r) => {
            if (typeof r.members.id === 'string') {
                return r.members.id
            }
            throw new Error('Expected string')
        });

        const _members = await Member.getBlobByIds(...memberIds)
        // Make sure members is in same order as memberIds
        const members = memberIds.map(id => _members.find(m => m.id === id)!)

        for (const member of members) {
            if (!await Context.auth.canAccessMember(member, PermissionLevel.Read)) {
                throw Context.auth.error()
            }
        }

        let next: LimitedFilteredRequest|undefined;

        if (memberIds.length >= requestQuery.limit) {
            const lastObject = members[members.length - 1];
            const nextFilter = getSortFilter(lastObject, sorters, requestQuery.sort);

            next = new LimitedFilteredRequest({
                filter: requestQuery.filter,
                pageFilter: nextFilter,
                sort: requestQuery.sort,
                limit: requestQuery.limit,
                search: requestQuery.search
            })

            if (JSON.stringify(nextFilter) === JSON.stringify(requestQuery.pageFilter)) {
                console.error('Found infinite loading loop for', requestQuery);
                next = undefined;
            }
        }

        return new PaginatedResponse<MembersBlob, LimitedFilteredRequest>({
            results: await AuthenticatedStructures.membersBlob(members),
            next
        });
    }

    async handle(request: DecodedRequest<Params, Query, Body>) {
        await Context.setOptionalOrganizationScope();
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
        
        return new Response(
            await GetMembersEndpoint.buildData(request.query)
        );
    }
}
