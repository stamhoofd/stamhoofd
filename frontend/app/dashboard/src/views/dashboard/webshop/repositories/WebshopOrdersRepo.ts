import { ArrayDecoder, Decoder, ObjectData, PatchableArrayAutoEncoder } from '@simonbackx/simple-encoding';
import { SimpleError } from '@simonbackx/simple-errors';
import { EventBus, fetchAll, ObjectFetcher } from '@stamhoofd/components';
import { SessionContext } from '@stamhoofd/networking';
import { compileToInMemoryFilter, CountFilteredRequest, CountResponse, InMemoryFilterRunner, LimitedFilteredRequest, OrderStatus, PaginatedResponseDecoder, PrivateOrder, privateOrderWithTicketsFilterCompilers, SortItem, SortItemDirection, SortList, StamhoofdFilter, Version } from '@stamhoofd/structures';
import { IndexBoxDecoder } from '../IndexBox';
import { createPrivateOrderIndexBox, OrderIndexedDBIndex } from '../ordersIndexedDBSorters';
import { WebshopDatabase } from './WebshopDatabase';
import { WebshopSettingsStore } from './WebshopSettingsStore';
import { WebshopTicketsRepo } from './WebshopTicketsRepo';

class CompilerFilterError extends Error {}
class CallbackError extends Error {}

/**
 * Responsible for webshop orders operations
 */
export class WebshopOrdersRepo {
    readonly eventBus = new EventBus<string, PrivateOrder[]>();

    private readonly store: OrdersStore;
    readonly apiClient: WebshopOrdersApiClient;
    private readonly tickets: WebshopTicketsRepo;

    get isFetching() {
        return this.apiClient.isFetching;
    }

    get lastUpdated() {
        return this.apiClient.lastUpdated;
    }

    /**
     * Whether at least one order has been fetched.
     */
    get hasFetchedOne() {
        return this.apiClient.hasFetchedOne;
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
     * @returns true if the backend returned updated orders
     */
    async fetchAllUpdated({ isFetchAll }: { isFetchAll?: boolean } = {}): Promise<void> {
        let hadSuccessfulFetch = false;

        const totalOrders: PrivateOrder[] = [];

        const putPromises: Promise<void>[] = [];

        const onResultsReceived = async (orders: PrivateOrder[]) => {
            if (isFetchAll && !hadSuccessfulFetch) {
                hadSuccessfulFetch = true;
                await this.store.clear();
                await this.apiClient.clearLastFetchedOrder();
            }

            if (orders.length) {
                totalOrders.push(...orders);
                putPromises.push(this.store.putAll(orders));
            }
        };

        await this.apiClient.getAllUpdated({ isFetchAll, onResultsReceived });

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
        await Promise.all(putPromises);

        // only set after succesful store
        if (totalOrders.length > 0) {
            await this.apiClient.setlastFetchedOrder(totalOrders[totalOrders.length - 1]);
        }

        if (fetchedOrders.length > 0) {
            await this.eventBus.sendEvent('fetched', fetchedOrders);
        }

        if (deletedOrders.length > 0) {
            await this.eventBus.sendEvent('deleted', deletedOrders);
        }
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
        }
        catch (e) {
            console.error(e);
            // No db support or other error. Should ignore
        }

        // Patching orders can result in changed tickets. We'll need to pull those in.
        try {
            await this.tickets.fetchAllUpdated();
        }
        catch (e) {
            console.error(e);
        }

        await this.eventBus.sendEvent('fetched', patched);
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
                    order = decoder.decode(new ObjectData(rawOrder, { version: Version }));
                }
                catch (e) {
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
        }
        catch (e) {
            if (e instanceof CallbackError || e instanceof CompilerFilterError) {
                throw e;
            }
            console.error(e);
            throw new SimpleError({
                code: 'loading_failed',
                message: $t('b17b2abe-34a5-4231-a170-5a9b849ecd3c'),
            });
        }
    }

    async getMultipleRaw<T>(options: {
        transform: (rawOrder: any) => Promise<T>;
        filter?: StamhoofdFilter;
        limit?: number;
        sortItem?: SortItem & { key: OrderIndexedDBIndex | 'id' };
        advanceCount?: number;
        openTransaction?: IDBTransaction;
    },
    ): Promise<T[]> {
        try {
            return await this.store.getMultipleRaw<T>(options);
        }
        catch (e) {
            if (e instanceof CompilerFilterError) {
                throw e;
            }
            console.error(e);
            throw new SimpleError({
                code: 'loading_failed',
                message: $t('b17b2abe-34a5-4231-a170-5a9b849ecd3c'),
            });
        }
    }

    /**
     * Get a single order from the offline database.
     */
    async get(id: string): Promise<PrivateOrder | undefined> {
        return this.store.get(id);
    }
}

