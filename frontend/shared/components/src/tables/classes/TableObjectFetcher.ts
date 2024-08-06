import { Request } from "@simonbackx/simple-networking";
import { CountFilteredRequest, LimitedFilteredRequest, SortList, StamhoofdFilter, mergeFilters } from "@stamhoofd/structures";
import { onBeforeUnmount, reactive } from "vue";
import { useAuth } from "../../hooks";
import { ObjectFetcher } from "./ObjectFetcher";

export type FetchAllOptions = {
    onProgress?: (count: number, total: number) => void
}

export function useTableObjectFetcher<O extends {id: string}, OF extends ObjectFetcher<O> = ObjectFetcher<O>>(objectFetcher: OF): TableObjectFetcher<O> {
    const auth = useAuth();
    const fetcher = reactive(new TableObjectFetcher<O>({
        objectFetcher,
        maxLimit: auth.hasSomePlatformAccess() ? 1000 : 100
    })) as any

    onBeforeUnmount(() => {
        fetcher.destroy()
    });

    return fetcher;
}

export class TableObjectFetcher<O extends {id: string}> {
    objectFetcher: ObjectFetcher<O>
    
    objects: O[] = []
    baseFilter: StamhoofdFilter|null = null
    searchQuery = ''
    
    currentStartIndex = 0;
    currentEndIndex = 0;
    fetchMargin = 0

    totalCount: number|null = null
    totalFilteredCount: number|null = null

    fetchingCount = false;
    fetchingFilteredCount = false;
    fetchingData = false;
    delayFetchUntil: Date|null = null;

    limit = 100
    maxLimit = 100
    minimumLimit = 20
    sort: SortList = []

    retryTimer: NodeJS.Timeout|null = null;
    retryCount = 0;

    errorState: Error|null = null;

    // todo: add rate limits if scrolling too fast
    _clearIndex = 0;

    nextRequest: LimitedFilteredRequest|null = null;

    constructor({objectFetcher, maxLimit}: {objectFetcher: ObjectFetcher<O>, maxLimit?: number}) {
        this.objectFetcher = objectFetcher
        this.maxLimit = maxLimit ?? this.maxLimit
    }

    get filter() {
        return mergeFilters([this.baseFilter, this.objectFetcher.requiredFilter ?? null]);
    }

    destroy() {
        this._clearIndex += 1;
        Request.cancelAll(this.objectFetcher)
        if (this.objectFetcher.destroy) {
            this.objectFetcher.destroy()
        }
        this.objects = [] // Fast memory cleanup
    }

    async fetchAll(options?: FetchAllOptions) {
        // todo: check if we have all or nearly all already.

        let next: LimitedFilteredRequest|null = new LimitedFilteredRequest({
            filter: this.filter,
            pageFilter: null,
            sort: [], // use default most performant sort
            limit: this.maxLimit,
            search: this.searchQuery
        });

        const results: O[] = []

        while (next) {
            // Override filter
            // Because the filter could have been changed by the object fetcher, and we don't want to reapply any custom filters
            // on the already custom filter that we got from the server
            next.filter = this.filter;

            // Same for sorting
            next.sort = [];
            
            const data = await this.objectFetcher.fetch(next)
            next = data.next ?? null;
            results.push(...data.results)

            if (data.results.length === 0) {
                next = null;
            }

            if (options?.onProgress) {
                options.onProgress(results.length, this.totalFilteredCount ?? results.length)
            }
        }

        return results;
    }

    resetRetryCount() {
        this.retryCount = 0;
    }

    cancelRetry() {
        if (this.retryTimer) {
            clearTimeout(this.retryTimer)
            this.retryTimer = null;
        }
    }

    scheduleRetry(error: Error) {
        if (this.retryTimer) {
            return;
        }

        if (!Request.isNetworkError(error)) {
            // Do not retry but display the message and ask a manual retry
            this.errorState = error;
            return
        }

        this.retryCount += 1;

        const waitTime = Math.min(this.retryCount * 5 * 1000, 20000)
        const shorterWaitTime = Math.min(this.retryCount * 200, 20000)

        // Require mininmum wait time, if a reset happens before the wait time
        this.delayFetchUntil = new Date(new Date().getTime() + shorterWaitTime)

        this.retryTimer = setTimeout(() => {
            console.info('Retrying fetching after '+waitTime/1000+'s: now')
            this.fetchIfNeeded().catch(console.error)
        }, waitTime)
    }

    reset(total = false, filteredCount = false) {
        console.info('Reset')

        this._clearIndex += 1;
        this.objects = []

        if (total) {
            this.totalCount = null;
        }
        if (filteredCount) {
            this.totalFilteredCount = null;
        }

        if (this.totalCount !== null && !this.filter && !this.searchQuery) {
            this.totalFilteredCount = this.totalCount
        }
        
        this.fetchingCount = false;
        this.fetchingFilteredCount = false;
        this.fetchingData = false;
        this.errorState = null;
        this.resetRetryCount();
        this.cancelRetry()

        this.nextRequest = new LimitedFilteredRequest({
            filter: this.filter,
            pageFilter: null,
            sort: this.sort,
            limit: this.minimumLimit,
            search: this.searchQuery
        })
        this.fetchIfNeeded().catch(console.error)
    }
    
    setSearchQuery(query: string) {
        if (query === this.searchQuery) {
            return;
        }

        if (this.searchQuery || query) {
            // force debounce for search queries
            this.delayFetchUntil = new Date(new Date().getTime() + 500)
        } else {
            this.delayFetchUntil = null;
        }

        this.searchQuery = query;
        this.reset(false, true)
    }
    
