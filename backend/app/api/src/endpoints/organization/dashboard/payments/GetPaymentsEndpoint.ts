import { Decoder } from '@simonbackx/simple-encoding';
import { DecodedRequest, Endpoint, Request, Response } from '@simonbackx/simple-endpoints';
import { SimpleError } from '@simonbackx/simple-errors';
import { Payment } from '@stamhoofd/models';
import { SQL, applySQLSorter, compileToSQLFilter } from '@stamhoofd/sql';
import { CountFilteredRequest, LimitedFilteredRequest, PaginatedResponse, PaymentGeneral, StamhoofdFilter, TransferSettings, assertSort, getSortFilter } from '@stamhoofd/structures';

import { SQLResultNamespacedRow } from '@simonbackx/simple-database';
import { AuthenticatedStructures } from '../../../../helpers/AuthenticatedStructures.js';
import { Context } from '../../../../helpers/Context.js';
import { paymentFilterCompilers } from '../../../../sql-filters/payments.js';
import { paymentSorters } from '../../../../sql-sorters/payments.js';

type Params = Record<string, never>;
type Query = LimitedFilteredRequest;
type Body = undefined;
type ResponseBody = PaginatedResponse<PaymentGeneral[], LimitedFilteredRequest>;

const filterCompilers = paymentFilterCompilers;
const sorters = paymentSorters;

export class GetPaymentsEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    queryDecoder = LimitedFilteredRequest as Decoder<LimitedFilteredRequest>;

    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method !== 'GET') {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, '/payments', {});

        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    static async buildQuery(q: CountFilteredRequest | LimitedFilteredRequest) {
        const organization = Context.organization;
        let scopeFilter: StamhoofdFilter | undefined = undefined;

        if (!organization) {
            throw Context.auth.error();
        }

        if (!await Context.auth.canManagePayments(organization.id)) {
            throw Context.auth.error();
        }

        scopeFilter = {
            organizationId: organization.id,
        };

        const query = SQL
            .select()
            .setMaxExecutionTime(15 * 1000)
            .from(
                SQL.table('payments'),
            );

        if (scopeFilter) {
            query.where(await compileToSQLFilter(scopeFilter, filterCompilers));
        }

        if (q.filter) {
            query.where(await compileToSQLFilter(q.filter, filterCompilers));
        }

        if (q.search) {
            // todo

            let searchFilter: StamhoofdFilter | null = null;
            searchFilter = {
                $or: [
                    {
                        customer: {
                            name: {
                                $contains: q.search,
                            },
                        },
                    },
                    {
                        customer: {
                            company: {
                                name: {
                                    $contains: q.search,
                                },
                            },
                        },
                    },
                    {
                        balanceItemPayments: {
                            $elemMatch: {
                                balanceItem: {
                                    description: {
                                        $contains: q.search,
                                    },
                                },
                            },
                        },
                    },
                    {
                        transferDescription: {
                            $contains: q.search,
                        },
                    },
                ],
            };

            if (q.search.includes('@')) {
                searchFilter = {
                    $or: [
                        {
                            customer: {
                                email: {
                                    $contains: q.search,
                                },
                            },
                        },
                        {
                            customer: {
                                company: {
                                    administrationEmail: {
                                        $contains: q.search,
                                    },
                                },
                            },
                        },
                    ],
                };
            }

            const transferDescription = q.search.replaceAll('+', '').replaceAll('/', '');
            if (transferDescription.length === '562100153542'.length && !isNaN(parseInt(transferDescription))) {
                // Format to
                const formatted = TransferSettings.structureOGM(transferDescription);

                // Search for structured transfer
                searchFilter = {
                    transferDescription: formatted,
                };
            }

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
        const query = await this.buildQuery(requestQuery);
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

        const payments = Payment.fromRows(data, 'payments');

        let next: LimitedFilteredRequest | undefined;

        if (payments.length >= requestQuery.limit) {
            const lastObject = payments[payments.length - 1];
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

        return new PaginatedResponse<PaymentGeneral[], LimitedFilteredRequest>({
            results: await AuthenticatedStructures.paymentsGeneral(payments, true),
            next,
        });
    }

    async handle(request: DecodedRequest<Params, Query, Body>) {
        await Context.setOrganizationScope();
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
            await GetPaymentsEndpoint.buildData(request.query),
        );
    }
}