/**
 * Responsible for offline storage of webshop orders.
 */
export class OrdersStore {
    static readonly storeName = 'orders';
    private readonly database: WebshopDatabase;

    constructor({ database }: { database: WebshopDatabase }) {
        this.database = database;
    }

    async delete(id: string): Promise<void> {
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
            return decoder.decode(new ObjectData(rawItem, { version: Version }));
        }
        return undefined;
    }

    async putAll(orders: PrivateOrder[]) {
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
                }
                else {
                    const indexBox = createPrivateOrderIndexBox(order);
                    objectStore.put(indexBox.encode({ version: Version }));
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
                    }
                    else {
                        request = objectStore.index(sortItem.key).openCursor(null, direction);
                    }
                }
                else {
                    request = objectStore.openCursor();
                }
            }
            catch (e) {
                reject(e);
                return;
            }

            let matchedItemsCount = 0;
            let totalIterationCount = advanceCount ?? 0;

            let compiledFilter: InMemoryFilterRunner | undefined;

            if (filter) {
                try {
                    compiledFilter = compileToInMemoryFilter(filter, privateOrderWithTicketsFilterCompilers);
                }
                catch (e: any) {
                    console.error('Compile filter failed', e);
                    reject(new CompilerFilterError((e.message as string | undefined) ?? 'Compile filter failed'));
                    return;
                }
            }

            const iterator: ((this: IDBRequest<IDBCursorWithValue | null>, ev: Event) => any) | null = (event: any) => {
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
                    }
                    catch (e: any) {
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
                    request.onsuccess = iterator;
                };
                return;
            }

            request.onsuccess = iterator;
        });
    }

    private _cache: any[] | null = null;

    // // todo: rename
    // async getCache<T>({ sortItem, transform, openTransaction }: {
    //     transform: (rawOrder: any) => Promise<T>;
    //     sortItem?: SortItem & { key: OrderIndexedDBIndex | 'id' };
    //     openTransaction?: IDBTransaction;
    // },
    // ): Promise<T[]> {
    //     if (this._cache) {
    //         return this._cache;
    //     }

    //     const db = await this.database.get();

    //     return await new Promise<T[]>((resolve, reject) => {
    //         const transaction = openTransaction ?? db.transaction([OrdersStore.storeName], 'readonly');

    //         transaction.onerror = (event) => {
    //             // Don't forget to handle errors!
    //             if (openTransaction && openTransaction.onerror) {
    //                 openTransaction.onerror(event);
    //             }

    //             this.database.delete().catch(console.error);
    //             reject(event);
    //         };

    //         const objectStore = transaction.objectStore(OrdersStore.storeName);

    //         let request: IDBRequest<any[]>;

    //         // use an index if a SortItem is defined
    //         try {
    //             if (sortItem) {
    //                 let direction: 'next' | 'prev' | 'nextunique' | 'prevunique' = 'next';

    //                 if (sortItem.order === SortItemDirection.DESC) {
    //                     direction = 'prev';
    //                 }

    //                 if (sortItem.key === 'id') {
    //                     request = objectStore.getAll({ direction });
    //                     // request = objectStore.getAll(null, direction);
    //                 }
    //                 else {
    //                     request = objectStore.index(sortItem.key).getAll({ direction });
    //                 }
    //             }
    //             else {
    //                 request = objectStore.getAll();
    //             }
    //         }
    //         catch (e) {
    //             reject(e);
    //             return;
    //         }

    //         request.onsuccess = () => {
    //             const result = request.result.map(transform);
    //             Promise.all(result).then((orders) => {
    //                 this._cache = orders;
    //                 resolve(orders);
    //             }).catch(e => reject(e));
    //         };
    //     });
    // }

    // // todo: rename
    // async getMultipleRaw<T>({ filter, limit, sortItem, advanceCount, transform, openTransaction }: {
    //     transform: (rawOrder: any) => Promise<T>;
    //     filter?: StamhoofdFilter;
    //     limit?: number;
    //     sortItem?: SortItem & { key: OrderIndexedDBIndex | 'id' };
    //     advanceCount?: number;
    //     openTransaction?: IDBTransaction;
    // },
    // ): Promise<T[]> {
    //     let cache = await this.getCache<T>({ transform, sortItem, openTransaction });

    //     if (advanceCount) {
    //         cache = cache.slice(advanceCount);
    //     }

    //     if (!limit && !filter) {
    //         return cache;
    //     }

    //     if (!filter) {
    //         return cache.slice(0, limit);
    //     }

    //     let compiledFilter: InMemoryFilterRunner | undefined;

    //     try {
    //         compiledFilter = compileToInMemoryFilter(filter, privateOrderWithTicketsFilterCompilers);
    //     }
    //     catch (e: any) {
    //         console.error('Compile filter failed', e);
    //         throw new CompilerFilterError((e.message as string | undefined) ?? 'Compile filter failed');
    //     }

    //     if (!limit) {
    //         return cache.filter(compiledFilter);
    //     }

    //     const results: T[] = [];

    //     for (const item of cache) {
    //         if (results.length === limit) {
    //             break;
    //         }
    //         if (compiledFilter(item)) {
    //             results.push(item);
    //         }
    //     }

    //     return results;
    // }

    // todo: rename
    async getCache({ sortItem, openTransaction }: {
        sortItem?: SortItem & { key: OrderIndexedDBIndex | 'id' };
        openTransaction?: IDBTransaction;
    },
    ): Promise<any[]> {
        if (this._cache) {
            return this._cache;
        }

        const db = await this.database.get();

        return await new Promise<T[]>((resolve, reject) => {
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

            let request: IDBRequest<any[]>;

            // use an index if a SortItem is defined
            try {
                if (sortItem) {
                    let direction: 'next' | 'prev' | 'nextunique' | 'prevunique' = 'next';

                    if (sortItem.order === SortItemDirection.DESC) {
                        direction = 'prev';
                    }

                    if (sortItem.key === 'id') {
                        request = objectStore.getAll({ direction });
                        // request = objectStore.getAll(null, direction);
                    }
                    else {
                        request = objectStore.index(sortItem.key).getAll({ direction });
                    }
                }
                else {
                    request = objectStore.getAll();
                }
            }
            catch (e) {
                reject(e);
                return;
            }

            request.onsuccess = () => {
                this._cache = request.result;
                resolve(this._cache);
            };
        });
    }

    // todo: rename
    async getMultipleRaw<T>({ filter, limit, sortItem, advanceCount, transform, openTransaction }: {
        transform: (rawOrder: any) => Promise<T>;
        filter?: StamhoofdFilter;
        limit?: number;
        sortItem?: SortItem & { key: OrderIndexedDBIndex | 'id' };
        advanceCount?: number;
        openTransaction?: IDBTransaction;
    },
    ): Promise<T[]> {
        let cache = await this.getCache({ sortItem, openTransaction });

        if (advanceCount) {
            cache = cache.slice(advanceCount);
        }

        const transformAll = async (cache: any[]) => {
            return await Promise.all(cache.map(transform));
        };

        if (!limit && !filter) {
            return await transformAll(cache);
        }

        if (!filter) {
            return await transformAll(cache.slice(0, limit));
        }

        const cacheTransformed = await transformAll(cache);

        let compiledFilter: InMemoryFilterRunner | undefined;

        try {
            compiledFilter = compileToInMemoryFilter(filter, privateOrderWithTicketsFilterCompilers);
        }
        catch (e: any) {
            console.error('Compile filter failed', e);
            throw new CompilerFilterError((e.message as string | undefined) ?? 'Compile filter failed');
        }

        if (!limit) {
            return cacheTransformed.filter(compiledFilter);
        }

        const results: T[] = [];

        for (const item of cacheTransformed) {
            if (results.length === limit) {
                break;
            }
            if (compiledFilter(item)) {
                results.push(item);
            }
        }

        return results;
    }

    async clear(): Promise<void> {
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

    static _init({ oldVersion, database, transaction }: { oldVersion: number; database: IDBDatabase; transaction: IDBTransaction | null }) {
        let storeToBeIndexed: IDBObjectStore | null = null;

        if (oldVersion < 1) {
            storeToBeIndexed = database.createObjectStore(OrdersStore.storeName, { keyPath: 'value.id' });
        }
        else if (transaction) {
            const storeToClear = transaction.objectStore(OrdersStore.storeName);
            storeToClear.clear();

            if (oldVersion < 341) {
                storeToBeIndexed = storeToClear;
            }
        }

        if (storeToBeIndexed) {
            // create indexes

            // typescript will show an error if an index is missing
            const indexes: Record<OrderIndexedDBIndex, IDBIndexParameters & { keyPath: string | Iterable<string> }>
            // auto generate indexes for generated indexes
                = Object.fromEntries(Object.values(OrderIndexedDBIndex).map((index) => {
                    return [index, { unique: false, keyPath: `indexes.${index}` }];
                })) as Record<OrderIndexedDBIndex, IDBIndexParameters & { keyPath: string | Iterable<string> }>
            ;

            Object.entries(indexes).forEach(([index, options]) => {
                storeToBeIndexed.createIndex(index, options.keyPath ?? index, options);
            });
        }
    }
}