    setFilter(filter: StamhoofdFilter|null) {
        if (JSON.stringify(this.baseFilter ?? {}) == JSON.stringify(filter ?? {})) {
            console.log('setFilter unchanged')
            return;
        }
        console.log('setFilter', filter)

        this.baseFilter = filter;
        this.reset(false, true);
    }

    setSort(sort: SortList) {
        if (JSON.stringify(this.sort) == JSON.stringify(sort)) {
            return;
        }
        console.log('setSort', this.sort)

        this.sort = sort;
        this.reset(false, false);
    }

    setVisible(startIndex: number, endIndex: number) {
        if (this.currentStartIndex === startIndex && this.currentEndIndex === endIndex) {
            return;
        }
        console.log('Set visible', startIndex, endIndex)

        // Load more if needed
        this.currentStartIndex = startIndex
        this.currentEndIndex = endIndex
        this.fetchIfNeeded().catch(console.error)
    }

    async fetchIfNeeded() {
        if (this.fetchingData) {
            console.warn('Already fetching data')
            return;
        }

        if (this.errorState) {
            console.info('Skipped fetching due to error state');
            return;
        }

        if (this.currentEndIndex === 0) {
            console.info('Skipped fetching: no visible index defined');
            return;
        }

        if (this.delayFetchUntil) {
            if (new Date() < this.delayFetchUntil) {
                console.info('Delayed fetching');
                if (!this.retryTimer) {
                    this.retryTimer = setTimeout(() => {
                        console.info('Run delayed fetching');
                        this.fetchIfNeeded().catch(console.error)
                    }, this.delayFetchUntil.getTime() - Date.now() + 5)
                }
                return;
            }
        }

        if (!this.nextRequest) {
            console.warn('No next request');
            return;
        }

        console.info('Started fetching')
        this.cancelRetry()

        this.fetchingData = true;
        const currentClearIndex = this._clearIndex;

        try {
            const hasFilter = !!this.baseFilter || !!this.searchQuery;
            if ((!this.fetchingCount && this.totalCount === null) || (!hasFilter && !this.fetchingFilteredCount && this.totalFilteredCount === null)) {
                this.fetchingCount = true;

                if (!hasFilter) {
                    this.fetchingFilteredCount = true;
                }

                // Fetch count in parallel
                this.objectFetcher.fetchCount(new CountFilteredRequest({
                    filter: this.objectFetcher.requiredFilter
                })).then((c) => {
                    if (currentClearIndex !== this._clearIndex) {
                        // Discard old requests
                        return;
                    }
                    this.totalCount = c;
                    this.fetchingCount = false;

                    if (!hasFilter) {
                        this.totalFilteredCount = c;
                        this.fetchingFilteredCount = false;
                    }

                    this.fetchIfNeeded().catch(console.error);
                }).catch(console.error)
            }

            if (!this.fetchingFilteredCount && this.totalFilteredCount === null && hasFilter) {
                this.fetchingFilteredCount = true;

                // Fetch count in parallel
                this.objectFetcher.fetchCount(new CountFilteredRequest({filter: this.filter, search: this.searchQuery})).then((c) => {
                    if (currentClearIndex !== this._clearIndex) {
                        // Discard old requests
                        return;
                    }
                    this.totalFilteredCount = c;
                    this.fetchingFilteredCount = false;
                }).catch(console.error)
            }

            const fetchUntil = this.totalFilteredCount !== null ? Math.min(this.totalFilteredCount, this.currentEndIndex + 1 + this.fetchMargin) : (this.currentEndIndex + 1 + this.fetchMargin) // +1 is required to convert index to total items
            if (fetchUntil > this.objects.length) {
                console.log('has ', this.objects.length, 'objects', 'fetch until', fetchUntil)

                // Fetch next page
                const limit = Math.max(this.minimumLimit, Math.min(this.limit, fetchUntil - this.objects.length))

                // Override limit
                this.nextRequest.limit = limit;

                // Override filter
                // Because the filter could have been changed by the object fetcher, and we don't want to reapply any custom filters
                // on the already custom filter that we got from the server
                this.nextRequest.filter = this.filter;

                // Same for sorting
                this.nextRequest.sort = this.sort;
                
                const data = await this.objectFetcher.fetch(this.nextRequest)
                if (currentClearIndex !== this._clearIndex) {
                    // Discard old requests
                    console.warn('Discarded fetch result')
                    return;
                }

                this.resetRetryCount();

                const objects = data.results;
                this.nextRequest = data.next ?? null;

                if (STAMHOOFD.environment === 'development') {
                    for (const o of this.objects) {
                        for (const oo of objects) {
                            if (oo.id === o.id) {
                                console.warn('Duplicate objects found. Fetched ' + oo.id)
                                break;
                            }
                        }
                    }
                }
                this.objects.push(...objects)

                if (objects.length < limit && (this.totalFilteredCount === null || this.objects.length < this.totalFilteredCount)) {
                    console.warn('Unexpected end of data')
                    this.totalFilteredCount = this.objects.length;
                    console.info('Stopped fetching')
                    this.fetchingData = false;

                    if (!hasFilter) {
                        this.totalCount = this.objects.length
                    }
                    return;
                }
                
                console.info('Stopped fetching')
                this.fetchingData = false;
                this.fetchIfNeeded().catch(console.error)
            } else {
                console.info('Stopped fetching')
                this.fetchingData = false;
                console.log('No fetch required.', this.objects.length, '/', this.totalFilteredCount)
            }
        } catch (e) {
            if (currentClearIndex === this._clearIndex) {
                console.error('Stopped fetching due to error')
                console.error(e)
                this.fetchingData = false;
                this.scheduleRetry(e as Error)
            }
            throw e;
        }
    }
}
