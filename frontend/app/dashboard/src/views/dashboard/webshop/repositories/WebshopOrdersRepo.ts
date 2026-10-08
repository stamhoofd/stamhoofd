import type { Decoder, PatchableArrayAutoEncoder } from '@simonbackx/simple-encoding';
import { ArrayDecoder, EncodeMedium, ObjectData } from '@simonbackx/simple-encoding';
import { SimpleError } from '@simonbackx/simple-errors';
import { EventBus } from '@stamhoofd/components/EventBus.ts';
import type { ObjectFetcher } from '@stamhoofd/components/tables/classes/ObjectFetcher.ts';
import { fetchAll } from '@stamhoofd/components/tables/classes/ObjectFetcher.ts';
import type { SessionContext } from '@stamhoofd/networking/SessionContext';
import type { CountFilteredRequest, InMemoryFilterRunner, SortItem, SortList, StamhoofdFilter } from '@stamhoofd/structures';
import { compileToInMemoryFilter, CountResponse, LimitedFilteredRequest, OrderStatus, PaginatedResponseDecoder, PrivateOrder, privateOrderWithTicketsFilterCompilers, SortItemDirection, Version } from '@stamhoofd/structures';
import { IndexBoxDecoder } from '../IndexBox';
import type { OrderIndexedDBIndex } from '../ordersIndexedDBSorters';
import { createPrivateOrderIndexBox } from '../ordersIndexedDBSorters';
import type { WebshopDatabase, WebshopStoreName } from './WebshopDatabase';
import type { WebshopSettingsStore } from './WebshopSettingsStore';
import type { ProgressListener, SyncProgress } from './syncProgress';
import { countSyncItems, getNewItemsFilter, SharedSync, SINGLE_FETCH_TIMEOUT_MS } from './syncProgress';
import { SyncState } from './SyncState';
import type { WebshopTicketsRepo } from './WebshopTicketsRepo';

class CompilerFilterError extends Error {}
class CallbackError extends Error {}

/**
 * Responsible for webshop orders operations
 */
export class WebshopOrdersRepo {
    readonly eventBus = new EventBus<string, PrivateOrder[]>();

    private readonly store: OrdersStore;
    private readonly sync = new SharedSync();
    readonly apiClient: WebshopOrdersApiClient;
    private readonly tickets: WebshopTicketsRepo;

    get isFetching() {
        return this.apiClient.isFetching;
    }

    /**
     * When the last completed sync ended
     */
    get lastUpdated() {
        return this.apiClient.state.lastUpdated;
    }

    /**
     * Whether at least one order has been fetched.
     */
    get hasFetchedOne() {
        return this.apiClient.hasFetchedOne;
    }

    /**
     * Whether a sync completed on this device since the offline orders were last cleared.
     */
    get hasCompletedSync() {
        return this.apiClient.state.hasCompletedSync;
    }

    constructor({ database, context, settingsStore, webshopId, tickets }: { database: WebshopDatabase; context: SessionContext; settingsStore: WebshopSettingsStore; webshopId: string; tickets: WebshopTicketsRepo }) {
        this.apiClient = new WebshopOrdersApiClient({ context, settingsStore, webshopId });
        this.store = new OrdersStore({ database });
        this.tickets = tickets;
    }

    reset() {
        this.apiClient.reset();
    }

    /**
     * Get the orders from the backend and store them in the indexed db
     * @param isFetchAll true if all orders should be fetched (and not only the updated orders)
     * @param onProgress called while a sync of more than one page of new orders is running
     * @returns true if the backend returned updated orders
     */
    async fetchAllUpdated({ isFetchAll, onProgress }: { isFetchAll?: boolean; onProgress?: ProgressListener } = {}): Promise<void> {
        if (isFetchAll) {
            // A full fetch clears the stored orders, so it can't join a running incremental sync
            await this.sync.waitUntilIdle();
        }
        return this.sync.run(async report => this.fetchAllUpdatedNow({ isFetchAll, onProgress: report }), onProgress);
    }

