import { PlainObject } from "@simonbackx/simple-encoding";
import { Request } from "@simonbackx/simple-networking";
import { SortList, StamhoofdFilter } from "@stamhoofd/structures";

import { UIFilterBuilder } from "../filters/UIFilter";

export interface ObjectFetcher<O> {
    get uiFilterBuilders(): UIFilterBuilder[]

    /**
     * Return the filter to fetch the next page, given last object
     */
    getNextFilter(lastObject: O|undefined, sort: SortList): StamhoofdFilter
    
    fetch(data: {
        filter?: StamhoofdFilter|null,
        limit: number,
        search?: string,
        sort: SortList
    }): Promise<O[]>

    fetchCount(data: {
        filter?: StamhoofdFilter|null,
        search?: string
    }): Promise<number>

    destroy(): void
}

export class TableObjectFetcher<O extends {id: string}> {
    objectFetcher: ObjectFetcher<O>
    
    objects: O[] = []
    filter: StamhoofdFilter|null = null
    searchQuery = ''
    
    currentStartIndex = 0;
    currentEndIndex = 0;
    fetchMargin = 0

    totalCount: number|null = null
    totalFilteredCount: number|null = null

    fetchingCount = false;
    fetchingFilteredCount = false;
    fetchingData = false;

    limit = 100
    minimumLimit = 20
    sort: SortList = []

    retryTimer: NodeJS.Timeout|null = null;
    retryCount = 0;

    errorState: Error|null = null;

    // todo: add rate limits if scrolling too fast
    #clearIndex = 0;

    constructor({objectFetcher}: {objectFetcher: ObjectFetcher<O>}) {
        this.objectFetcher = objectFetcher
    }

    destroy() {
        this.#clearIndex += 1;
        Request.cancelAll(this.objectFetcher)
        this.objectFetcher.destroy()
        this.objects = [] // Fast memory cleanup
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

        this.retryTimer = setTimeout(() => {
            console.info('Retrying fetching after '+waitTime/1000+'s: now')
            this.fetchIfNeeded().catch(console.error)
        }, waitTime)
    }

    reset(total = false, filteredCount = false) {
        console.info('Reset')

        this.#clearIndex += 1;
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
        this.fetchIfNeeded().catch(console.error)
    }

    setSearchQuery(query: string) {
        if (query === this.searchQuery) {
            return;
        }

        this.searchQuery = query;
        this.reset(false, true)
    }
    
    setFilter(filter: StamhoofdFilter|null) {
        if (JSON.stringify(this.filter ?? {}) == JSON.stringify(filter ?? {})) {
            return;
        }

        this.filter = filter;
        this.reset(false, true);
    }

    setSort(sort: SortList) {
        if (JSON.stringify(this.sort) == JSON.stringify(sort)) {
            return;
        }

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

        console.info('Started fetching')
        this.cancelRetry()

        this.fetchingData = true;
        const currentClearIndex = this.#clearIndex;

        try {
            const hasFilter = !!this.filter || !!this.searchQuery;
            if ((!this.fetchingCount && this.totalCount === null) || (!hasFilter && !this.fetchingFilteredCount && this.totalFilteredCount === null)) {
                this.fetchingCount = true;

                if (!hasFilter) {
                    this.fetchingFilteredCount = true;
                }

                // Fetch count in parallel
                this.objectFetcher.fetchCount({search: ''}).then((c) => {
                    if (currentClearIndex !== this.#clearIndex) {
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
                this.objectFetcher.fetchCount({filter: this.filter, search: this.searchQuery}).then((c) => {
                    if (currentClearIndex !== this.#clearIndex) {
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
                const lastObject = this.objects[this.objects.length - 1];
                const nextFilter = this.objectFetcher.getNextFilter(lastObject, this.sort)

                const limit = Math.min(this.limit, fetchUntil - this.objects.length)
                
                const objects = await this.objectFetcher.fetch({
                    filter: this.filter ? {
                        $and: [
                            // todo: this needs a proper definition
                            nextFilter,
                            this.filter
                        ]
                    } : nextFilter,
                    limit: Math.max(limit, this.minimumLimit),
                    search: this.searchQuery,
                    sort: this.sort
                })
                if (currentClearIndex !== this.#clearIndex) {
                    // Discard old requests
                    console.warn('Discarded fetch result')
                    return;
                }

                this.resetRetryCount();

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

                if (objects.length < limit && this.totalFilteredCount !== null && this.objects.length < this.totalFilteredCount) {
                    console.warn('Unexpected end of data')
                    this.totalFilteredCount = this.objects.length;
                    console.info('Stopped fetching')
                    this.fetchingData = false;
                    return;
                }
                
                console.info('Stopped fetching')
                this.fetchingData = false;
                this.fetchIfNeeded().catch(console.error)
            } else {
                console.info('Stopped fetching')
                this.fetchingData = false;
                console.log('No fetch required.', this.objects.length, '/', this.totalCount)
            }
        } catch (e) {
            if (currentClearIndex === this.#clearIndex) {
                console.info('Stopped fetching due to error')
                this.fetchingData = false;
                this.scheduleRetry(e as Error)
            }
            throw e;
        }
    }
}
