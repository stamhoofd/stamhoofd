import type { Decoder } from '@simonbackx/simple-encoding';
import type { DecodedRequest, Request } from '@simonbackx/simple-endpoints';
import { Endpoint, Response } from '@simonbackx/simple-endpoints';
import { SimpleError } from '@simonbackx/simple-errors';
import { BalanceItem, Member, MemberPlatformMembership, Organization } from '@stamhoofd/models';
import { applySQLSorter, compileToSQLFilter } from '@stamhoofd/sql';
import type { CountFilteredRequest, StamhoofdFilter } from '@stamhoofd/structures';
import { assertSort, getSortFilter, LimitedFilteredRequest, PaginatedResponse, PlatformMembershipMemberDetails, PlatformMembership, PlatformMembershipOrganizationDetails } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { Context } from '../../../helpers/Context.js';
import { platformMembershipFilterCompilers } from '../../../sql-filters/platform-memberships.js';
import { platformMembershipSorters } from '../../../sql-sorters/platform-memberships.js';

type Params = Record<string, never>;
type Query = LimitedFilteredRequest;
type Body = undefined;
type ResponseBody = PaginatedResponse<PlatformMembership[], LimitedFilteredRequest>;


const sorters = platformMembershipSorters;
const filterCompilers = platformMembershipFilterCompilers;

export class GetPlatformMembershipsEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    queryDecoder = LimitedFilteredRequest as Decoder<LimitedFilteredRequest>;

    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method !== 'GET') {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, '/platform-memberships', {});

        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    static async buildQuery(q: CountFilteredRequest | LimitedFilteredRequest) {
       if (!Context.auth.hasPlatformFullAccess()) {
           throw Context.auth.error();
       }

        const query = MemberPlatformMembership.select()
            .setMaxExecutionTime(15 * 1000)
            .where('deletedAt', null);

        if (q.filter) {
            query.where(await compileToSQLFilter(q.filter, filterCompilers));
        }

        const searchFilter = GetPlatformMembershipsEndpoint.buildSearchFilter(q.search);

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

        // Is member number?
        if (search.match(/^\d{4}-\d{6}-\d{1,2}$/) || search.match(/^\d{9,10}$/)) {
            return {
                member: {
                        memberNumber: {
                        $eq: search,
                    },
                    
                }
            };
        }

        return {
                member: {
                    name: {
                        $contains: search,
                    }
                }
            };
    }

    static async buildData(requestQuery: LimitedFilteredRequest) {
        const query = await GetPlatformMembershipsEndpoint.buildQuery(requestQuery);

        let data: MemberPlatformMembership[];

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

        const memberIds = Formatter.uniqueArray(data.map(d => d.memberId));
        const organizationIds = Formatter.uniqueArray(data.map(d => d.organizationId));
        const balanceItemIds = Formatter.uniqueArray(data.map(d => d.balanceItemId));
        const members = await Member.getByIDs(...memberIds);
        const organizations = await Organization.getByIDs(...organizationIds);
        const balanceItems = await BalanceItem.getByIDs(...balanceItemIds)
        const balanceItemStructures = await BalanceItem.getStructureWithPayments(balanceItems);

        const results: PlatformMembership[] = [];

        for (const model of data) {
            const member = members.find(m => m.id === model.memberId);
            if (!member) {
                throw new SimpleError({
                    code: 'not_found',
                    message: 'Member not found',
                    human: $t(`%1Nz`),
                    statusCode: 404,
                });
            }

            const organization = organizations.find(o => o.id === model.organizationId);
            if (!organization) {
                throw new SimpleError({
                    code: 'not_found',
                    message: 'Organization not found',
                    human: $t(`%1OX`),
                    statusCode: 404,
                });
            }

            const balanceItem = model.balanceItemId ? balanceItemStructures.find(o => o.id === model.balanceItemId) : null;
            results.push(PlatformMembership.create({
                ...model,
                balanceItem: balanceItem,
                member: PlatformMembershipMemberDetails.create(member),
                organization: PlatformMembershipOrganizationDetails.create(organization)
            }));
        }

        let next: LimitedFilteredRequest | undefined;

        if (results.length >= requestQuery.limit) {
            const lastObject = results[results.length - 1];
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

        return new PaginatedResponse<PlatformMembership[], LimitedFilteredRequest>({
            results,
            next,
        });
    }

    async handle(request: DecodedRequest<Params, Query, Body>) {
        await Context.authenticate();

       if (!Context.auth.hasPlatformFullAccess()) {
           throw Context.auth.error();
       }

        const maxLimit = 1000;

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
            await GetPlatformMembershipsEndpoint.buildData(request.query),
        );
    }
}