    private async fetchAllUpdatedNow({ isFetchAll, onProgress }: { isFetchAll?: boolean; onProgress: (progress: SyncProgress) => void }): Promise<void> {
        let hadSuccessfulFetch = false;

        const totalOrders: PrivateOrder[] = [];

        let stored = Promise.resolve();

        const onResultsReceived = async (orders: PrivateOrder[]) => {
            if (isFetchAll && !hadSuccessfulFetch) {
                hadSuccessfulFetch = true;
                await this.store.clear();
                await this.apiClient.clearLastFetchedOrder();
            }

            if (orders.length) {
                totalOrders.push(...orders);
                const lastOrder = orders[orders.length - 1];
                // Offline lookups (e.g. while scanning) wait for every queued write, so never queue more than one page
                await stored;
                // Moving the cursor once this page and all pages before it are stored lets an interrupted sync resume here
                stored = this.store.putAll(orders).then(async () => this.apiClient.state.setCursor(new Date(lastOrder.updatedAt), { isComplete: false }));
            }
        };

        await this.apiClient.getAllUpdated({ isFetchAll, onResultsReceived, onProgress });

        const deletedOrders: PrivateOrder[] = [];
        const fetchedOrders: PrivateOrder[] = [];

        for (const order of totalOrders) {
            if (order.status === OrderStatus.Deleted) {
                deletedOrders.push(order);
                continue;
            }

            fetchedOrders.push(order);
        }

        // wait until all orders have been stored
        await stored;

        if (totalOrders.length > 0) {
            await this.apiClient.state.setCursor(new Date(totalOrders[totalOrders.length - 1].updatedAt), { isComplete: true });
        }

        if (fetchedOrders.length > 0) {
            await this.eventBus.sendEvent('fetched', fetchedOrders);
        }

        if (deletedOrders.length > 0) {
            await this.eventBus.sendEvent('deleted', deletedOrders);
        }

        await this.apiClient.state.setCompleted();
    }

    /**
     * Fetch a single order from the server and store it in the offline database, without moving the sync cursor.
     * @returns undefined if the order does not exist or is deleted
     */
    async fetchById(id: string): Promise<PrivateOrder | undefined> {
        const order = await this.apiClient.getById(id);
        if (!order) {
            return undefined;
        }

        await this.store.putAll([order]);
        if (order.status === OrderStatus.Deleted) {
            await this.eventBus.sendEvent('deleted', [order]);
            return undefined;
        }

        await this.eventBus.sendEvent('fetched', [order]);
        return order;
    }

    /**
     * Delete the orders from the offline database.
     * Logic to delete the orders from the server is currenlty handled elsewhere (should probably be refactored).
     */
    async deleteFromDatabase(orders: PrivateOrder[]): Promise<void> {
        for (const order of orders) {
            await this.store.delete(order.id);
        }
        await this.eventBus.sendEvent('deleted', orders);
    }

    /**
     * Patch all orders on the server and store the patched orders in the offline database.
     */
    async putPatches(patches: PatchableArrayAutoEncoder<PrivateOrder>) {
        const patched = await this.apiClient.putPatches(patches);

        // Move all data to original order
        try {
            await this.store.putAll(patched);
        } catch (e) {
            console.error(e);
            // No db support or other error. Should ignore
        }

        // Patching orders can result in changed tickets. We'll need to pull those in.
        try {
            this.tickets.fetchAllUpdated().catch(console.error);
        } catch (e) {
            console.error(e);
        }

        this.eventBus.sendEvent('fetched', patched).catch(console.error);
        return patched;
    }

    async stream(options: {
        callback: (data: PrivateOrder) => void;
        filter?: StamhoofdFilter;
        limit?: number;
        sortItem?: SortItem & { key: OrderIndexedDBIndex | 'id' };
        advanceCount?: number;
    }): Promise<number> {
        const decoder = new IndexBoxDecoder(PrivateOrder as Decoder<PrivateOrder>);

        return await this.streamRaw({
            ...options,
            transform: async (rawOrder: any) => {
                let order: PrivateOrder;
                try {
                    order = decoder.decode(new ObjectData(rawOrder, { version: Version, medium: EncodeMedium.Database }));
                } catch (e) {
                    // force fetch all again
                    this.apiClient.clearLastFetchedOrder().catch(console.error);
                    throw e;
                }

                return order;
            },
        });
    }

