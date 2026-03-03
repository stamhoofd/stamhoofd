import { SimpleError } from '@simonbackx/simple-errors';
import { Request } from '@simonbackx/simple-networking';
import { ObjectFetcher } from '@stamhoofd/components';
import { assertSort, CountFilteredRequest, getOrderSearchFilter, getSortFilter, LimitedFilteredRequest, mergeFilters, PrivateOrderWithTickets, SortItem, SortItemDirection, SortList, StamhoofdFilter } from '@stamhoofd/structures';
import { sleep } from '@stamhoofd/utility';
import { parsePhoneNumber } from 'libphonenumber-js';
import { toRaw } from 'vue';
import { OrderIndexedDBIndex, ordersIndexedDBSorters } from '../ordersIndexedDBSorters';
import { WebshopManager } from '../WebshopManager';

function searchToFilter(search: string | null): StamhoofdFilter | null {
    return getOrderSearchFilter(search, parsePhoneNumber);
}

export function useOrdersObjectFetcher(manager: WebshopManager): OrderFetcherHelper {
    return new OrderFetcherHelper(manager);
}

function startTimeLogger(label: string) {
    const before = Date.now();

    return {
        stop: () => {
            const after = Date.now();
            const seconds = (after - before) / 1000;
            console.log(`${label}: ${seconds} sec`);
        },
    };
}

class OrderCache {
    private manager: WebshopManager;
    private finalCount: number | null = null;
    private _countPromise: Promise<number>;
    private filteredOrders: PrivateOrderWithTickets[] = [];
    private currentBatch: Promise<any> | null = null;

    get count() {
        return this._countPromise;
    }

    constructor({ manager, filter, sortItem, limit }: { manager: WebshopManager; filter: StamhoofdFilter; sortItem?: SortItem & { key: OrderIndexedDBIndex | 'id' }; limit: number }) {
        this.manager = manager;
        this._countPromise = this.startStreamInBatches({ filter, limit, sortItem });
    }

    private async startStreamInBatches({ filter, limit, sortItem }: { filter: StamhoofdFilter; limit: number; sortItem?: SortItem & { key: OrderIndexedDBIndex | 'id' } }): Promise<number> {
        let currentCount = 0;
        let advanceCount = 0;

        while (this.finalCount === null) {
            if (advanceCount !== 0) {
                limit = 1500;
            }

            const timeLogger = startTimeLogger('batch');

            let batchCount = 0;

            const batchPromise = this.manager.streamOrdersWithPatchedTickets({
                filter,
                limit,
                sortItem,
                advanceCount,
                callback: (order) => {
                    batchCount++;
                    this.filteredOrders.push(order);
                },
            });

            this.currentBatch = batchPromise;
            await batchPromise;
            currentCount += batchCount;
            advanceCount += limit;

            if (batchCount !== limit) {
                this.finalCount = currentCount;
            }

            timeLogger.stop();
        }

        this.finalCount = currentCount;
        return currentCount;
    }

    async get({ skip, limit }: {
        skip: number;
        limit: number;
    }): Promise<PrivateOrderWithTickets[]> {
        const batchStart = skip;
        const batchEnd = batchStart + limit;

        while (true) {
            if (skip !== 0) {
                await new Promise(resolve => setTimeout(resolve, 0));
            }
            if (batchEnd <= this.filteredOrders.length) {
                return this.filteredOrders.slice(batchStart, batchEnd);
            }

            if (this.finalCount !== null) {
                return this.filteredOrders.slice(batchStart, Math.max(this.finalCount, batchEnd));
            }

            if (this.currentBatch) {
                await this.currentBatch;
                this.currentBatch = sleep(25);
            }
            else {
                await sleep(25);
            }
        }
    }
}

class OrderCachePromise {
    private resolve: ((value: OrderCache) => void) | null = null;
    readonly promise: Promise<OrderCache>;

    constructor(private readonly manager: WebshopManager, private readonly filter: StamhoofdFilter) {
        this.promise = new Promise<OrderCache>((resolve) => {
            this.resolve = resolve;
        });
    }

    setFetchData({ sortItem, limit }: { sortItem?: SortItem & { key: OrderIndexedDBIndex | 'id' }; limit: number }) {
        if (this.resolve) {
            this.resolve(new OrderCache({ manager: this.manager, filter: this.filter, sortItem, limit }));
            this.resolve = null;
        }
    }
}

class OrderFetcherHelper implements ObjectFetcher<PrivateOrderWithTickets> {
    private lastNextRequest: LimitedFilteredRequest | null = null;
    private itemsToSkip: number = 0;
    private _isOffline = false;
    private internetPromise: Promise<void> | null = null;
    private _lastInternetLoad = 0;

    private _orderCachePromise: OrderCachePromise | null = null;

    get lastInternetLoad() {
        return this._lastInternetLoad;
    }

    get isOffline() {
        return this._isOffline;
    }

    constructor(private readonly manager: WebshopManager) {}

    reset() {
        this._isOffline = false;
        this._lastInternetLoad = 0;
        this.internetPromise = null;
        this.lastNextRequest = null;
        this.itemsToSkip = 0;
    }

