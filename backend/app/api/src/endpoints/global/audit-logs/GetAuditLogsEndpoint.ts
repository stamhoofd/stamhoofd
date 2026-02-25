import { Decoder } from '@simonbackx/simple-encoding';
import { DecodedRequest, Endpoint, Request, Response } from '@simonbackx/simple-endpoints';
import { SimpleError } from '@simonbackx/simple-errors';
import { AuditLog } from '@stamhoofd/models';
import { SQL, SQLSortDefinitions, applySQLSorter, compileToSQLFilter } from '@stamhoofd/sql';
import { AuditLog as AuditLogStruct, CountFilteredRequest, LimitedFilteredRequest, PaginatedResponse, StamhoofdFilter, assertSort, getSortFilter } from '@stamhoofd/structures';

import { AuthenticatedStructures } from '../../../helpers/AuthenticatedStructures.js';
import { Context } from '../../../helpers/Context.js';
import { auditLogFilterCompilers } from '../../../sql-filters/audit-logs.js';
import { auditLogSorters } from '../../../sql-sorters/audit-logs.js';

type Params = Record<string, never>;
type Query = LimitedFilteredRequest;
type Body = undefined;
type ResponseBody = PaginatedResponse<AuditLogStruct[], LimitedFilteredRequest>;

const filterCompilers = auditLogFilterCompilers;
const sorters: SQLSortDefinitions<AuditLog> = auditLogSorters;

export class GetAuditLogsEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    queryDecoder = LimitedFilteredRequest as Decoder<LimitedFilteredRequest>;

    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method !== 'GET') {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, '/audit-logs', {});

        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    static async buildQuery(q: CountFilteredRequest | LimitedFilteredRequest) {
        const organization = Context.organization;
        let scopeFilter: StamhoofdFilter | undefined = undefined;

        if (organization) {
            if (!await Context.auth.hasFullAccess(organization.id)) {
                throw Context.auth.error();
            }
            if (!Context.auth.hasPlatformFullAccess()) {
                scopeFilter = {
                    organizationId: organization.id,
                };
            }
            else {
                if (!q.filter || typeof q.filter !== 'object' || !('objectId' in q.filter)) {
                    scopeFilter = {
                        organizationId: organization.id,
                    };
                }
            }
        }
        else {
            if (!Context.auth.hasPlatformFullAccess()) {
                throw Context.auth.error();
            }
        }

        const query = SQL
            .select(
                SQL.wildcard(AuditLog.table),
            )
            .from(
                SQL.table(AuditLog.table),
            );

        if (scopeFilter) {
            query.where(await compileToSQLFilter(scopeFilter, filterCompilers));
        }

        if (q.filter) {
            query.where(await compileToSQLFilter(q.filter, filterCompilers));
        }

        if (q.search) {
            throw new SimpleError({
                code: 'not_supported',
                message: 'Search is not possible in audit logs',
                human: $t(`540b9c7e-635f-48b7-a661-cd0700b3c602`),
            });
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
        const query = await GetAuditLogsEndpoint.buildQuery(requestQuery);
        const data = await query.fetch();

        const logs = AuditLog.fromRows(data, AuditLog.table);

        let next: LimitedFilteredRequest | undefined;

        if (logs.length >= requestQuery.limit) {
            const lastObject = logs[logs.length - 1];
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

        return new PaginatedResponse<AuditLogStruct[], LimitedFilteredRequest>({
            results: await AuthenticatedStructures.auditLogs(logs),
            next,
        });
    }

    async handle(request: DecodedRequest<Params, Query, Body>) {
        await Context.setOptionalOrganizationScope();
        await Context.authenticate();

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
            await GetAuditLogsEndpoint.buildData(request.query),
        );
    }
}
