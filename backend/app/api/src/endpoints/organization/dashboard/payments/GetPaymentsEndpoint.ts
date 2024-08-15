/* eslint-disable @typescript-eslint/no-unsafe-argument */
import { Decoder } from '@simonbackx/simple-encoding';
import { DecodedRequest, Endpoint, Request, Response } from '@simonbackx/simple-endpoints';
import { SimpleError } from '@simonbackx/simple-errors';
import { Payment } from '@stamhoofd/models';
import { SQL, SQLFilterDefinitions, SQLOrderBy, SQLOrderByDirection, SQLSortDefinitions, baseSQLFilterCompilers, compileToSQLFilter, compileToSQLSorter, createSQLColumnFilterCompiler } from "@stamhoofd/sql";
import { CountFilteredRequest, LimitedFilteredRequest, PaginatedResponse, PaymentGeneral, StamhoofdFilter, getSortFilter } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';

import { AuthenticatedStructures } from '../../../../helpers/AuthenticatedStructures';
import { Context } from '../../../../helpers/Context';

type Params = Record<string, never>;
type Query = LimitedFilteredRequest;
type Body = undefined;
type ResponseBody = PaginatedResponse<PaymentGeneral[], LimitedFilteredRequest>

const filterCompilers: SQLFilterDefinitions = {
    ...baseSQLFilterCompilers,
    id: createSQLColumnFilterCompiler('id'),
    method: createSQLColumnFilterCompiler('method'),
    status: createSQLColumnFilterCompiler('status'),
    organizationId: createSQLColumnFilterCompiler('organizationId'),
    createdAt: createSQLColumnFilterCompiler('createdAt'),
    paidAt: createSQLColumnFilterCompiler('paidAt', {nullable: true}),
    price: createSQLColumnFilterCompiler('price'),
    provider: createSQLColumnFilterCompiler('provider', {nullable: true}),
}

const sorters: SQLSortDefinitions<Payment> = {
    'id': {
        getValue(a) {
            return a.id
        },
        toSQL: (direction: SQLOrderByDirection): SQLOrderBy => {
            return new SQLOrderBy({
                column: SQL.column('id'),
                direction
            })
        }
    },
    'createdAt': {
        getValue(a) {
            return Formatter.dateTimeIso(a.createdAt, 'UTC')
        },
        toSQL: (direction: SQLOrderByDirection): SQLOrderBy => {
            return new SQLOrderBy({
                column: SQL.column('createdAt'),
                direction
            })
        }
    },
    'paidAt': {
        getValue(a) {
            return a.paidAt !== null ? Formatter.dateTimeIso(a.paidAt, 'UTC') : null
        },
        toSQL: (direction: SQLOrderByDirection): SQLOrderBy => {
            return new SQLOrderBy({
                column: SQL.column('paidAt'),
                direction
            })
        }
    },
    'price': {
        getValue(a) {
            return a.price
        },
        toSQL: (direction: SQLOrderByDirection): SQLOrderBy => {
            return new SQLOrderBy({
                column: SQL.column('price'),
                direction
            })
        }
    }
}

export class GetPaymentsEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    queryDecoder = LimitedFilteredRequest as Decoder<LimitedFilteredRequest>

    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method != "GET") {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, "/payments", {});

        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    static async buildQuery(q: CountFilteredRequest|LimitedFilteredRequest) {
        const organization = Context.organization
        let scopeFilter: StamhoofdFilter|undefined = undefined;

        if (!organization) {
            throw Context.auth.error()
        }

        if (!await Context.auth.canManagePayments(organization.id)) {
            throw Context.auth.error()
        }

        scopeFilter = {
            organizationId: organization.id
        };
        
        const query = SQL
            .select()
            .from(
                SQL.table('payments')
            );
            
        if (scopeFilter) {
            query.where(compileToSQLFilter(scopeFilter, filterCompilers))
        }

        if (q.filter) {
            query.where(compileToSQLFilter(q.filter, filterCompilers))
        }

        if (q.search) {
            // todo

            let searchFilter: StamhoofdFilter|null = null
            searchFilter = {
                name: {
                    $contains: q.search
                }
            }

            if (searchFilter) {
                query.where(compileToSQLFilter(searchFilter, filterCompilers))
            }
        }

        if (q instanceof LimitedFilteredRequest) {
            if (q.pageFilter) {
                query.where(compileToSQLFilter(q.pageFilter, filterCompilers))
            }

            query.orderBy(compileToSQLSorter(q.sort, sorters))
            query.limit(q.limit)
        }
       
        return query
    }

    static async buildData(requestQuery: LimitedFilteredRequest) {
        const query = await this.buildQuery(requestQuery)
        const data = await query.fetch()
        
        const payments = Payment.fromRows(data, 'payments')

        let next: LimitedFilteredRequest|undefined;

        if (payments.length >= requestQuery.limit) {
            const lastObject = payments[payments.length - 1];
            const nextFilter = getSortFilter(lastObject, sorters, requestQuery.sort);

            next = new LimitedFilteredRequest({
                filter: requestQuery.filter,
                pageFilter: nextFilter,
                sort: requestQuery.sort,
                limit: requestQuery.limit,
                search: requestQuery.search
            })

            if (JSON.stringify(nextFilter) === JSON.stringify(requestQuery.pageFilter)) {
                console.error('Found infinite loading loop for', requestQuery);
                next = undefined;
            }
        }

        return new PaginatedResponse<PaymentGeneral[], LimitedFilteredRequest>({
            results: await AuthenticatedStructures.paymentsGeneral(payments, false),
            next
        });
    }

    async handle(request: DecodedRequest<Params, Query, Body>) {
        await Context.setOrganizationScope();
        await Context.authenticate()

        const maxLimit = Context.auth.hasSomePlatformAccess() ? 1000 : 100;

        if (request.query.limit > maxLimit) {
            throw new SimpleError({
                code: 'invalid_field',
                field: 'limit',
                message: 'Limit can not be more than ' + maxLimit
            })
        }

        if (request.query.limit < 1) {
            throw new SimpleError({
                code: 'invalid_field',
                field: 'limit',
                message: 'Limit can not be less than 1'
            })
        }
        
        return new Response(
            await GetPaymentsEndpoint.buildData(request.query)
        );
    }
}
