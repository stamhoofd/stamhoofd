import { Request } from "@simonbackx/simple-networking";
import { LimitedFilteredRequest, SortList, StamhoofdFilter, mergeFilters } from "@stamhoofd/structures";
import { onBeforeUnmount, reactive } from "vue";
import { ObjectFetcher } from "./ObjectFetcher";

export function useInfiniteObjectFetcher<O extends {id: string}, OF extends ObjectFetcher<O> = ObjectFetcher<O>>(objectFetcher: OF): InfiniteObjectFetcher<O> {
    const fetcher = reactive(new InfiniteObjectFetcher<O>({
        objectFetcher
    })) as any

    onBeforeUnmount(() => {
        fetcher.destroy()
    });

    return fetcher;
}


/**
 * Fetch objects in an infinite list
 * -> instead of having a start and end index which can get calculated easily,
 * the external system should only notify the fetcher when it reached (almost) the end of the list
 * 
 * The list doesn't fetch the total counts
 */
export class InfiniteObjectFetcher<O extends {id: string}> {
    objectFetcher: ObjectFetcher<O>
    
    objects: O[] = []
    baseFilter: StamhoofdFilter|null = null
    searchQuery = ''
    
    fetchingData = false;
    delayFetchUntil: Date|null = null;

    limit = 20
    sort: SortList = []

    /**
     * Whether the end of the list has been reached, and we should fetch more if possible
     */
    hasReachedEnd = false;

    /**
     * Set to false if we know there are no more objects to fetch
     */
    hasMoreObjects = true;

    retryTimer: NodeJS.Timeout|null = null;
    retryCount = 0;

    errorState: Error|null = null;

    // todo: add rate limits if scrolling too fast
    _clearIndex = 0;

    nextRequest: LimitedFilteredRequest|null = null;

    constructor({objectFetcher}: {objectFetcher: ObjectFetcher<O>}) {
        this.objectFetcher = objectFetcher
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
        this.objects = reactive([]) // Fast memory cleanup
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

    reset() {
        console.info('Reset')

        this._clearIndex += 1;
        this.objects = reactive([])
        this.hasMoreObjects = true;
        this.fetchingData = false;
        this.errorState = null;
        this.hasReachedEnd = true
        this.resetRetryCount();
        this.cancelRetry()

        this.nextRequest = new LimitedFilteredRequest({
            filter: this.filter,
            pageFilter: null,
            sort: this.sort,
            limit: this.limit,
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
        this.reset()
    }
    
    setFilter(filter: StamhoofdFilter|null) {
        if (JSON.stringify(this.baseFilter ?? {}) == JSON.stringify(filter ?? {})) {
            console.log('setFilter unchanged')
            return;
        }
        console.log('setFilter', filter)

        this.baseFilter = filter;
        this.reset();
    }

    setSort(sort: SortList) {
        if (JSON.stringify(this.sort) == JSON.stringify(sort)) {
            return;
        }
        console.log('setSort', this.sort)

        this.sort = sort;
        this.reset();
    }

    setReachedEnd(hasReachedEnd: boolean) {
        if (this.hasReachedEnd === hasReachedEnd) {
            return;
        }
        console.log('Set hasReachedEnd', hasReachedEnd)

        // Load more if needed
        this.hasReachedEnd = hasReachedEnd
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

        if (!this.hasReachedEnd && this.objects.length > 0) {
            console.info('Skipped fetching: not at the end of the list');
            return;
        }

        if (!this.hasMoreObjects) {
            console.info('Skipped fetching: no more objects');
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
            this.nextRequest = new LimitedFilteredRequest({
                filter: this.filter,
                pageFilter: null,
                sort: this.sort,
                limit: this.limit,
                search: this.searchQuery
            })
        }

        console.info('Started fetching')
        this.cancelRetry()

        this.fetchingData = true;
        const currentClearIndex = this._clearIndex;

        try {            
            // Fetch next page
            const limit = this.limit

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

            if (objects.length < limit) {
                console.warn('Reached end of data')
                this.hasMoreObjects = false;
                
                console.info('Stopped fetching')
                this.fetchingData = false;
                return;
            }
            
            console.info('Stopped fetching')
            this.fetchingData = false;

            // Fetch more if needed
            // But first wait on UI to render the new objects
            // and wait to notifiy the fetcher again
            
            this.fetchIfNeeded().catch(console.error)

            const shorterWaitTime = 150

            // Require mininmum wait time, if a reset happens before the wait time
            this.delayFetchUntil = new Date(new Date().getTime() + shorterWaitTime)

            this.retryTimer = setTimeout(() => {
                console.info('Retrying fetching after '+shorterWaitTime/1000+'s: now')
                this.fetchIfNeeded().catch(console.error)
            }, shorterWaitTime)

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
