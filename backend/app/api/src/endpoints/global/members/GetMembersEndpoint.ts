import { Decoder } from '@simonbackx/simple-encoding';
import { DecodedRequest, Endpoint, Request, Response } from '@simonbackx/simple-endpoints';
import { SimpleError } from '@simonbackx/simple-errors';
import { Member, Platform } from '@stamhoofd/models';
import { SQL, compileToSQLFilter, compileToSQLSorter } from '@stamhoofd/sql';
import { CountFilteredRequest, Country, LimitedFilteredRequest, MembersBlob, PaginatedResponse, PermissionLevel, StamhoofdFilter, assertSort, getSortFilter } from '@stamhoofd/structures';
import { DataValidator } from '@stamhoofd/utility';

import parsePhoneNumber from 'libphonenumber-js/max';
import { AuthenticatedStructures } from '../../../helpers/AuthenticatedStructures';
import { Context } from '../../../helpers/Context';
import { memberFilterCompilers } from '../../../sql-filters/members';
import { memberSorters } from '../../../sql-sorters/members';
import { SQLResultNamespacedRow } from '@simonbackx/simple-database';

type Params = Record<string, never>;
type Query = LimitedFilteredRequest;
type Body = undefined;
type ResponseBody = PaginatedResponse<MembersBlob, LimitedFilteredRequest>;

const sorters = memberSorters;
const filterCompilers = memberFilterCompilers;

