import { Decoder } from '@simonbackx/simple-encoding';
import { DecodedRequest, Endpoint, Request, Response } from '@simonbackx/simple-endpoints';
import { SimpleError } from '@simonbackx/simple-errors';
import { Member, Platform, Registration } from '@stamhoofd/models';
import { SQL, SQLSortDefinitions, applySQLSorter, compileToSQLFilter } from '@stamhoofd/sql';
import { CountFilteredRequest, Country, CountryCode, LimitedFilteredRequest, PaginatedResponse, PermissionLevel, RegistrationsBlob, StamhoofdFilter, assertSort } from '@stamhoofd/structures';
import { DataValidator } from '@stamhoofd/utility';

import { SQLResultNamespacedRow } from '@simonbackx/simple-database';
import { RegistrationWithMember } from '@stamhoofd/models/dist/src/models/Registration';
import parsePhoneNumber from 'libphonenumber-js/max';
import { AuthenticatedStructures } from '../../../helpers/AuthenticatedStructures';
import { Context } from '../../../helpers/Context';
import { LimitedFilteredRequestHelper } from '../../../helpers/LimitedFilteredRequestHelper';
import { registrationFilterCompilers } from '../../../sql-filters/registrations';
import { registrationSorters } from '../../../sql-sorters/registrations';

type Params = Record<string, never>;
type Query = LimitedFilteredRequest;
type Body = undefined;
type ResponseBody = PaginatedResponse<RegistrationsBlob, LimitedFilteredRequest>;

const sorters: SQLSortDefinitions<RegistrationWithMember> = registrationSorters;
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

        if (!organization && !Context.auth.canAccessAllPlatformMembers()) {
            const tags = Context.auth.getPlatformAccessibleOrganizationTags(permissionLevel);
            if (tags !== 'all' && tags.length === 0) {
                throw Context.auth.error();
            }

            if (tags !== 'all') {
                const platform = await Platform.getShared();

                // Add organization scope filter
                scopeFilter = {
                    $elemMatch: {
                        organization: {
                            tags: {
                                $in: tags,
                            },
                        },
                        periodId: platform.periodId,
                    },
                };
            }
        }

        if (organization && !Context.auth.canAccessAllPlatformMembers()) {
            // Add organization scope filter
            const groups = await Context.auth.getAccessibleGroups(organization.id, permissionLevel);

            if (groups.length === 0) {
                throw Context.auth.error();
            }

            if (groups === 'all') {
                if (await Context.auth.hasFullAccess(organization.id, permissionLevel)) {
                    // Can access full history for now
                    scopeFilter = {
                        $elemMatch: {
                            organizationId: organization.id,
                        },
                    };
                }
                else {
                    // Can only access current period
                    scopeFilter = {
                        $elemMatch: {
                            organizationId: organization.id,
                            periodId: organization.periodId,
                        },
                    };
                }
            }
            else {
                scopeFilter = {
                    $elemMatch: {
                        organizationId: organization.id,
                        periodId: organization.periodId,
                        groupId: {
                            $in: groups,
                        },
                    },
                };
            }
        }

        const query = SQL
            .select(
                SQL.column('registrations', 'id'),
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

        if (q.search) {
            let searchFilter: StamhoofdFilter | null = null;

            // is phone?
            if (!searchFilter && q.search.match(/^\+?[0-9\s-]+$/)) {
                // Try to format as phone so we have 1:1 space matches
                try {
                    const country = (Context.i18n.country as CountryCode) || Country.Belgium;

                    const phoneNumber = parsePhoneNumber(q.search, country);
                    if (phoneNumber && phoneNumber.isValid()) {
                        const formatted = phoneNumber.formatInternational();
                        searchFilter = {
                            members: {
                                $elemMatch: {
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
                                } } };
                    }
                }
                catch (e) {
                    console.error('Failed to parse phone number', q.search, e);
                }
            }

            // Is lidnummer?
            if (!searchFilter && (q.search.match(/^[0-9]{4}-[0-9]{6}-[0-9]{1,2}$/) || q.search.match(/^[0-9]{9,10}$/))) {
                searchFilter = {
                    members: {
                        $elemMatch: {
                            memberNumber: {
                                $eq: q.search,
                            } } },
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
                    members: {
                        $elemMatch: {
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
                            ] } },
                } as any as StamhoofdFilter;
            }
            else {
                searchFilter = {
                    members: {
                        $elemMatch: {
                            name: {
                                $contains: q.search,
                            } } },
                };
            }

            // todo: Address search detection

            if (searchFilter) {
                query.where(await compileToSQLFilter(searchFilter, filterCompilers));
            }
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

        const registrationIds = data.map((r) => {
            if (typeof r.registrations.id === 'string') {
                return r.registrations.id;
            }
            throw new Error('Expected string');
        });

        const _registrations = await Registration.getByIDs(...registrationIds);
        const memberIds = _registrations.map(r => r.memberId);
        const _members = await Member.getBlobByIds(...memberIds);

        const _registrationsWithMember: RegistrationWithMember[] = _registrations.map((r) => {
            const member = _members.find(m => m.id === r.memberId);
            if (!member) {
                throw new Error('Member not found');
            }
            return r.setRelation(Registration.member, member);
        });

        // Make sure registrationsWithMembers is in same order as registrationIds
        const registrationsWithMember = registrationIds.map(id => _registrationsWithMember.find(r => r.id === id)!);

        for (const registration of registrationsWithMember) {
            if (!await Context.auth.canAccessRegistrationWithMember(registration, permissionLevel)) {
                throw Context.auth.error();
            }
        }

        const registrationsBlob = await AuthenticatedStructures.registrationsBlob(registrationsWithMember);

        const next = LimitedFilteredRequestHelper.fixInfiniteLoadingLoop({
            request: requestQuery,
            results: registrationsWithMember,
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
