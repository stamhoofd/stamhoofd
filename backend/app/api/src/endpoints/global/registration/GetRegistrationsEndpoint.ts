import { Decoder } from '@simonbackx/simple-encoding';
import { DecodedRequest, Endpoint, Request, Response } from '@simonbackx/simple-endpoints';
import { SimpleError } from '@simonbackx/simple-errors';
import { Group, Member, Platform, Registration } from '@stamhoofd/models';
import { SQL, SQLExpression, SQLSelect, SQLSortDefinitions, applySQLSorter, compileToSQLFilter } from '@stamhoofd/sql';
import { CountFilteredRequest, GroupType, LimitedFilteredRequest, PaginatedResponse, PermissionLevel, RegistrationWithMemberBlob, StamhoofdFilter, assertSort } from '@stamhoofd/structures';

import { SQLResultNamespacedRow } from '@simonbackx/simple-database';
import { RegistrationsBlob } from '@stamhoofd/structures/dist/src/members/RegistrationsBlob';
import { AuthenticatedStructures } from '../../../helpers/AuthenticatedStructures.js';
import { Context } from '../../../helpers/Context.js';
import { LimitedFilteredRequestHelper } from '../../../helpers/LimitedFilteredRequestHelper.js';
import { groupJoin, registrationFilterCompilers } from '../../../sql-filters/registrations.js';
import { RegistrationSortData, registrationSorters } from '../../../sql-sorters/registrations.js';
import { GetMembersEndpoint } from '../members/GetMembersEndpoint.js';
import { validateGroupFilter } from '../members/helpers/validateGroupFilter.js';

type Params = Record<string, never>;
type Query = LimitedFilteredRequest;
type Body = undefined;
type ResponseBody = PaginatedResponse<RegistrationsBlob, LimitedFilteredRequest>;

const sorters: SQLSortDefinitions<RegistrationSortData> = registrationSorters;
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

    static selectRegistrationWithGroup(...columns: (SQLExpression | string)[]): SQLSelect<Registration & { group: Group }> {
        const transformer = (row: SQLResultNamespacedRow): Registration & { group: Group } => {
            const d = Registration.fromRow(row[Registration.table]);

            if (!d) {
                console.error('Could not transform row', row, 'into model', Registration.table, 'check if the primary key is returned in the query');
                throw new Error('Missing data for model ' + Registration.table);
            }

            const g = Group.fromRow(row[Group.table]);
            if (!g) {
                console.error('Could not transform row', row, 'into model', Group.table, 'check if the primary key is returned in the query');
                throw new Error('Missing data for model ' + Group.table);
            }

            return d.setRelation(Registration.group, g);
        };

        const select = new SQLSelect(transformer, ...(columns.length === 0 ? [SQL.wildcard(), SQL.wildcard(Group.table)] : columns));
        select.join(groupJoin);
        return select.from(SQL.table(Registration.table));
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

                    // Add organization scope filter
                    scopeFilter = {
                        periodId: platform.periodIdIfPlatform,
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
                            member: {
                                registrations: {
                                    $elemMatch: {
                                        organizationId: organization.id,
                                    },
                                },
                            },
                        };
                    }
                    else {
                        // Can only access current period
                        scopeFilter = {
                            member: {
                                registrations: {
                                    $elemMatch: {
                                        organizationId: organization.id,
                                        periodId: organization.periodId,
                                    },
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
                            human: $t(`94e2d4ff-9b4b-4861-ba42-341ed67b32d8`),
                        });
                    }

                    scopeFilter = {
                        member: {
                            registrations: {
                                $elemMatch: {
                                    groupId: {
                                        $in: groupIds,
                                    },
                                },
                            },
                        },
                    };
                }
            }
        }

        const query = this.selectRegistrationWithGroup()
            .setMaxExecutionTime(15 * 1000)
            .where('registeredAt', '!=', null);

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
        let data: (Registration & {
            group: Group;
        })[];

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

        for (const registration of data) {
            if (registration.group.settings.implicitlyAllowViewRegistrations) {
                // okay, only need to check if we can access the members (next step)
            }
            else {
                if (!await Context.auth.canAccessRegistration(registration, permissionLevel)) {
                    throw Context.auth.error();
                }
            }
        }

        const members = await Member.getBlobByIds(...data.map(r => r.memberId));

        for (const member of members) {
            if (!await Context.auth.canAccessMember(member, permissionLevel)) {
                throw Context.auth.error();
            }
        }

        const registrationsBlob = await AuthenticatedStructures.registrationsBlob(data, members);

        const next = LimitedFilteredRequestHelper.fixInfiniteLoadingLoopWithTransform<RegistrationWithMemberBlob, RegistrationSortData>({
            request: requestQuery,
            results: registrationsBlob.registrations,
            transformer: registration => new RegistrationSortData({
                registration,
                organizations: registrationsBlob.organizations,
            }),
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