export class GetMembersEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    queryDecoder = LimitedFilteredRequest as Decoder<LimitedFilteredRequest>;

    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method !== 'GET') {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, '/members', {});

        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    static async buildQuery(q: CountFilteredRequest | LimitedFilteredRequest) {
        const organization = Context.organization;
        let scopeFilter: StamhoofdFilter | undefined = undefined;

        if (!organization && !Context.auth.canAccessAllPlatformMembers()) {
            const tags = Context.auth.getPlatformAccessibleOrganizationTags(PermissionLevel.Read);
            if (tags !== 'all' && tags.length === 0) {
                throw Context.auth.error();
            }

            if (tags !== 'all') {
                const platform = await Platform.getShared();

                // Add organization scope filter
                scopeFilter = {
                    registrations: {
                        $elemMatch: {
                            organization: {
                                tags: {
                                    $in: tags,
                                },
                            },
                            periodId: platform.periodId,
                            group: {
                                defaultAgeGroupId: {
                                    $neq: null,
                                },
                            },
                        },
                    },
                };
            }
        }

        if (organization) {
            // Add organization scope filter
            const groups = await Context.auth.getAccessibleGroups(organization.id);

            if (groups.length === 0) {
                throw Context.auth.error();
            }

            if (groups === 'all') {
                if (await Context.auth.hasFullAccess(organization.id)) {
                    // Can access full history for now
                    scopeFilter = {
                        registrations: {
                            $elemMatch: {
                                organizationId: organization.id,
                            },
                        },
                    };
                }
                else {
                    // Can only access current period
                    scopeFilter = {
                        registrations: {
                            $elemMatch: {
                                organizationId: organization.id,
                                periodId: organization.periodId,
                            },
                        },
                    };
                }
            }
            else {
                scopeFilter = {
                    registrations: {
                        $elemMatch: {
                            organizationId: organization.id,
                            periodId: organization.periodId,
                            groupId: {
                                $in: groups,
                            },
                        },
                    },
                };
            }
        }

        const query = SQL
            .select(
                SQL.column('members', 'id'),
            )
            .setMaxExecutionTime(15 * 1000)
            .from(
                SQL.table('members'),
            );

        if (scopeFilter) {
            query.where(compileToSQLFilter(scopeFilter, filterCompilers));
        }

        if (q.filter) {
            query.where(compileToSQLFilter(q.filter, filterCompilers));
        }

        if (q.search) {
            let searchFilter: StamhoofdFilter | null = null;

            // is phone?
            if (!searchFilter && q.search.match(/^\+?[0-9\s-]+$/)) {
                // Try to format as phone so we have 1:1 space matches
                try {
                    const phoneNumber = parsePhoneNumber(q.search, (Context.i18n.country as Country) || Country.Belgium);
                    if (phoneNumber && phoneNumber.isValid()) {
                        const formatted = phoneNumber.formatInternational();
                        searchFilter = {
                            $or: [
                                {
                                    phone: {
                                        $eq: formatted,
                                    },
                                },
                                {
                                    parentPhone: {
                                        $eq: formatted,
                                    },
                                },
                                {
                                    unverifiedPhone: {
                                        $eq: formatted,
                                    },
                                },
                            ],
                        };
                    }
                }
                catch (e) {
                    console.error('Failed to parse phone number', q.search, e);
                }
            }

            // Is lidnummer?
            if (!searchFilter && (q.search.match(/^[0-9]{4}-[0-9]{6}-[0-9]{1,2}$/) || q.search.match(/^[0-9]{10}$/))) {
                searchFilter = {
                    memberNumber: {
                        $eq: q.search,
                    },
                };
            }

            // Two search modes:
            // e-mail or name based searching
            if (searchFilter) {
                // already done
            }
            else if (q.search.includes('@')) {
                const isCompleteAddress = DataValidator.isEmailValid(q.search);

                // Member email address contains, or member parent contains
                searchFilter = {
                    $or: [
                        {
                            email: {
                                [(isCompleteAddress ? '$eq' : '$contains')]: q.search,
                            },
                        },
                        {
                            parentEmail: {
                                [(isCompleteAddress ? '$eq' : '$contains')]: q.search,
                            },
                        },
                        {
                            unverifiedEmail: {
                                [(isCompleteAddress ? '$eq' : '$contains')]: q.search,
                            },
                        },
                    ],
                } as any as StamhoofdFilter;
            }
            else {
                searchFilter = {
                    name: {
                        $contains: q.search,
                    },
                };
            }

            // todo: Address search detection

            if (searchFilter) {
                query.where(compileToSQLFilter(searchFilter, filterCompilers));
            }
        }

        if (q instanceof LimitedFilteredRequest) {
            if (q.pageFilter) {
                query.where(compileToSQLFilter(q.pageFilter, filterCompilers));
            }

            q.sort = assertSort(q.sort, [{ key: 'id' }]);
            query.orderBy(compileToSQLSorter(q.sort, sorters));
            query.limit(q.limit);
        }

        return query;
    }

    static async buildData(requestQuery: LimitedFilteredRequest) {
        const query = await GetMembersEndpoint.buildQuery(requestQuery);
        let data: SQLResultNamespacedRow[];

        try {
            data = await query.fetch();
        }
        catch (error) {
            if (error.message.includes('ER_QUERY_TIMEOUT')) {
                throw new SimpleError({
                    code: 'timeout',
                    message: 'Query took too long',
                    human: 'Deze opzoeking is te complex en duurt te lang. Probeer een eenvoudigere zoekopdracht of probeer terug op een rustiger tijdstip.',
                });
            }
            throw error;
        }

        const memberIds = data.map((r) => {
            if (typeof r.members.id === 'string') {
                return r.members.id;
            }
            throw new Error('Expected string');
        });

        const _members = await Member.getBlobByIds(...memberIds);
        // Make sure members is in same order as memberIds
        const members = memberIds.map(id => _members.find(m => m.id === id)!);

        for (const member of members) {
            if (!await Context.auth.canAccessMember(member, PermissionLevel.Read)) {
                throw Context.auth.error();
            }
        }

        let next: LimitedFilteredRequest | undefined;

        if (memberIds.length >= requestQuery.limit) {
            const lastObject = members[members.length - 1];
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

        return new PaginatedResponse<MembersBlob, LimitedFilteredRequest>({
            results: await AuthenticatedStructures.membersBlob(members),
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
            await GetMembersEndpoint.buildData(request.query),
        );
    }
}
