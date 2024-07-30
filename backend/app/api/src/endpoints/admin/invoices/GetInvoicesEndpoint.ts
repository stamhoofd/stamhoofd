/* eslint-disable @typescript-eslint/no-unsafe-argument */
import { Decoder } from '@simonbackx/simple-encoding';
import { DecodedRequest, Endpoint, Request, Response } from '@simonbackx/simple-endpoints';
import { SimpleError } from '@simonbackx/simple-errors';
import { Organization, Payment, STInvoice } from '@stamhoofd/models';
import { SQL, SQLFilterDefinitions, SQLOrderBy, SQLOrderByDirection, SQLSortDefinitions, baseSQLFilterCompilers, compileToSQLFilter, compileToSQLSorter, createSQLExpressionFilterCompiler } from "@stamhoofd/sql";
import { CountFilteredRequest, LimitedFilteredRequest, PaginatedResponse, Payment as PaymentStruct, STInvoicePrivate, StamhoofdFilter, getSortFilter } from '@stamhoofd/structures';

import { Context } from '../../../helpers/Context';

type Params = Record<string, never>;
type Query = LimitedFilteredRequest;
type Body = undefined;
type ResponseBody = PaginatedResponse<STInvoicePrivate[], LimitedFilteredRequest>

export const filterCompilers: SQLFilterDefinitions = {
    ...baseSQLFilterCompilers,
    id: createSQLExpressionFilterCompiler(
        SQL.column('stamhoofd_invoices', 'id')
    ),
    number: createSQLExpressionFilterCompiler(
        SQL.column('stamhoofd_invoices', 'number')
    )
}

const sorters: SQLSortDefinitions<STInvoice> = {
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
    'number': {
        getValue(a) {
            return a.number
        },
        toSQL: (direction: SQLOrderByDirection): SQLOrderBy => {
            return new SQLOrderBy({
                column: SQL.column('number'),
                direction
            })
        }
    }
}

export class GetInvoicesEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    queryDecoder = LimitedFilteredRequest as Decoder<LimitedFilteredRequest>

    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method != "GET") {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, "/admin/invoices", {});

        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    static buildQuery(q: CountFilteredRequest|LimitedFilteredRequest) {        
        const query = SQL
            .select(
                SQL.wildcard('stamhoofd_invoices')
            )
            .from(
                SQL.table('stamhoofd_invoices')
            )
            .whereNot(SQL.column('stamhoofd_invoices', 'number'), null);


        if (q.filter) {
            query.where(compileToSQLFilter(q.filter, filterCompilers))
        }

        if (q.search) {
            let searchFilter: StamhoofdFilter|null = null

            // todo: auto detect e-mailaddresses and search on admins
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

    async handle(request: DecodedRequest<Params, Query, Body>) {
        await Context.authenticate()

        if (!Context.auth.hasPlatformFullAccess()) {
            throw Context.auth.error()
        }

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
        
        const data = await GetInvoicesEndpoint.buildQuery(request.query).fetch()
        const invoices = STInvoice.fromRows(data, 'stamhoofd_invoices');

        let next: LimitedFilteredRequest|undefined;

        if (invoices.length >= request.query.limit) {
            const lastObject = invoices[invoices.length - 1];
            const nextFilter = getSortFilter(lastObject, sorters, request.query.sort);

            next = new LimitedFilteredRequest({
                filter: request.query.filter,
                pageFilter: nextFilter,
                sort: request.query.sort,
                limit: request.query.limit,
                search: request.query.search
            })

            if (JSON.stringify(nextFilter) === JSON.stringify(request.query.pageFilter)) {
                console.error('Found infinite loading loop for', request.query);
                next = undefined;
            }
        }
        
        // Get payments + organizations
        const paymentIds = invoices.flatMap(i => i.paymentId ? [i.paymentId] : [])
        const organizationIds = invoices.flatMap(i => i.organizationId ? [i.organizationId] : [])

        const payments = await Payment.getByIDs(...paymentIds)
        const organizations = await Organization.getByIDs(...organizationIds)

        const structures: STInvoicePrivate[] = []
        for (const invoice of invoices) {
            const payment = payments.find(p => p.id === invoice.paymentId)
            const organization = organizations.find(p => p.id === invoice.organizationId)
            structures.push(
                STInvoicePrivate.create({
                    ...invoice,
                    payment: payment ? PaymentStruct.create(payment) : null,
                    organization: organization ? organization.getBaseStructure() : undefined,
                    settlement: payment?.settlement ?? null,
                })
            )
        }

        return new Response(
            new PaginatedResponse<STInvoicePrivate[], LimitedFilteredRequest>({
                results: structures,
                next
            })
        );
    }
}
