import { Decoder, ObjectData } from '@simonbackx/simple-encoding';
import { SimpleError } from '@simonbackx/simple-errors';
import { Request } from '@simonbackx/simple-networking';
import { EventBus, ObjectFetcher } from '@stamhoofd/components';
import { assertSort, compileToInMemoryFilter, compileToInMemorySorter, CountFilteredRequest, getOrderSearchFilter, getSortFilter, LimitedFilteredRequest, mergeFilters, PrivateOrderWithTickets, privateOrderWithTicketsFilterCompilers, SortItem, SortItemDirection, SortList, StamhoofdFilter, Version } from '@stamhoofd/structures';
import { parsePhoneNumber } from 'libphonenumber-js';
import { IndexBoxDecoder } from '../IndexBox';
import { OrderIndexedDBIndex, ordersIndexedDBSorters } from '../ordersIndexedDBSorters';
import { OrdersStore } from '../repositories/WebshopOrdersRepo';
import { WebshopTicketPatchesStore, WebshopTicketsStore } from '../repositories/WebshopTicketsRepo';
import { WebshopManager } from '../WebshopManager';

function searchToFilter(search: string | null): StamhoofdFilter | null {
    return getOrderSearchFilter(search, parsePhoneNumber);
}

export function useOrdersObjectFetcher(manager: WebshopManager): OrderFetcherHelper {
    return new OrderFetcherHelper(manager);
}

function startTimeLogger(label: string) {
    console.log(`${label}: start`);
    const before = Date.now();

    return {
        stop: () => {
            const after = Date.now();
            const seconds = (after - before) / 1000;
            console.log(`${label}: ${seconds} sec`);
        },
    };
}

class VersionError extends Error {}

/**
 * Todo's:
 * - handle deletion of order
 * - handle restream?
 */

class OrderCache {
    private static streamVersion = 0;
    private allOrders: PrivateOrderWithTickets[] | null = null;
    private filteredOrders: PrivateOrderWithTickets[] = [];
    readonly eventBus = new EventBus<'batch', void>();
    readonly countEventBus = new EventBus< 'count', number>();
    private _isStreaming = false;
    private sortItem: SortItem & { key: OrderIndexedDBIndex | 'id' } = { key: 'id', order: SortItemDirection.ASC };
    private filter: StamhoofdFilter = null;
    private streamData: { manager: WebshopManager; limit: number } | null = null;

    get isStreaming() {
        return this._isStreaming;
    }

    get isLoaded() {
        return this.allOrders !== null;
    }

    /**
     * Restart the streaming (if it did start already)
     * @returns
     */
    private async restartStreaming() {
        if (!this.streamData) {
            // streaming did not yet start
            return;
        }

        OrderCache.streamVersion++;
        this._isStreaming = false;
        this.allOrders = null;

        this.filteredOrders = [];

        await this.startStreamAllOrders(this.streamData);
    }

    async count(): Promise<number> {
        if (this.isLoaded) {
            return this.filteredOrders.length;
        }

        const owner = {};

        const result = await new Promise<number>((resolve) => {
            this.countEventBus.addListener(owner, 'count', count => resolve(count));
        });

        this.countEventBus.removeListener(owner);

        return result;
    }

    setFilter(filter: StamhoofdFilter) {
        console.log('test - set filter: ', filter);
        if (filter === this.filter || JSON.stringify(filter) === JSON.stringify(this.filter)) {
            return;
        }

        this.doFilter(filter);
        this.filter = filter;
    }

    private doFilter(filter: StamhoofdFilter) {
        if (this.allOrders !== null) {
            if (filter === null) {
                this.filteredOrders = Array.from(this.allOrders);
                return;
            }
            const compiledFilter = compileToInMemoryFilter(filter, privateOrderWithTicketsFilterCompilers);

            let count = 0;
            const limit = this.streamData?.limit ?? 100;

            this.filteredOrders = this.allOrders.filter((order) => {
                if (compiledFilter(order)) {
                    count++;

                    if (count % limit === 0) {
                        this.eventBus.sendEvent('batch').catch(console.error);
                    }

                    return true;
                }

                return false;
            });
            return;
        }

        this.filter = filter;
        void this.restartStreaming();
    }

    setSort(sortItem: SortItem & { key: OrderIndexedDBIndex | 'id' }) {
        console.log('test - set sort: ', sortItem);
        if (sortItem === this.sortItem) {
            return;
        }
        this.sort(sortItem);
        this.sortItem = sortItem;
    }

    private sort(sortItem: SortItem & { key: OrderIndexedDBIndex | 'id' }) {
        if (this.allOrders !== null) {
            if (sortItem.key === this.sortItem.key) {
                if (sortItem.order === this.sortItem.order) {
                    return;
                }
                this.allOrders.reverse();
                this.filteredOrders.reverse();
                return;
            }

            // always sort on id second because this is how IndexedDb sorts
            const inMemorySorter = compileToInMemorySorter([sortItem, { key: 'id', order: sortItem.order }], ordersIndexedDBSorters);

            this.allOrders.sort(inMemorySorter);
            this.filteredOrders.sort(inMemorySorter);
            return;
        }

        if (sortItem.key === this.sortItem.key && sortItem.order === this.sortItem.order) {
            return;
        }

        this.sortItem = sortItem;
        void this.restartStreaming();
    }

