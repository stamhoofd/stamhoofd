import { Decoder } from '@simonbackx/simple-encoding';
import { DecodedRequest, Endpoint, Request, Response } from '@simonbackx/simple-endpoints';
import { SimpleError } from '@simonbackx/simple-errors';
import { Group, Member, Platform } from '@stamhoofd/models';
import { SQL, SQLSortDefinitions, applySQLSorter, compileToSQLFilter } from '@stamhoofd/sql';
import { CountFilteredRequest, GroupType, LimitedFilteredRequest, PaginatedResponse, PermissionLevel, StamhoofdFilter, assertSort } from '@stamhoofd/structures';

import { SQLResultNamespacedRow } from '@simonbackx/simple-database';
import { RegistrationsBlob } from '@stamhoofd/structures/dist/src/members/RegistrationsBlob';
import { RegistrationWithMemberBlob } from '@stamhoofd/structures/dist/src/members/RegistrationWithMemberBlob';
import { AuthenticatedStructures } from '../../../helpers/AuthenticatedStructures';
import { Context } from '../../../helpers/Context';
import { LimitedFilteredRequestHelper } from '../../../helpers/LimitedFilteredRequestHelper';
import { registrationFilterCompilers } from '../../../sql-filters/registrations';
import { registrationSorters } from '../../../sql-sorters/registrations';
import { GetMembersEndpoint } from '../members/GetMembersEndpoint';
import { validateGroupFilter } from '../members/helpers/validateGroupFilter';

type Params = Record<string, never>;
type Query = LimitedFilteredRequest;
type Body = undefined;
type ResponseBody = PaginatedResponse<RegistrationsBlob, LimitedFilteredRequest>;

const sorters: SQLSortDefinitions<RegistrationWithMemberBlob> = registrationSorters;
const filterCompilers = registrationFilterCompilers;

export class GetRegistrationsEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    queryDecoder = LimitedFilteredRequest as Decoder<LimitedFilteredRequest>;

    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method !== 'GET') {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, '/registrations', {});

        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    static async buildQuery(q: CountFilteredRequest | LimitedFilteredRequest, permissionLevel: PermissionLevel = PermissionLevel.Read) {
        const organization = Context.organization;
        let scopeFilter: StamhoofdFilter | undefined = undefined;

        // First do a quick validation of the groups, so that prevents the backend from having to add a scope filter
        if (!Context.auth.canAccessAllPlatformMembers() && !await validateGroupFilter({ filter: q.filter, permissionLevel, key: null })) {
            if (!organization) {
                const tags = Context.auth.getPlatformAccessibleOrganizationTags(permissionLevel);
                if (tags !== 'all' && tags.length === 0) {
                    throw Context.auth.error();
                }

                if (tags !== 'all') {
                    const platform = await Platform.getShared();

                    // Add organization scope filter
                    scopeFilter = {
                        periodId: platform.periodId,
                        organization: {
                            $elemMatch: {
                                tags: {
                                    $in: tags,
                                },
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
                            organizationId: organization.id,
                        };
                    }
                    else {
                        // Can only access current period
                        scopeFilter = {
                            organizationId: organization.id,
                            periodId: organization.periodId,
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
                            human: $t(`94e2d4ff-9b4b-4861-ba42-341ed67b32d8`),
                        });
                    }

                    scopeFilter = {
                        groupId: {
                            $in: groupIds,
                        },
                    };
                }
            }
        }

        const query = SQL
            .select(
                SQL.column('registrations', 'id'),
                SQL.column('registrations', 'memberId'),
            )
            .setMaxExecutionTime(15 * 1000)
            .from(
                SQL.table('registrations'),
            );

        if (scopeFilter) {
            query.where(await compileToSQLFilter(scopeFilter, filterCompilers));
        }

        if (q.filter) {
            query.where(await compileToSQLFilter(q.filter, filterCompilers));
        }

        const memberSearchFilter = GetMembersEndpoint.buildSearchFilter(q.search);

        if (memberSearchFilter) {
            const searchFilter: StamhoofdFilter = {
                member: {
                    $elemMatch: memberSearchFilter,
                },
            };

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

    static async buildData(requestQuery: LimitedFilteredRequest, permissionLevel = PermissionLevel.Read) {
        const query = await GetRegistrationsEndpoint.buildQuery(requestQuery, permissionLevel);
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

        const registrationData = data.map((r) => {
            if (typeof r.registrations.memberId === 'string' && typeof r.registrations.id === 'string') {
                return { memberId: r.registrations.memberId, id: r.registrations.id };
            }
            throw new Error('Expected string');
        });

        const members = await Member.getBlobByIds(...registrationData.map(r => r.memberId));

        for (const member of members) {
            if (!await Context.auth.canAccessMember(member, permissionLevel)) {
                throw Context.auth.error();
            }
        }

        const registrationsBlob = await AuthenticatedStructures.registrationsBlob(registrationData, members);

        const next = LimitedFilteredRequestHelper.fixInfiniteLoadingLoop({
            request: requestQuery,
            results: registrationsBlob.registrations,
            sorters,
        });

        return new PaginatedResponse<RegistrationsBlob, LimitedFilteredRequest>({
            results: registrationsBlob,
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
            await GetRegistrationsEndpoint.buildData(request.query),
        );
    }
}
