import { SimpleError } from '@simonbackx/simple-errors';
import { BalanceItem, Order, RateLimiter } from '@stamhoofd/models';
import { QueueHandler } from '@stamhoofd/queues';
import type { IPaginatedResponse, OrderData, StamhoofdFilter } from '@stamhoofd/structures';
import { BalanceItemPaymentWithPrivatePayment, LimitedFilteredRequest, PrivatePayment, SortItemDirection } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { fetchToAsyncIterator } from '../helpers/fetchToAsyncIterator.js';

/**
 * A breakdown groups the objects one by one instead of in SQL, so the grouping rules are the same ones
 * the rest of the app uses. That means every object has to be read, which is the same work an Excel
 * export does.
 *
 * They are read page by page and added up right away, so they are never all in memory at once. Above
 * this many objects a breakdown takes too long to wait for, so we ask the user to narrow down instead.
 */
export const MAX_BREAKDOWN_OBJECTS = 10000;

const PAGE_SIZE = 100;

/**
 * Breakdowns are read-only, but they read a lot. They are protected the same way exports are: a limit
 * per user, one at a time per user and a maximum number running at the same time.
 */
export const breakdownLimiter = new RateLimiter({
    limits: [
        {
            limit: 100,
            duration: 5 * 60 * 1000,
        },
        {
            limit: 1000,
            duration: 60 * 1000 * 60 * 24,
        },
    ],
});

/**
 * Reads every object matching the filter, page by page, and hands each page over to be added up.
 */
export async function streamForBreakdown<T>(options: {
    userId: string;
    filter: StamhoofdFilter;
    search: string | null;
    fetch: (request: LimitedFilteredRequest) => Promise<IPaginatedResponse<T[], LimitedFilteredRequest>>;
    handle: (results: T[]) => Promise<void> | void;
}): Promise<void> {
    breakdownLimiter.track(options.userId, 1);

    // One breakdown per user at a time, and never more than 5 for all users together
    await QueueHandler.schedule('breakdown-' + options.userId, async () => {
        await QueueHandler.schedule('breakdown', async () => {
            const request = new LimitedFilteredRequest({
                filter: options.filter,
                search: options.search,
                limit: PAGE_SIZE,
                sort: [
                    { key: 'id', order: SortItemDirection.ASC },
                ],
            });

            let count = 0;

            for await (const results of fetchToAsyncIterator(request, { fetch: options.fetch })) {
                count += results.length;

                if (count > MAX_BREAKDOWN_OBJECTS) {
                    throw new SimpleError({
                        code: 'too_many_objects',
                        message: 'Too many objects to break down',
                        human: $t('Deze selectie bevat meer dan {limit} items, dat zijn er te veel om statistieken van te maken. Kies een kortere periode of verfijn je selectie.', {
                            limit: Formatter.integer(MAX_BREAKDOWN_OBJECTS),
                        }),
                        statusCode: 400,
                    });
                }

                await options.handle(results);
            }
        }, 5);
    });
}

/**
 * A webshop order is charged as one balance item, so the articles that were ordered are only visible
 * inside the order itself.
 */
export async function loadOrdersForBreakdown(orderIds: (string | null)[]): Promise<Map<string, OrderData>> {
    const ids = Formatter.uniqueArray(orderIds.flatMap(id => id ? [id] : []));

    if (ids.length === 0) {
        return new Map();
    }

    const orders = await Order.getByIDs(...ids);
    return new Map(orders.map(order => [order.id, order.data]));
}

/**
 * The payments that paid for these balance items, per balance item id. A balance item doesn't know how
 * it was paid, so the payouts it was part of are only visible through its payments (see
 * PaymentSettlementGroup).
 */
export async function loadPaymentsForBreakdown(balanceItemIds: string[]): Promise<Map<string, BalanceItemPaymentWithPrivatePayment[]>> {
    if (balanceItemIds.length === 0) {
        return new Map();
    }

    const { payments, balanceItemPayments } = await BalanceItem.loadPayments(balanceItemIds.map(id => ({ id })));
    const paymentsById = new Map(payments.map(payment => [payment.id, PrivatePayment.create(payment)]));
    const result = new Map<string, BalanceItemPaymentWithPrivatePayment[]>();

    for (const balanceItemPayment of balanceItemPayments) {
        const payment = paymentsById.get(balanceItemPayment.paymentId);

        if (!payment) {
            continue;
        }

        const list = result.get(balanceItemPayment.balanceItemId) ?? [];
        list.push(BalanceItemPaymentWithPrivatePayment.create({ ...balanceItemPayment, payment }));
        result.set(balanceItemPayment.balanceItemId, list);
    }

    return result;
}