    async streamRaw<T>(options: {
        transform: (rawOrder: any) => Promise<T>;
        callback: (data: T) => void;
        filter?: StamhoofdFilter;
        limit?: number;
        sortItem?: SortItem & { key: OrderIndexedDBIndex | 'id' };
        advanceCount?: number;
        openTransaction?: IDBTransaction;
    },
    ): Promise<number> {
        try {
            return await this.store.streamRaw<T>(options);
        } catch (e) {
            if (e instanceof CallbackError || e instanceof CompilerFilterError) {
                throw e;
            }
            console.error(e);
            throw new SimpleError({
                code: 'loading_failed',
                message: $t('%17k'),
            });
        }
    }

    async getAllRaw(): Promise<any []> {
        try {
            return await this.store.getAllRaw();
        } catch (e) {
            console.error(e);
            throw new SimpleError({
                code: 'loading_failed',
                message: $t('%17k'),
            });
        }
    }

    /**
     * Get a single order from the offline database.
     */
    async get(id: string): Promise<PrivateOrder | undefined> {
        return this.store.get(id);
    }

    async countAll() {
        return await this.store.countAll();
    }
}

/**
 * Responsible for offline storage of webshop orders.
 */
export class OrdersStore {
    static readonly storeName: WebshopStoreName = 'orders';
    private readonly database: WebshopDatabase;

    /**
     * Times the store has changed (write operations).
     */
    private changeCount = 0;

    /**
     * The changeCount on the last stream.
     * All orders should be streamed again (no order can be advanced) if the count is different than the current changeCount.
     */
    private changeCountOnLastStream = 0;

    constructor({ database }: { database: WebshopDatabase }) {
        this.database = database;
    }

    async delete(id: string): Promise<void> {
        this.changeCount++;
        const db = await this.database.get();

        return new Promise<void>((resolve, reject) => {
            const transaction = db.transaction([OrdersStore.storeName], 'readwrite');

            transaction.onerror = (event) => {
                // Don't forget to handle errors!
                reject(event);
            };

            // Do the actual saving
            const objectStore = transaction.objectStore(OrdersStore.storeName);
            const request = objectStore.delete(id);
            request.onsuccess = () => {
                resolve();
            };
        });
    }

    async get(id: string): Promise<PrivateOrder | undefined> {
        const rawItem = await this.database.getItemFromStore({ storeName: OrdersStore.storeName, id });
        if (rawItem) {
            const decoder = new IndexBoxDecoder(PrivateOrder as Decoder<PrivateOrder>);
            return decoder.decode(new ObjectData(rawItem, { version: Version, medium: EncodeMedium.Database }));
        }
        return undefined;
    }

    async putAll(orders: PrivateOrder[]) {
        this.changeCount++;
        const db = await this.database.get();

        return new Promise<void>((resolve, reject) => {
            const transaction = db.transaction([OrdersStore.storeName], 'readwrite');

            transaction.oncomplete = () => {
                resolve();
            };

            transaction.onerror = (event) => {
                // Don't forget to handle errors!
                this.database.delete().catch(console.error);
                reject(event);
            };

            // Do the actual saving
            const objectStore = transaction.objectStore(OrdersStore.storeName);

            for (const order of orders) {
                if (order.status === OrderStatus.Deleted) {
                    objectStore.delete(order.id);
                } else {
                    const indexBox = createPrivateOrderIndexBox(order);
                    objectStore.put(indexBox.encode({ version: Version, medium: EncodeMedium.Database }));
                }
            }
        });
    }

