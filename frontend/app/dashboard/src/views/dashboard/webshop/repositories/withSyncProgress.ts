import type { ObjectFetcher } from '@stamhoofd/components/tables/classes/ObjectFetcher.ts';
import type { StamhoofdFilter } from '@stamhoofd/structures';
import { CountFilteredRequest } from '@stamhoofd/structures';

export type SyncProgress = { count: number; total: number };

/**
 * Reports progress once a sync turns out to span more than one page and contains items that were not
 * downloaded before. Single page syncs skip the count requests.
 *
 * @param newItemsFilter matches the items of the sync that are not stored yet, null if none are stored
 */
export function withSyncProgress<T>(fetcher: ObjectFetcher<T>, newItemsFilter: StamhoofdFilter | null, onProgress: (progress: SyncProgress) => void): ObjectFetcher<T> {
    let count = 0;
    let total: number | null = null;
    let hasNewItems = false;

    return {
        ...fetcher,
        fetch: async (data) => {
            const response = await fetcher.fetch(data);

            if (total === null && response.next) {
                const [all, newItems] = await Promise.all([
                    fetcher.fetchCount(new CountFilteredRequest({ filter: data.filter })),
                    newItemsFilter ? fetcher.fetchCount(new CountFilteredRequest({ filter: newItemsFilter })) : null,
                ]);
                total = all;
                hasNewItems = newItems === null || newItems > 0;
            }

            count += response.results.length;
            if (total !== null && hasNewItems) {
                // Items updated during the sync can push the count past the total
                onProgress({ count, total: Math.max(count, total) });
            }
            return response;
        },
    };
}
