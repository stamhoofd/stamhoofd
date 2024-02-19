import { Data, StringDecoder } from "@simonbackx/simple-encoding";

type Filter = any;

type SortDefinition = {
    key: string;
    order: 'ASC' | 'DESC'
}

interface ObjectFetcher<O> {
    fetch(data: {
        filter: Filter,
        limit: number,
        search: string
    }): Promise<O[]>

    fetchCount(): Promise<number>
}

class TableObjectFetcher<O> {
    objectFetcher: ObjectFetcher<O>
    
    objects: O[] = []
    filter: Filter|null = null
    searchQuery = ''
    
    currentStartIndex = 0;
    currentEndIndex = 0;
    fetchMargin = 20

    totalCount: number|null = null
    totalFilteredCount: number|null = null

    limit = 50
    sort: SortDefinition[] = []

    // todo: add rate limits if scrolling too fast
    #clearIndex = 0;

    reset() {
        this.#clearIndex += 1;
        this.objects = []
        this.totalCount = null;
        this.fetchIfNeeded().catch(console.error)
    }

    setSearchQuery(query: string) {
        this.searchQuery = query;
        this.reset()
    }
    
    setFilter(filter: Filter) {
        this.filter = filter;
        this.reset();
    }

    setSort(sort: SortDefinition[]) {
        this.sort = sort;
        this.reset();
    }

    setVisible(startIndex: number, endIndex: number) {
        // Load more if needed
        this.currentStartIndex = startIndex
        this.currentEndIndex = endIndex
        this.fetchIfNeeded().catch(console.error)
    }

    async fetchIfNeeded() {
        const currentClearIndex = this.#clearIndex;

        if (this.totalCount === null) {
            // Fetch count in parallel
            this.objectFetcher.fetchCount().then((c) => {
                if (currentClearIndex !== this.#clearIndex) {
                    // Discard old requests
                    return;
                }
                this.totalCount = c;
                this.fetchIfNeeded().catch(console.error);
            }).catch(console.error)
        }

        const fetchUntil = Math.max(this.totalCount ?? 1, this.currentEndIndex + this.fetchMargin)
        if (fetchUntil > this.objects.length) {
            // Fetch next page
            const lastId = this.objects[this.objects.length - 1];
            
            const objects = await this.objectFetcher.fetch({
                filter: {
                    $and: [
                        // todo: this needs a proper definition
                        {
                            [this.sort[0].key]: {
                                '$gt': lastId
                            }
                        },
                        {
                            id: {
                                '$gt': lastId
                            }
                        },
                        this.filter
                    ]
                },
                limit: Math.min(this.limit, this.objects.length - fetchUntil),
                search: this.searchQuery
            })
            if (currentClearIndex !== this.#clearIndex) {
                // Discard old requests
                return;
            }
            this.objects.push(...objects)
            await this.fetchIfNeeded()
        }
    }
}