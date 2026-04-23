import type { Decoder } from '@simonbackx/simple-encoding';
import type { DecodedRequest, Request } from '@simonbackx/simple-endpoints';
import { Endpoint, Response } from '@simonbackx/simple-endpoints';
import { SimpleError } from '@simonbackx/simple-errors';
import { Group, Platform, RegistrationInvitation } from '@stamhoofd/models';
import type { SQLFilterDefinitions, SQLSortDefinitions } from '@stamhoofd/sql';
import { applySQLSorter, compileToSQLFilter } from '@stamhoofd/sql';
import type { CountFilteredRequest, RegistrationInvitation as RegistrationInvitationStruct, StamhoofdFilter } from '@stamhoofd/structures';
import { GroupType, LimitedFilteredRequest, PaginatedResponse, PermissionLevel, assertSort } from '@stamhoofd/structures';

import { Context } from '../../../helpers/Context.js';
import { LimitedFilteredRequestHelper } from '../../../helpers/LimitedFilteredRequestHelper.js';
import { registrationInvitationFilterCompilers } from '../../../sql-filters/registration-invitations.js';
import { registrationInvitationSorters } from '../../../sql-sorters/registration-invitations.js';
import { GetMembersEndpoint } from '../members/GetMembersEndpoint.js';
import { validateGroupFilter } from '../members/helpers/validateGroupFilter.js';

type Params = Record<string, never>;
type Query = LimitedFilteredRequest;
type Body = undefined;
type ResponseBody = PaginatedResponse<RegistrationInvitationStruct[], LimitedFilteredRequest>;

const sorters: SQLSortDefinitions<RegistrationInvitation> = registrationInvitationSorters;
const filterCompilers: SQLFilterDefinitions = registrationInvitationFilterCompilers;

export class GetRegistrationInvitationsEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    queryDecoder = LimitedFilteredRequest as Decoder<LimitedFilteredRequest>;

    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method !== 'GET') {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, '/registration-invitations', {});

        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    static async buildQuery(q: CountFilteredRequest | LimitedFilteredRequest, permissionLevel: PermissionLevel = PermissionLevel.Read) {
        const organization = Context.organization;
        let scopeFilter: StamhoofdFilter | undefined = undefined;

        // First do a quick validation of the groups, so that prevents the backend from having to add a scope filter
        if (!Context.auth.canAccessAllPlatformMembers(permissionLevel) && !await validateGroupFilter({ filter: q.filter, permissionLevel, key: null })) {
            if (!organization) {
                const tags = Context.auth.getPlatformAccessibleOrganizationTags(permissionLevel);
                if (tags !== 'all' && tags.length === 0) {
                    throw Context.auth.error();
                }

                if (tags !== 'all') {
                    const platform = await Platform.getShared();

                    // todo: test
                    // Add organization scope filter
                    scopeFilter = {           
                        group: {
                            $elemMatch: {
                                periodId: platform.periodIdIfPlatform,
                            }
                        },
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
                            group: {
                                $elemMatch: {
                                    periodId: organization.periodId,
                                }
                            },
                        };
                    }
                }
                else {
                    // todo: is this correct?
                    const groups = await Group.getAll(organization.id, organization.periodId, true, [GroupType.Membership, GroupType.EventRegistration]);
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
                            human: $t(`%15g`),
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

        const query = RegistrationInvitation.select().setMaxExecutionTime(15 * 1000);

        // const query = this.selectRegistrationWithGroup()
        //     .setMaxExecutionTime(15 * 1000)
        //     .where('registeredAt', '!=', null);

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
        const query = await GetRegistrationInvitationsEndpoint.buildQuery(requestQuery, permissionLevel);
        let data: RegistrationInvitation[];

        try {
            data = await query.fetch();
        }
        catch (error) {
            if (error.message.includes('ER_QUERY_TIMEOUT')) {
                throw new SimpleError({
                    code: 'timeout',
                    message: 'Query took too long',
                    human: $t(`%Cv`),
                });
            }
            throw error;
        }

        // for (const invitation of data) {
        //     if (registration.group.settings.implicitlyAllowViewRegistrations) {
        //         // okay, only need to check if we can access the members (next step)
        //     }
        //     else {
        //         if (!await Context.auth.canAccessRegistration(registration, permissionLevel)) {
        //             throw Context.auth.error();
        //         }
        //     }
        // }

        // const members = await Member.getBlobByIds(...data.map(r => r.memberId));

        // for (const member of members) {
        //     if (!await Context.auth.canAccessMember(member, permissionLevel)) {
        //         throw Context.auth.error();
        //     }
        // }

        // const registrationsBlob = await AuthenticatedStructures.registrationsBlob(data, members);

        const next = LimitedFilteredRequestHelper.fixInfiniteLoadingLoop({
            request: requestQuery,
            results: data,
            sorters,
        });

        return new PaginatedResponse<RegistrationInvitationStruct[], LimitedFilteredRequest>({
            results: data.map(r => r.getStructure()),
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
            await GetRegistrationInvitationsEndpoint.buildData(request.query),
        );
    }
}
