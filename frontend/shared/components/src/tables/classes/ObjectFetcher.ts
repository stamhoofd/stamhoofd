import { SimpleError } from '@simonbackx/simple-errors';
import { CountFilteredRequest, LimitedFilteredRequest, SortList, StamhoofdFilter } from '@stamhoofd/structures';

export interface ObjectFetcher<O> {
    extendSort?(list: SortList): SortList;
    requiredFilter?: StamhoofdFilter | null | undefined;
    fetch(data: LimitedFilteredRequest, options?: { shouldRetry?: boolean }): Promise<{ results: O[]; next?: LimitedFilteredRequest }>;

    fetchCount(data: CountFilteredRequest): Promise<number>;

    destroy?(): void;
}

export interface FetchLimitSettings {
    // if the total count is higher than this limit an error will be thrown
    limit: number;
    createErrorMessage: (count: number, limit: number) => string;
}

export type FetchAllOptions<T> = {
    onProgress?: (count: number, total: number) => void;
    onResultsReceived?: (results: T[]) => void;
    fetchLimitSettings?: FetchLimitSettings;
};

export async function fetchAll<T>(initialRequest: LimitedFilteredRequest, objectFetcher: ObjectFetcher<T>, options?: FetchAllOptions<T>) {
    // todo: check if we have all or nearly all already.
    let next: LimitedFilteredRequest | null = initialRequest;

    let totalFilteredCount: number | null = null;
    if (options?.onProgress || options?.fetchLimitSettings !== undefined) {
        totalFilteredCount = await objectFetcher.fetchCount(initialRequest);

        if (options.fetchLimitSettings !== undefined && totalFilteredCount > options.fetchLimitSettings.limit) {
            throw new SimpleError({
                code: 'fetch_limit_exceeded',
                message: options.fetchLimitSettings.createErrorMessage(totalFilteredCount, options.fetchLimitSettings.limit),
            });
        }
    }

    const results: T[] = [];

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

        if (options?.onProgress) {
            options.onProgress(results.length, totalFilteredCount ?? results.length);
        }

        if (options?.onResultsReceived) {
            options.onResultsReceived(results);
        }
    }

    return results;
}