    async streamRaw<T>({ callback, filter, limit, sortItem, advanceCount, transform, openTransaction }: {
        transform: (rawOrder: any) => Promise<T>;
        callback: (data: T) => void;
        filter?: StamhoofdFilter;
        limit?: number;
        sortItem?: SortItem & { key: OrderIndexedDBIndex | 'id' };
        advanceCount?: number;
        openTransaction?: IDBTransaction;
    },
    ): Promise<number> {
        // all items should be streamed again if the content of the store changed
        if (this.changeCount !== this.changeCountOnLastStream) {
            if (advanceCount) {
                advanceCount = 0;
            }

            this.changeCountOnLastStream = this.changeCount;
        }

        const db = await this.database.get();

        return await new Promise<number>((resolve, reject) => {
            const transaction = openTransaction ?? db.transaction([OrdersStore.storeName], 'readonly');

            transaction.onerror = (event) => {
                // Don't forget to handle errors!
                if (openTransaction && openTransaction.onerror) {
                    openTransaction.onerror(event);
                }

                this.database.delete().catch(console.error);
                reject(event);
            };

            const objectStore = transaction.objectStore(OrdersStore.storeName);

            let request: IDBRequest<IDBCursorWithValue | null>;

            // use an index if a SortItem is defined
            try {
                if (sortItem) {
                    let direction: IDBCursorDirection = 'next';

                    if (sortItem.order === SortItemDirection.DESC) {
                        direction = 'prev';
                    }

                    if (sortItem.key === 'id') {
                        request = objectStore.openCursor(null, direction);
                    } else {
                        request = objectStore.index(sortItem.key).openCursor(null, direction);
                    }
                } else {
                    request = objectStore.openCursor();
                }
            } catch (e) {
                reject(e);
                return;
            }

            let matchedItemsCount = 0;
            let totalIterationCount = advanceCount ?? 0;

            let compiledFilter: InMemoryFilterRunner | undefined;

            if (filter) {
                try {
                    compiledFilter = compileToInMemoryFilter(filter, privateOrderWithTicketsFilterCompilers);
                } catch (e: any) {
                    console.error('Compile filter failed', e);
                    reject(new CompilerFilterError((e.message as string | undefined) ?? 'Compile filter failed'));
                    return;
                }
            }

            const onsuccess: ((this: IDBRequest<IDBCursorWithValue | null>, ev: Event) => any) | null = (event: any) => {
                if (limit && matchedItemsCount >= limit) {
                    // limit reached
                    resolve(totalIterationCount);
                    return;
                }

                const cursor: IDBCursor & { value: any } | undefined = event.target.result;
                if (!cursor) {
                    // no more results
                    resolve(totalIterationCount);
                    return;
                }

                transform(cursor.value).then((decodedResult) => {
                    if (compiledFilter && !compiledFilter(decodedResult)) {
                        cursor.continue();
                        totalIterationCount += 1;
                        return;
                    }

                    try {
                        callback(decodedResult);
                    } catch (e: any) {
                        console.error('callback failed', e);
                        // Propagate error
                        reject(new CallbackError((e.message as string | undefined) ?? 'Callback failed'));
                        return;
                    }

                    cursor.continue();
                    totalIterationCount += 1;
                    matchedItemsCount += 1;
                }).catch((e) => {
                    reject(e);
                });
            };

            if (advanceCount) {
                request.onsuccess = (event: any) => {
                    const cursor: IDBCursor & { value: any } | undefined = event.target.result;
                    if (!cursor) {
                    // no more results
                        resolve(totalIterationCount);
                        return;
                    }

                    cursor.advance(advanceCount);
                    request.onsuccess = onsuccess;
                };
                return;
            }

            request.onsuccess = onsuccess;
        });
    }

    async getAllRaw(): Promise<any []> {
        const db = await this.database.get();

        return await new Promise<any []>((resolve, reject) => {
            const transaction = db.transaction([OrdersStore.storeName], 'readonly');

            transaction.onerror = (event) => {
                // Don't forget to handle errors!
                this.database.delete().catch(console.error);
                reject(event);
            };

            const objectStore = transaction.objectStore(OrdersStore.storeName);

            const request: IDBRequest<any[]> = objectStore.getAll();

            request.onsuccess = () => {
                resolve(request.result);
            };
        });
    }

    async clear(): Promise<void> {
        this.changeCount++;
        const db = await this.database.get();

        return new Promise<void>((resolve, reject) => {
            const transaction = db.transaction([OrdersStore.storeName], 'readwrite');

            transaction.onerror = (event) => {
                // Don't forget to handle errors!
                reject(event);
            };

            // Do the actual saving
            const objectStore = transaction.objectStore(OrdersStore.storeName);

            const request = objectStore.clear();
            request.onsuccess = () => {
                resolve();
            };
        });
    }

    async countAll() {
        return await this.database.countStore(OrdersStore.storeName);
    }
}

/**
 * Responsible for webshop orders network operations.
 */
class WebshopOrdersApiClient {
    private _isFetching = false;
    readonly state: SyncState;

    private readonly webshopId: string;
    private readonly context: SessionContext;
    private readonly settingsStore: WebshopSettingsStore;

    get hasFetchedOne() {
        return this.state.syncCursor !== null;
    }

    get isFetching() {
        return this._isFetching;
    }

