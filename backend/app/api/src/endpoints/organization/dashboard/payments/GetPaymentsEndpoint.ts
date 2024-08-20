/* eslint-disable @typescript-eslint/no-unsafe-argument */
import { Decoder } from '@simonbackx/simple-encoding';
import { DecodedRequest, Endpoint, Request, Response } from '@simonbackx/simple-endpoints';
import { SimpleError } from '@simonbackx/simple-errors';
import { Payment } from '@stamhoofd/models';
import { SQL, compileToSQLFilter, compileToSQLSorter } from "@stamhoofd/sql";
import { CountFilteredRequest, LimitedFilteredRequest, PaginatedResponse, PaymentGeneral, StamhoofdFilter, getSortFilter } from '@stamhoofd/structures';

import { AuthenticatedStructures } from '../../../../helpers/AuthenticatedStructures';
import { Context } from '../../../../helpers/Context';
import { paymentFilterCompilers } from '../../../../sql-filters/payments';
import { paymentSorters } from '../../../../sql-sorters/payments';

type Params = Record<string, never>;
type Query = LimitedFilteredRequest;
type Body = undefined;
type ResponseBody = PaginatedResponse<PaymentGeneral[], LimitedFilteredRequest>

const filterCompilers = paymentFilterCompilers
const sorters = paymentSorters

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
                $or: [
                    {
                        customer: {
                            name: {
                                $contains: q.search
                            }
                        }
                    },
                    {
                        customer: {
                            company: {
                                name: {
                                    $contains: q.search
                                }
                            }
                        }
                    },
                    {
                        balanceItemPayments: {
                            $elemMatch: {
                                balanceItem: {
                                    description: {
                                        $contains: q.search
                                    }
                                }
                            }
                        }
                    }
                ]
            }

            if (q.search.includes('@')) {
                searchFilter = {
                    $or: [
                        {
                            customer: {
                                email: {
                                    $contains: q.search
                                }
                            }
                        },
                        {
                            customer: {
                                company: {
                                    administrationEmail: {
                                        $contains: q.search
                                    }
                                }
                            }
                        },
                    ]
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
            results: await AuthenticatedStructures.paymentsGeneral(payments, true),
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
