import { SimpleError } from '@simonbackx/simple-errors';
import { RateLimiter } from '@stamhoofd/models';
import { QueueHandler } from '@stamhoofd/queues';
import type { CountFilteredRequest, IPaginatedResponse, StamhoofdFilter } from '@stamhoofd/structures';
import { LimitedFilteredRequest, SortItemDirection } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { fetchToAsyncIterator } from './fetchToAsyncIterator.js';

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
    count: (request: CountFilteredRequest) => Promise<number>;
    fetch: (request: LimitedFilteredRequest) => Promise<IPaginatedResponse<T[], LimitedFilteredRequest>>;
    handle: (results: T[]) => Promise<void> | void;
}): Promise<void> {
    // Clicking through the tabs of a breakdown would otherwise stack up requests that each block a
    // connection until the one before it is done
    if (QueueHandler.isRunning('breakdown-' + options.userId)) {
        throw new SimpleError({
            code: 'breakdown_pending',
            message: 'A breakdown is already running for this user',
            human: $t('Er worden al statistieken berekend, probeer het zo opnieuw.'),
            statusCode: 429,
        });
    }

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

            // Asked up front so a selection that is too big costs one query instead of reading it all
            assertBreakdownSize(await options.count(request));

            let count = 0;

            for await (const results of fetchToAsyncIterator(request, { fetch: options.fetch })) {
                count += results.length;

                // The selection can still have grown since it was counted
                assertBreakdownSize(count);

                await options.handle(results);
            }
        }, 5);
    });
}

function assertBreakdownSize(count: number) {
    if (count <= MAX_BREAKDOWN_OBJECTS) {
        return;
    }

    throw new SimpleError({
        code: 'too_many_objects',
        message: 'Too many objects to break down',
        human: $t('Deze selectie bevat meer dan {limit} items, dat zijn er te veel om statistieken van te maken. Kies een kortere periode of verfijn je selectie.', {
            limit: Formatter.integer(MAX_BREAKDOWN_OBJECTS),
        }),
        statusCode: 400,
    });
}
