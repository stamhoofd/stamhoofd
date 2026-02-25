import { DecodedRequest, Endpoint, Request, Response } from '@simonbackx/simple-endpoints';
import { assertSort, CountFilteredRequest, getSortFilter, LimitedFilteredRequest, OrganizationRegistrationPeriod as OrganizationRegistrationPeriodStruct, PaginatedResponse, StamhoofdFilter } from '@stamhoofd/structures';

import { Decoder } from '@simonbackx/simple-encoding';
import { SimpleError } from '@simonbackx/simple-errors';
import { OrganizationRegistrationPeriod } from '@stamhoofd/models';
import { applySQLSorter, compileToSQLFilter, SQLFilterDefinitions, SQLSortDefinitions } from '@stamhoofd/sql';
import { AuthenticatedStructures } from '../../../../helpers/AuthenticatedStructures.js';
import { Context } from '../../../../helpers/Context.js';
import { organizationRegistrationPeriodFilterCompilers } from '../../../../sql-filters/organization-registration-periods.js';
import { organizationRegistrationPeriodSorters } from '../../../../sql-sorters/organization-registration-periods.js';

type Params = Record<string, never>;
type Query = LimitedFilteredRequest;
type Body = undefined;
type ResponseBody = PaginatedResponse<OrganizationRegistrationPeriodStruct[], LimitedFilteredRequest>;

const filterCompilers: SQLFilterDefinitions = organizationRegistrationPeriodFilterCompilers;
const sorters: SQLSortDefinitions<OrganizationRegistrationPeriod> = organizationRegistrationPeriodSorters;

export class GetOrganizationRegistrationPeriodsEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    queryDecoder = LimitedFilteredRequest as Decoder<LimitedFilteredRequest>;

    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method !== 'GET') {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, '/organization/registration-periods', {});

        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    static async buildQuery(q: CountFilteredRequest | LimitedFilteredRequest) {
        const organization = Context.organization;
        let scopeFilter: StamhoofdFilter | undefined = undefined;

        if (organization) {
            scopeFilter = {
                organizationId: organization.id,
            };
        }

        const query = OrganizationRegistrationPeriod.select();

        if (scopeFilter) {
            query.where(await compileToSQLFilter(scopeFilter, filterCompilers));
        }

        if (q.filter) {
            query.where(await compileToSQLFilter(q.filter, filterCompilers));
        }

        if (q.search) {
            let searchFilter: StamhoofdFilter | null = null;

            searchFilter = {
                id: q.search,
            };

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

    static async buildData(requestQuery: LimitedFilteredRequest) {
        const query = await GetOrganizationRegistrationPeriodsEndpoint.buildQuery(requestQuery);
        const organizationRegistrationPeriods = await query.fetch();

        let next: LimitedFilteredRequest | undefined;

        if (organizationRegistrationPeriods.length >= requestQuery.limit) {
            const lastObject = organizationRegistrationPeriods[organizationRegistrationPeriods.length - 1];
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

        return new PaginatedResponse<OrganizationRegistrationPeriodStruct[], LimitedFilteredRequest>({
            results: await AuthenticatedStructures.organizationRegistrationPeriods(organizationRegistrationPeriods),
            next,
        });
    }

    async handle(request: DecodedRequest<Params, Query, Body>) {
        if (request.request.getVersion() < 371) {
            throw new SimpleError({
                code: 'client_update_required',
                statusCode: 400,
                message: 'Er is een noodzakelijke update beschikbaar. Herlaad de pagina en wis indien nodig de cache van jouw browser.',
                human: $t(`adb0e7c8-aed7-43f5-bfcc-a350f03aaabe`),
            });
        }

        const organization = await Context.setOptionalOrganizationScope();
        await Context.authenticate();

        if (organization) {
            if (!await Context.auth.hasSomeAccess(organization.id)) {
                throw Context.auth.error();
            }
        }
        else {
            if (!Context.auth.hasPlatformFullAccess()) {
                throw Context.auth.error();
            }
        }

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
            await GetOrganizationRegistrationPeriodsEndpoint.buildData(request.query),
        );
    }

    /* async handle(request: DecodedRequest<Params, Query, Body>) {
        const organization = await Context.setOrganizationScope();
        await Context.authenticate();

        if (!await Context.auth.hasSomeAccess(organization.id)) {
            throw Context.auth.error();
        }

        const organizationPeriods = await OrganizationRegistrationPeriod.select().where('organizationId', organization.id).fetch();
        const periods = await RegistrationPeriod.all();

        // Sort
        periods.sort((a, b) => Sorter.byDateValue(a.startDate, b.startDate));

        return new Response(
            RegistrationPeriodList.create({
                organizationPeriods: await AuthenticatedStructures.organizationRegistrationPeriods(organizationPeriods, periods),
                periods: periods.map(p => p.getStructure()),
            }),
        );
    } */
}
