import { DecodedRequest, Endpoint, Request, Response } from '@simonbackx/simple-endpoints';
import { assertSort, CountFilteredRequest, getOrderSearchFilter, getSortFilter, LimitedFilteredRequest, PaginatedResponse, PrivateOrder, StamhoofdFilter } from '@stamhoofd/structures';

import { Order } from '@stamhoofd/models';
import { applySQLSorter, compileToSQLFilter, SQL, SQLFilterDefinitions, SQLSortDefinitions } from '@stamhoofd/sql';

import { Decoder } from '@simonbackx/simple-encoding';
import { parsePhoneNumber } from 'libphonenumber-js/max';
import { AuthenticatedStructures } from '../../../../helpers/AuthenticatedStructures.js';
import { Context } from '../../../../helpers/Context.js';
import { LimitedFilteredRequestHelper } from '../../../../helpers/LimitedFilteredRequestHelper.js';
import { orderFilterCompilers } from '../../../../sql-filters/orders.js';
import { orderSorters } from '../../../../sql-sorters/orders.js';

type Params = Record<string, never>;
type Query = LimitedFilteredRequest;
type Body = undefined;
type ResponseBody = PaginatedResponse<PrivateOrder[], LimitedFilteredRequest>;

const filterCompilers: SQLFilterDefinitions = orderFilterCompilers;
const sorters: SQLSortDefinitions<Order> = orderSorters;

export class GetWebshopOrdersEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    queryDecoder = LimitedFilteredRequest as Decoder<LimitedFilteredRequest>;

    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method !== 'GET') {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, '/webshop/orders', {});

        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    static async buildQuery(q: CountFilteredRequest | LimitedFilteredRequest) {
        // todo: filter userId???
        const organization = Context.organization!;

        const ordersTable: string = Order.table;

        const query = SQL
            .select(SQL.wildcard(ordersTable))
            .from(SQL.table(ordersTable))
            .where(await compileToSQLFilter({
                organizationId: organization.id,
                number: {
                    $neq: null,
                },
            }, filterCompilers));

        if (q.filter) {
            query.where(await compileToSQLFilter(q.filter, filterCompilers));
        }

        if (q.search) {
            const searchFilter: StamhoofdFilter | null = getOrderSearchFilter(q.search, parsePhoneNumber);

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
        const data = await query.fetch();

        const orders: Order[] = Order.fromRows(data, Order.table);

        let next: LimitedFilteredRequest | undefined;

        if (orders.length >= requestQuery.limit) {
            const lastObject = orders[orders.length - 1];
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

        return new PaginatedResponse<PrivateOrder[], LimitedFilteredRequest>({
            results: await AuthenticatedStructures.orders(orders),
            next,
        });
    }

    async handle(request: DecodedRequest<Params, Query, Body>): Promise<Response<ResponseBody>> {
        const organization = await Context.setOrganizationScope();
        await Context.authenticate();

        // Fast throw first (more in depth checking for patches later)
        if (!await Context.auth.hasSomeAccess(organization.id)) {
            throw Context.auth.error();
        }

        LimitedFilteredRequestHelper.throwIfInvalidLimit({
            request: request.query,
            maxLimit: Context.auth.hasSomePlatformAccess() ? 1000 : 100,
        });

        return new Response(
            await GetWebshopOrdersEndpoint.buildData(request.query),
        );

        /*

        let orders: Order[] | undefined = undefined
        const limit = 50

        if (request.query.updatedSince !== undefined) {
            if (request.query.afterNumber !== undefined) {
                orders = await Order.select("WHERE webshopId = ? AND number is not null AND (updatedAt > ? OR (updatedAt = ? AND number > ?)) ORDER BY updatedAt, number LIMIT ?", [webshop.id, request.query.updatedSince, request.query.updatedSince, request.query.afterNumber, limit])
            } else {
                orders = await Order.select("WHERE webshopId = ? AND number is not null AND updatedAt >= ? ORDER BY updatedAt, number LIMIT ?", [webshop.id, request.query.updatedSince, limit])
            }
        } else if (request.query.afterNumber !== undefined) {
            orders = await Order.select("WHERE webshopId = ? AND number > ? ORDER BY updatedAt, number LIMIT ?", [webshop.id, request.query.afterNumber, limit])
        } else {
            orders = await Order.select("WHERE webshopId = ? AND number is not null ORDER BY updatedAt, number LIMIT ?", [webshop.id, limit])
        }

        //const paymentIds = orders.map(o => o.paymentId).filter(p => !!p) as string[]
        //if (paymentIds.length > 0) {
        //    const payments = await Payment.getByIDs(...paymentIds)
        //    for (const order of orders) {
        //        const payment = payments.find(p => p.id === order.paymentId)
        //        order.setOptionalRelation(Order.payment, payment ?? null)
        //    }
        //} else {
        //     for (const order of orders) {
        //        order.setOptionalRelation(Order.payment, null)
        //    }
        //}

        const structures = await Order.getPrivateStructures(orders)

        return new Response(
            new PaginatedResponse({
                results: structures,
                next: orders.length >= limit ? WebshopOrdersQuery.create({
                    updatedSince: orders[orders.length - 1].updatedAt ?? undefined,
                    afterNumber: orders[orders.length - 1].number ?? undefined
                }) : undefined
            })
        ); */
    }
}