    constructor({ context, settingsStore, webshopId }: { context: SessionContext; settingsStore: WebshopSettingsStore; webshopId: string }) {
        this.context = context;
        this.settingsStore = settingsStore;
        this.webshopId = webshopId;
        this.state = new SyncState(settingsStore, { cursor: 'lastFetchedOrder', completed: 'ordersSyncCompleted', lastSyncedAt: 'ordersLastSyncedAt' });
    }

    reset() {
        this._isFetching = false;
        this.state.reset();
    }

    /**
     * Get the orders from the backend and store them in  the indexed db
     * @param isFetchAll true if all orders should be fetched (and not only the updated orders)
     * @returns true if the backend returned updated orders
     */
    async getAllUpdated({ isFetchAll, onResultsReceived, onProgress }: { isFetchAll?: boolean; onResultsReceived: (results: PrivateOrder[]) => Promise<void> | void; onProgress?: (progress: SyncProgress) => void }): Promise<void> {
        if (this._isFetching) {
            return;
        }

        this._isFetching = true;

        await this.state.load();

        // create request
        const filter: StamhoofdFilter = {
            webshopId: this.webshopId,
        };

        const cursor = isFetchAll ? null : this.state.syncCursor;
        if (cursor) {
            filter['updatedAt'] = { $gt: cursor.updatedAt };
        }

        // The cursor can start one second early (see SyncState.setCursor), so the sync can start with items that are already stored
        const newItemsFilter = getNewItemsFilter(this.webshopId, cursor ? (cursor.itemUpdatedAt ?? cursor.updatedAt) : null);

        const request = new LimitedFilteredRequest({
            limit: 100,
            filter,
        });

        // fetch
        const fetcher: ObjectFetcher<PrivateOrder> = {
            extendSort(): SortList {
                // fetchAll does clear list anyway, no need to assert
                return [
                    { key: 'updatedAt', order: SortItemDirection.ASC },
                    { key: 'number', order: SortItemDirection.ASC },
                    { key: 'id', order: SortItemDirection.ASC },
                ];
            },
            fetch: async (data: LimitedFilteredRequest) => {
                const response = await this.context.authenticatedServer.request({
                    method: 'GET',
                    path: `/webshop/orders`,
                    decoder: new PaginatedResponseDecoder(new ArrayDecoder(PrivateOrder as Decoder<PrivateOrder>), LimitedFilteredRequest as Decoder<LimitedFilteredRequest>),
                    query: data,
                    shouldRetry: false,
                    owner: this,
                });

                return response.data;
            },
            fetchCount: async (data: CountFilteredRequest): Promise<number> => {
                const response = await this.context.authenticatedServer.request({
                    method: 'GET',
                    path: `/webshop/orders/count`,
                    decoder: CountResponse as Decoder<CountResponse>,
                    query: data,
                    shouldRetry: false,
                    owner: this,
                });
                return response.data.count;
            },
        };

        try {
            await fetchAll(request, fetcher, {
                onResultsReceived,
                ...(onProgress
                    ? {
                            countAfterFirstPage: async () => countSyncItems(fetcher, filter, newItemsFilter),
                            onProgress: (count: number, total: number) => onProgress({ count, total }),
                        }
                    : {}),
            });
        } finally {
            this._isFetching = false;
        }
    }

    async getById(id: string): Promise<PrivateOrder | undefined> {
        const response = await this.context.authenticatedServer.request({
            method: 'GET',
            path: `/webshop/orders`,
            decoder: new PaginatedResponseDecoder(new ArrayDecoder(PrivateOrder as Decoder<PrivateOrder>), LimitedFilteredRequest as Decoder<LimitedFilteredRequest>),
            query: new LimitedFilteredRequest({
                filter: { webshopId: this.webshopId, id },
                limit: 1,
            }),
            shouldRetry: false,
            timeout: SINGLE_FETCH_TIMEOUT_MS,
            owner: this,
        });

        return response.data.results[0];
    }

    async putPatches(patches: PatchableArrayAutoEncoder<PrivateOrder>) {
        const response = await this.context.authenticatedServer.request({
            method: 'PATCH',
            path: '/webshop/' + this.webshopId + '/orders',
            decoder: new ArrayDecoder(PrivateOrder as Decoder<PrivateOrder>),
            body: patches,
            shouldRetry: false,
            owner: this,
        });

        return response.data;
    }

    async clearLastFetchedOrder() {
        await this.state.clear();
    }


}