    async startStreamAllOrders({ manager, limit }: { manager: WebshopManager; limit: number }): Promise<void> {
        console.log('test - start stream all orders');
        this._isStreaming = true;

        if (!this.streamData) {
            this.streamData = { manager, limit };
        }

        const timeLogger = startTimeLogger('batch');

        try {
            const db = await manager.database.get();
            const openTransaction = db.transaction([OrdersStore.storeName, WebshopTicketsStore.storeName, WebshopTicketPatchesStore.storeName], 'readonly');
            const decoder = new IndexBoxDecoder(PrivateOrderWithTickets as Decoder<PrivateOrderWithTickets>);

            const allOrders: PrivateOrderWithTickets[] = [];
            const filteredOrders = this.filteredOrders;
            const version = OrderCache.streamVersion;

            await manager.orders.streamRaw({
                filter: this.filter,
                sortItem: this.sortItem,
                openTransaction,
                transform: async (rawOrder: any) => {
                    if (version !== OrderCache.streamVersion) {
                        const message = `Stream version does not match: ${version} !== ${OrderCache.streamVersion}`;
                        console.error(message);
                        throw new VersionError(`Stream version does not match: ${version} !== ${OrderCache.streamVersion}`);
                    }
                    let order: PrivateOrderWithTickets;

                    try {
                        order = decoder.decode(new ObjectData(rawOrder, { version: Version }));
                    }
                    catch (e) {
                    // force fetch all again
                        manager.orders.apiClient.clearLastFetchedOrder().catch(console.error);
                        throw e;
                    }

                    order.tickets = await manager.tickets.getForOrder(order.id, true, openTransaction);
                    allOrders.push(order);
                    return order;
                },
                callback: (order) => {
                    filteredOrders.push(order);

                    if (this.filteredOrders.length % limit === 0) {
                        this.eventBus.sendEvent('batch').catch(console.error);
                    }
                },

            });

            this.allOrders = allOrders;
            this.eventBus.sendEvent('batch').catch(console.error);

            timeLogger.stop();
        }
        catch (e) {
            if (e instanceof VersionError) {
                console.log('test - version error');
                return;
            }
            throw e;
        }
        finally {
            this._isStreaming = false;
        }

        this.countEventBus.sendEvent('count', this.filteredOrders.length).catch(console.error);
    }

    async get({ skip, limit }: {
        skip: number;
        limit: number;
    }): Promise<PrivateOrderWithTickets[]> {
        const batchStart = skip;
        const batchEnd = batchStart + limit;

        const owner = {};

        while (true) {
            if (skip !== 0) {
                // do not block (else the table will not show a loading animation)
                await new Promise(resolve => setTimeout(resolve, 0));
            }
            if (batchEnd <= this.filteredOrders.length) {
                this.eventBus.removeListener(owner);
                return this.filteredOrders.slice(batchStart, batchEnd);
            }

            if (this.isLoaded) {
                this.eventBus.removeListener(owner);
                return this.filteredOrders.slice(batchStart, Math.max(this.filteredOrders.length, batchEnd));
            }

            await new Promise<void>((resolve) => {
                this.eventBus.addListener(owner, 'batch', async () => {
                    resolve();
                });
            });
        }
    }
}

class OrderFetcherHelper implements ObjectFetcher<PrivateOrderWithTickets> {
    private lastNextRequest: LimitedFilteredRequest | null = null;
    private itemsToSkip: number = 0;
    private _isOffline = false;
    private internetPromise: Promise<void> | null = null;
    private _lastInternetLoad = 0;

    private readonly orderCache = new OrderCache();

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
        console.log('Orders(IndexedDb).fetch', data);
        const timeLogger = startTimeLogger('test - fetch');

        // if (!data.filter && !data.pageFilter && !data.search) {
        //     this.orderCache.clearFilter();
        // }

        if (!data.pageFilter) {
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

        const filters = [data.filter];

        const searchFilter = searchToFilter(data.search);
        if (searchFilter !== null) {
            filters.push(searchFilter);
        }

        const filter = mergeFilters(filters, '$and');

        const sortItem = data.sort[0] as (SortItem & { key: OrderIndexedDBIndex | 'id' });

        if (sortItem.key === 'id' && data.sort.length > 1) {
            // We don't support this
            throw new Error('Sorting first by id and other keys is not supported');
        }

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

                this.orderCache.setFilter(filter);
            }
        }
        else {
            this.orderCache.setFilter(filter);
        }

        this.orderCache.setSort(sortItem);

        if (!this.orderCache.isLoaded) {
            this.orderCache.startStreamAllOrders({ manager: this.manager, limit: data.limit }).catch(console.error);
        }

        const limit = data.limit;
        const results = await this.orderCache.get({ skip, limit });

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

        timeLogger.stop();

        return { results, next };
    }

    async fetchCount(data: CountFilteredRequest): Promise<number> {
        await this.loadFromInternet();

        if (!data.filter && !data.search) {
            const timeLogger = startTimeLogger('test - count');
            const count = await this.manager.orders.countAll();
            timeLogger.stop();

            return count;
        }

        const filters = [data.filter];

        const searchFilter = searchToFilter(data.search);
        if (searchFilter !== null) {
            filters.push(searchFilter);
        }

        this.orderCache.setFilter(mergeFilters(filters, '$and'));

        const timeLogger = startTimeLogger('test - count');
        const count = await this.orderCache.count();

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