/**
 * Responsible for webshop orders network operations.
 */
class WebshopOrdersApiClient {
    private _isFetching = false;
    private lastFetchedOrder: { updatedAt: Date; number: number } | null | undefined = undefined;

    private readonly webshopId: string;
    private readonly context: SessionContext;
    private readonly settingsStore: WebshopSettingsStore;

    get hasFetchedOne() {
        return this.lastUpdated !== null;
    }

    get isFetching() {
        return this._isFetching;
    }

    get lastUpdated(): Date | null {
        return this.lastFetchedOrder?.updatedAt ?? null;
    }

    constructor({ context, settingsStore, webshopId }: { context: SessionContext; settingsStore: WebshopSettingsStore; webshopId: string }) {
        this.context = context;
        this.settingsStore = settingsStore;
        this.webshopId = webshopId;
    }

    reset() {
        this._isFetching = false;
        this.lastFetchedOrder = undefined;
    }

    /**
     * Get the orders from the backend and store them in  the indexed db
     * @param isFetchAll true if all orders should be fetched (and not only the updated orders)
     * @returns true if the backend returned updated orders
     */
    async getAllUpdated({ isFetchAll, onResultsReceived }: { isFetchAll?: boolean; onResultsReceived: (results: PrivateOrder[]) => Promise<void> | void }): Promise<void> {
        if (this._isFetching) {
            return;
        }

        this._isFetching = true;

        if (isFetchAll) {
            this.lastFetchedOrder = null;
        }
        else {
            await this.initLastFetchedOrder();
        }

        // create request
        const filter: StamhoofdFilter = {
            webshopId: this.webshopId,
        };

        if (this.lastFetchedOrder) {
            filter['$or'] = [
                {
                    updatedAt: { $gt: this.lastFetchedOrder.updatedAt },
                },
                {
                    $and: [
                        { updatedAt: { $eq: this.lastFetchedOrder.updatedAt } },
                        { number: { $gt: this.lastFetchedOrder.number } },
                    ],
                },
            ];
        }

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
            await fetchAll(request, fetcher, { onResultsReceived });
        }
        finally {
            this._isFetching = false;
        }
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
        this.lastFetchedOrder = null;
        await this.settingsStore.set('lastFetchedOrder', null);
    }

    async setlastFetchedOrder(order: PrivateOrder) {
        if (order.number === null) {
            console.error('Order has no number');
            return;
        }

        // important: this only works if the orders are sorted by updatedAt asc and then by number asc
        if (this.lastFetchedOrder
            && (this.lastFetchedOrder.updatedAt > order.updatedAt
                || (this.lastFetchedOrder.updatedAt === order.updatedAt && this.lastFetchedOrder.number > order.number)
            )) {
            return;
        }

        this.lastFetchedOrder = {
            updatedAt: order.updatedAt,
            number: order.number!,
        };
        await this.settingsStore.set('lastFetchedOrder', this.lastFetchedOrder);
    }

    private async initLastFetchedOrder() {
        // Only once (if undefined)
        if (this.lastFetchedOrder !== undefined) {
            return;
        }

        try {
            this.lastFetchedOrder = await this.settingsStore.get('lastFetchedOrder') ?? null;
        }
        catch (e) {
            console.error(e);
            // Probably no database support. Ignore it and load everything.
            this.lastFetchedOrder = null;
        }
    }
}
