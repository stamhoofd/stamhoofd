import { CountFilteredRequest, LimitedFilteredRequest, SortList, StamhoofdFilter } from "@stamhoofd/structures";

export interface ObjectFetcher<O> {
    extendSort?(list: SortList): SortList
    requiredFilter?: StamhoofdFilter|null|undefined
    fetch(data: LimitedFilteredRequest): Promise<{results: O[], next?: LimitedFilteredRequest}>

    fetchCount(data: CountFilteredRequest): Promise<number>

    destroy?(): void
}

export type FetchAllOptions = {
    onProgress?: (count: number, total: number) => void
}

export async function fetchAll<T>(initialRequest: LimitedFilteredRequest, objectFetcher: ObjectFetcher<T>, options?: FetchAllOptions) {
    // todo: check if we have all or nearly all already.
    let next: LimitedFilteredRequest|null = initialRequest

    let totalFilteredCount: number | null = null;
    if (options?.onProgress) {
        totalFilteredCount = await objectFetcher.fetchCount(initialRequest)
    }

    const results: T[] = []

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
        
        const data = await objectFetcher.fetch(next)
        next = data.next ?? null;
        results.push(...data.results)

        if (data.results.length === 0) {
            next = null;
        }

        if (options?.onProgress) {
            options.onProgress(results.length, totalFilteredCount ?? results.length)
        }
    }

    return results;
}
