import { Decoder } from '@simonbackx/simple-encoding';
import { DecodedRequest, Endpoint, Request, Response } from '@simonbackx/simple-endpoints';
import { SimpleError } from '@simonbackx/simple-errors';
import { Group, Member, Platform } from '@stamhoofd/models';
import { SQL, applySQLSorter, compileToSQLFilter } from '@stamhoofd/sql';
import { CountFilteredRequest, Country, CountryCode, GroupType, LimitedFilteredRequest, MembersBlob, PaginatedResponse, PermissionLevel, StamhoofdFilter, assertSort, getSortFilter } from '@stamhoofd/structures';
import { DataValidator } from '@stamhoofd/utility';

import { SQLResultNamespacedRow } from '@simonbackx/simple-database';
import parsePhoneNumber from 'libphonenumber-js/max';
import { AuthenticatedStructures } from '../../../helpers/AuthenticatedStructures.js';
import { Context } from '../../../helpers/Context.js';
import { memberFilterCompilers } from '../../../sql-filters/members.js';
import { memberSorters } from '../../../sql-sorters/members.js';
import { validateGroupFilter } from './helpers/validateGroupFilter.js';

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

    static async buildQuery(q: CountFilteredRequest | LimitedFilteredRequest, permissionLevel: PermissionLevel = PermissionLevel.Read) {
        const organization = Context.organization;
        let scopeFilter: StamhoofdFilter | undefined = undefined;

        // First do a quick validation of the groups, so that prevents the backend from having to add a scope filter
        if (!Context.auth.canAccessAllPlatformMembers(permissionLevel) && !await validateGroupFilter({ filter: q.filter, permissionLevel, key: 'registrations' })) {
            if (!organization) {
                const tags = Context.auth.getPlatformAccessibleOrganizationTags(permissionLevel);
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
                                periodId: platform.periodIdIfPlatform,
                            },
                        },
                    };
                }
            }

            if (organization) {
                // Add organization scope filter
                if (await Context.auth.canAccessAllMembers(organization.id, permissionLevel)) {
                    if (await Context.auth.hasFullAccess(organization.id, permissionLevel)) {
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
                    // Check which normal membership groups we have access to and filter on those
                    const groups = await Group.getAll(organization.id, organization.periodId, true, [GroupType.Membership, GroupType.WaitingList]);
                    Context.auth.cacheGroups(groups);
                    const groupIds: string[] = [];

                    for (const group of groups) {
                        if (await Context.auth.canAccessGroup(group, permissionLevel)) {
                            groupIds.push(group.id);
                        }
                    }

                    if (groupIds.length === 0) {
                        throw Context.auth.error({
                            message: 'You must filter on a group of the organization you are trying to access',
                            human: $t(`737f9ff3-8eca-40f5-8f03-d303d53de5d1`),
                        });
                    }

                    scopeFilter = {
                        registrations: {
                            $elemMatch: {
                                groupId: {
                                    $in: groupIds,
                                },
                            },
                        },
                    };
                }
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
            query.where(await compileToSQLFilter(scopeFilter, filterCompilers));
        }

        if (q.filter) {
            query.where(await compileToSQLFilter(q.filter, filterCompilers));
        }

        const searchFilter = GetMembersEndpoint.buildSearchFilter(q.search);

        if (searchFilter) {
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

    static buildSearchFilter(search: string | null): StamhoofdFilter | null {
        if (!search) {
            return null;
        }

        let searchFilter: StamhoofdFilter | null = null;

        // is phone?
        if (!searchFilter && search.match(/^\+?[0-9\s-]+$/)) {
            // Try to format as phone so we have 1:1 space matches
            try {
                const country = (Context.i18n.country as CountryCode) || Country.Belgium;

                const phoneNumber = parsePhoneNumber(search, country);
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
                console.error('Failed to parse phone number', search, e);
            }
        }

        // Is lidnummer?
        if (!searchFilter && (search.match(/^[0-9]{4}-[0-9]{6}-[0-9]{1,2}$/) || search.match(/^[0-9]{9,10}$/))) {
            searchFilter = {
                memberNumber: {
                    $eq: search,
                },
            };
        }

        // Two search modes:
        // e-mail or name based searching
        if (searchFilter) {
            // already done
        }
        else if (search.includes('@')) {
            const isCompleteAddress = DataValidator.isEmailValid(search);

            // Member email address contains, or member parent contains
            searchFilter = {
                $or: [
                    {
                        email: {
                            [(isCompleteAddress ? '$eq' : '$contains')]: search,
                        },
                    },
                    {
                        parentEmail: {
                            [(isCompleteAddress ? '$eq' : '$contains')]: search,
                        },
                    },
                    {
                        unverifiedEmail: {
                            [(isCompleteAddress ? '$eq' : '$contains')]: search,
                        },
                    },
                ],
            } as any as StamhoofdFilter;
        }
        else {
            searchFilter = {
                name: {
                    $contains: search,
                },
            };
        }

        // todo: Address search detection

        return searchFilter;
    }

    static async buildData(requestQuery: LimitedFilteredRequest, permissionLevel = PermissionLevel.Read) {
        const query = await GetMembersEndpoint.buildQuery(requestQuery, permissionLevel);
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
            if (!await Context.auth.canAccessMember(member, permissionLevel)) {
                console.error('Unexpected member returned', member.id, requestQuery, query.getSQL());
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
