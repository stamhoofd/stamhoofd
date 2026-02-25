import { DecodedRequest, Endpoint, Request, Response } from '@simonbackx/simple-endpoints';
import { assertSort, CountFilteredRequest, getSortFilter, LimitedFilteredRequest, PaginatedResponse, RegistrationPeriod as RegistrationPeriodStruct, StamhoofdFilter } from '@stamhoofd/structures';

import { Decoder } from '@simonbackx/simple-encoding';
import { SimpleError } from '@simonbackx/simple-errors';
import { RegistrationPeriod } from '@stamhoofd/models';
import { applySQLSorter, compileToSQLFilter, SQLFilterDefinitions, SQLSortDefinitions } from '@stamhoofd/sql';
import { Context } from '../../../helpers/Context.js';
import { registrationPeriodFilterCompilers } from '../../../sql-filters/registration-periods.js';
import { registrationPeriodSorters } from '../../../sql-sorters/registration-periods.js';

type Params = Record<string, never>;
type Query = LimitedFilteredRequest;
type Body = undefined;
type ResponseBody = PaginatedResponse<RegistrationPeriodStruct[], LimitedFilteredRequest>;

const filterCompilers: SQLFilterDefinitions = registrationPeriodFilterCompilers;
const sorters: SQLSortDefinitions<RegistrationPeriod> = registrationPeriodSorters;

export class GetRegistrationPeriodsEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    queryDecoder = LimitedFilteredRequest as Decoder<LimitedFilteredRequest>;

    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method !== 'GET') {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, '/registration-periods', {});

        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    static async buildQuery(q: CountFilteredRequest | LimitedFilteredRequest) {
        let scopeFilter: StamhoofdFilter | undefined = undefined;
        const query = RegistrationPeriod.select();

        if (STAMHOOFD.userMode === 'organization') {
            const organization = Context.organization;

            if (!organization) {
                throw new SimpleError({
                    code: 'no_organization',
                    message: 'Organization is undefined on Context',
                });
            }

            scopeFilter = {
                organizationId: organization.id,
            };
        }

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
        const query = await GetRegistrationPeriodsEndpoint.buildQuery(requestQuery);
        const registrationPeriods = await query.fetch();

        let next: LimitedFilteredRequest | undefined;

        if (registrationPeriods.length >= requestQuery.limit) {
            const lastObject = registrationPeriods[registrationPeriods.length - 1];
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

        return new PaginatedResponse<RegistrationPeriodStruct[], LimitedFilteredRequest>({
            results: registrationPeriods.map(p => p.getStructure()),
            next,
        });
    }

    async handle(request: DecodedRequest<Params, Query, Body>) {
        await Context.setUserOrganizationScope();

        if (request.request.getVersion() < 371) {
            throw new SimpleError({
                code: 'client_update_required',
                statusCode: 400,
                message: 'Er is een noodzakelijke update beschikbaar. Herlaad de pagina en wis indien nodig de cache van jouw browser.',
                human: $t(`adb0e7c8-aed7-43f5-bfcc-a350f03aaabe`),
            });
        }

        const maxLimit = 100;

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
            await GetRegistrationPeriodsEndpoint.buildData(request.query),
        );
    }
}