    extendSort(list: SortList): SortList {
    /**
     * IndexedDB does first sort on the index of the cursor and next on the id.
     * Because of this we always have to sort on id, with the same direction/order as the first sort item.
     */
        const order = list[0]?.order ?? SortItemDirection.ASC;
        return assertSort(list, [{ key: 'id', order }]);
    }

    async fetch(data: LimitedFilteredRequest) {
        // data = toRaw(data);
        console.log('Orders(IndexedDb).fetch', data);
        const filters = [data.filter];

        const searchFilter = searchToFilter(data.search);
        if (searchFilter !== null) {
            filters.push(searchFilter);
        }

        if (data.pageFilter) {
            filters.unshift(data.pageFilter);
        }
        else {
            await this.loadFromInternet();
        }

        // validate sort
        if (data.sort.length === 0) {
            throw new Error('No sort items set');
        }

        if (data.sort.length > 2) {
            throw new Error('Too many sort items set');
        }

        if (!data.sort.some(item => item.key === 'id')) {
            throw new Error('No valid sort set, or id is not in the sort list');
        }

        const sortItem = data.sort[0] as (SortItem & { key: OrderIndexedDBIndex | 'id' });

        if (sortItem.key === 'id' && data.sort.length > 1) {
            // We don't support this
            throw new Error('Sorting first by id and other keys is not supported');
        }

        // create filter
        const filter = mergeFilters(filters, '$and');

        console.log('Orders(IndexedDb).fetch', 'streamOrders, filter', filter, 'sortItem', sortItem, 'limit', data.limit);

        // set advance count
        let skip = 0;

        if (this.lastNextRequest !== null) {
            if (this.lastNextRequest === data) {
                skip = this.itemsToSkip;
            }
            else {
                // todo: order cache reset?
                this.lastNextRequest = null;
                this.itemsToSkip = 0;
                this._orderCachePromise = new OrderCachePromise(this.manager, filter);
            }
        }

        const timeLogger = startTimeLogger('test - fetch');

        // stream
        if (!this._orderCachePromise) {
            console.error('Order cache was set on fetch, should not happen.');
            this._orderCachePromise = new OrderCachePromise(this.manager, filter);
        }

        this._orderCachePromise.setFetchData({ sortItem, limit: data.limit });

        const orderCache = await this._orderCachePromise.promise;
        const limit = data.limit;
        const results = await orderCache.get({
            skip,
            limit,
        });

        timeLogger.stop();

        this.itemsToSkip = skip + limit;

        // create next request
        const lastItem = results[results.length - 1];
        let next: LimitedFilteredRequest | undefined = undefined;

        if (lastItem && results.length >= data.limit) {
            const pageFilter = getSortFilter(lastItem, ordersIndexedDBSorters, data.sort);

            next = new LimitedFilteredRequest({
                filter: data.filter,
                sort: data.sort,
                limit: data.limit,
                search: data.search,
                pageFilter,
            });

            if (!pageFilter || JSON.stringify(pageFilter) === JSON.stringify(data.pageFilter)) {
                console.error('Found infinite loading loop for', data);
                next = undefined;
            }
        }

        console.log('[Done] Orders(IndexedDb).fetch', { results, next });

        if (!data.pageFilter && results.length === 0 && this.isOffline) {
            // First page load failed
            throw new SimpleError({
                code: 'network_error',
                message: 'No internet connection',
            });
        }

        if (next) {
            this.lastNextRequest = next;
        }
        else {
            this.lastNextRequest = null;
            this.itemsToSkip = 0;
        }

        return { results, next };
    }

    async fetchCount(data: CountFilteredRequest): Promise<number> {
        data = toRaw(data);
        console.log('Orders(IndexedDb).fetchCount', data);

        const filters = [data.filter];

        const searchFilter = searchToFilter(data.search);
        if (searchFilter !== null) {
            filters.push(searchFilter);
        }

        const filter = mergeFilters(filters, '$and');

        await this.loadFromInternet();

        const timeLogger = startTimeLogger('test - count');

        if (!this._orderCachePromise) {
            this._orderCachePromise = new OrderCachePromise(this.manager, filter);
        }

        const orderCache = await this._orderCachePromise.promise;
        const count = await orderCache.count;

        console.log('[Done] Orders(IndexedDb).fetchCount', data, count);

        timeLogger.stop();

        return count;
    }

    private async loadFromInternet() {
        if (this.internetPromise) {
            return this.internetPromise;
        }

        this.internetPromise = this.doLoadFromInternet().finally(() => {
            this.internetPromise = null;
        });

        return this.internetPromise;
    }

    private async doLoadFromInternet() {
        // Prevent doing multiple calls within 5 seconds (other rate limiting should happen outside of the object fetcher)
        if (!this._isOffline && this.lastInternetLoad > Date.now() - 5_000) {
            return;
        }

        try {
            this._isOffline = false;

            await this.manager.orders.fetchAllUpdated();
            await this.manager.tickets.fetchAllUpdated();
            this._lastInternetLoad = Date.now();
        }
        catch (e) {
            if (Request.isNetworkError(e)) {
                console.warn('Failed to fetch new orders from the network', e);
                this._isOffline = true;
            }
            else {
                throw e;
            }
        }
    }
}
