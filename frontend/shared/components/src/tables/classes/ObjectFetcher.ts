import { SimpleError } from '@simonbackx/simple-errors';
import type { LimitedFilteredRequest, SortList, StamhoofdFilter } from '@stamhoofd/structures';
import { CountFilteredRequest } from '@stamhoofd/structures';

export interface ObjectFetcher<O> {
    extendSort?(list: SortList): SortList;
    requiredFilter?: StamhoofdFilter | null | undefined;
    /**
     * signal is aborted when the result is no longer needed (e.g. the search query changed).
     * Implementations may ignore it, but long running local work should stop on it.
     */
    fetch(data: LimitedFilteredRequest, options?: { shouldRetry?: boolean; signal?: AbortSignal }): Promise<{ results: O[]; next?: LimitedFilteredRequest }>;

    fetchCount(data: CountFilteredRequest, options?: { signal?: AbortSignal }): Promise<number>;

    destroy?(): void;

    /**
     * Returns true if operating in offline mode. Can be used for UI hints
     */
    isOffline?: boolean;
}

export interface FetchLimitSettings {
    // if the total count is higher than this limit an error will be thrown
    limit: number;
    createErrorMessage: (count: number, limit: number) => string;
}

export type FetchAllOptions<T> = {
    onProgress?: (count: number, total: number) => Promise<void> | void;
    onResultsReceived?: (results: T[]) => Promise<void> | void;
    fetchLimitSettings?: FetchLimitSettings;
    /**
     * Replaces the upfront count for onProgress: called once the first page indicates more results follow,
     * so single page fetches skip the count. It does not delay fetching the next pages.
     * onProgress is only called once this returns a number, and not if it fails.
     */
    countAfterFirstPage?: () => Promise<number | null>;
};

export async function fetchAll<T>(initialRequest: LimitedFilteredRequest, objectFetcher: ObjectFetcher<T>, options?: FetchAllOptions<T>) {
    // todo: check if we have all or nearly all already.
    let next: LimitedFilteredRequest | null = initialRequest;

    let totalFilteredCount: number | null = null;
    if ((options?.onProgress && !options.countAfterFirstPage) || options?.fetchLimitSettings !== undefined) {
        totalFilteredCount = await objectFetcher.fetchCount(initialRequest);

        if (options.fetchLimitSettings !== undefined && totalFilteredCount > options.fetchLimitSettings.limit) {
            throw new SimpleError({
                code: 'fetch_limit_exceeded',
                message: options.fetchLimitSettings.createErrorMessage(totalFilteredCount, options.fetchLimitSettings.limit),
            });
        }
    }

    const results: T[] = [];
    let hasStartedCount = false;
    let isDone = false;

    const reportProgress = async () => {
        if (!options?.onProgress) {
            return;
        }
        if (!options.countAfterFirstPage) {
            await options.onProgress(results.length, totalFilteredCount ?? results.length);
        } else if (totalFilteredCount !== null) {
            // Results updated while fetching can push the count past the total
            await options.onProgress(results.length, Math.max(results.length, totalFilteredCount));
        }
    };

    while (next) {
        // Override filter
        // Because the filter could have been changed by the object fetcher, and we don't want to reapply any custom filters
        // on the already custom filter that we got from the server
        next.filter = initialRequest.filter;

        // Same for sorting
        next.sort = [];
        if (objectFetcher.extendSort) {
            next.sort = objectFetcher.extendSort(initialRequest.sort);
        }

        const data = await objectFetcher.fetch(next);
        next = data.next ?? null;
        results.push(...data.results);

        if (data.results.length === 0) {
            next = null;
        }

        if (options?.countAfterFirstPage && !hasStartedCount && next) {
            hasStartedCount = true;

            // Runs alongside the next pages and reports progress once known
            void options.countAfterFirstPage().then(async (count) => {
                totalFilteredCount = count;
                if (!isDone) {
                    await reportProgress();
                }
            }).catch((e: unknown) => {
                // Progress is optional, so a failing count should not stop fetching
                console.error(e);
            });
        }

        await reportProgress();

        if (options?.onResultsReceived) {
            await options.onResultsReceived(data.results);
        }
    }

    isDone = true;
    return results;
}

export async function countAll<T>(objectFetcher: ObjectFetcher<T>, data?: CountFilteredRequest): Promise<number> {
    if (!data) {
        data = new CountFilteredRequest({
            filter: objectFetcher.requiredFilter ?? null,
        });
    }
    
    return await objectFetcher.fetchCount(data);
}
