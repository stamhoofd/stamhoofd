import { ArrayDecoder, Decoder, ObjectData, PatchableArrayAutoEncoder } from '@simonbackx/simple-encoding';
import { SimpleError } from '@simonbackx/simple-errors';
import { EventBus, fetchAll, ObjectFetcher } from '@stamhoofd/components';
import { SessionContext } from '@stamhoofd/networking';
import { compileToInMemoryFilter, CountFilteredRequest, CountResponse, InMemoryFilterRunner, LimitedFilteredRequest, OrderStatus, PaginatedResponseDecoder, PrivateOrder, privateOrderFilterCompilers, SortItem, SortItemDirection, SortList, StamhoofdFilter, Version } from '@stamhoofd/structures';
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
    private readonly apiClient: WebshopOrdersApiClient;
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
        const storePromises: Promise<void>[] = [];

        const onResultsReceived = async (orders: PrivateOrder[]) => {
            if (isFetchAll && !hadSuccessfulFetch) {
                hadSuccessfulFetch = true;
                await this.store.clear();
                await this.apiClient.clearLastFetchedOrder();
            }

            if (orders.length > 0) {
                const deletedOrders: PrivateOrder[] = [];
                const fetchedOrders: PrivateOrder[] = [];

                for (const order of orders) {
                    if (order.status === OrderStatus.Deleted) {
                        deletedOrders.push(order);
                        continue;
                    }

                    fetchedOrders.push(order);
                }

                const storeOrdersPromise = this.store.putAll(orders);
                storePromises.push(storeOrdersPromise);

                const promises: Promise<unknown>[] = [
                    storeOrdersPromise,
                    // todo: this should be run sync?
                ];

                if (fetchedOrders.length > 0) {
                    // todo: is this necessary and should this always be broadcasted (thus without if statement)?
                    promises.push(this.eventBus.sendEvent('fetched', fetchedOrders));
                }

                if (deletedOrders.length > 0) {
                    // todo: is this necessary
                    promises.push(this.eventBus.sendEvent('deleted', deletedOrders));
                }

                await Promise.all(promises.map(promise => promise.catch(console.error)));

                // Only set the last fetched order if everything is stored correctly
                await this.apiClient.setlastFetchedOrder(orders[orders.length - 1]);
            }
        };

        await this.apiClient.getAllUpdated({ isFetchAll, onResultsReceived });
        await Promise.all(storePromises);
        this.apiClient.setLastUpdated(new Date());
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

    async stream(
        { callback, filter, limit, sortItem, networkFetch }: {
            callback: (data: PrivateOrder) => void;
            filter?: StamhoofdFilter;
            limit?: number;
            sortItem?: SortItem & { key: OrderIndexedDBIndex | 'id' };
            /**
             * @deprecated
             */
            networkFetch?: boolean;
        },
    ): Promise<void> {
        try {
            // todo: handle decode error in a cleaner way
            await this.store.stream({
                callback,
                handleDecodeError: async () => {
                    // force fetch all again
                    await this.apiClient.clearLastFetchedOrder();
                },
                filter, limit, sortItem });
        }
        catch (e) {
            if (e instanceof CallbackError || e instanceof CompilerFilterError) {
                throw e;
            }
            throw new SimpleError({
                code: 'loading_failed',
                message: $t('b17b2abe-34a5-4231-a170-5a9b849ecd3c'),
            });
        }

        if (networkFetch) {
            const owner = {};
            this.eventBus.addListener(owner, 'fetched', (orders: PrivateOrder[]) => {
                for (const order of orders) {
                    callback(order);
                }
                return Promise.resolve();
            });

            try {
                await this.fetchAllUpdated();
            }

            finally {
                this.eventBus.removeListener(owner);
            }
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

    async stream(
        { callback, handleDecodeError, filter, limit, sortItem }: {
            callback: (data: PrivateOrder) => void;
            handleDecodeError: () => Promise<void>;
            filter?: StamhoofdFilter;
            limit?: number;
            sortItem?: SortItem & { key: OrderIndexedDBIndex | 'id' };
        },
    ): Promise<void> {
        const db = await this.database.get();

        await new Promise<void>((resolve, reject) => {
            const transaction = db.transaction([OrdersStore.storeName], 'readonly');

            transaction.onerror = (event) => {
                // Don't forget to handle errors!
                this.database.delete().catch(console.error);
                reject(event);
            };

            // Do the actual saving
            const objectStore = transaction.objectStore(OrdersStore.storeName);

            let request: IDBRequest<IDBCursorWithValue | null>;

            // use an index if a SortItem is defined
            try {
                if (sortItem) {
                    let direction: IDBCursorDirection = 'next';

                    if (sortItem.order === SortItemDirection.DESC) {
                        direction = 'prev';
                    }

                    request = (sortItem.key === 'id' ? objectStore : objectStore.index(sortItem.key))
                        .openCursor(null, direction);
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

            let compiledFilter: InMemoryFilterRunner | undefined;

            if (filter) {
                try {
                    compiledFilter = compileToInMemoryFilter(filter, privateOrderFilterCompilers);
                }
                catch (e: any) {
                    console.error('Compile filter failed', e);
                    reject(new CompilerFilterError((e.message as string | undefined) ?? 'Compile filter failed'));
                    return;
                }
            }

            const decoder = new IndexBoxDecoder(PrivateOrder as Decoder<PrivateOrder>);

            request.onsuccess = (event: any) => {
                if (limit && matchedItemsCount >= limit) {
                    // limit reached
                    resolve();
                    return;
                }

                const cursor: IDBCursor & { value: any } | undefined = event.target.result;
                if (cursor) {
                    const rawOrder = cursor.value;

                    let decodedResult: PrivateOrder;

                    try {
                        decodedResult = decoder.decode(new ObjectData(rawOrder, { version: Version }));
                    }
                    catch (e) {
                        handleDecodeError().catch(console.error);

                        // Stop reading without throwing an error
                        return;
                    }

                    if (compiledFilter && !compiledFilter(decodedResult)) {
                        cursor.continue();
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
                    matchedItemsCount += 1;
                }
                else {
                    // no more results
                    resolve();
                }
            };
        });
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
    private _lastUpdated: Date | null = null;
    private fetcher: ObjectFetcher<PrivateOrder>;

    private readonly webshopId: string;
    private readonly context: SessionContext;
    private readonly settingsStore: WebshopSettingsStore;

    get hasFetchedOne() {
        return !!this._lastUpdated;
    }

    get isFetching() {
        return this._isFetching;
    }

    get lastUpdated() {
        return this._lastUpdated;
    }

    constructor({ context, settingsStore, webshopId }: { context: SessionContext; settingsStore: WebshopSettingsStore; webshopId: string }) {
        this.context = context;
        this.settingsStore = settingsStore;
        this.webshopId = webshopId;
        this.fetcher = this.getObjectFetcher();
    }

    reset() {
        this._isFetching = false;
        this.lastFetchedOrder = undefined;
        this._lastUpdated = null;
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

        const sort: SortList = [
            { key: 'updatedAt', order: SortItemDirection.ASC },
            { key: 'number', order: SortItemDirection.ASC },
        ];

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
            sort,
        });

        try {
            await fetchAll(request, this.fetcher, { onResultsReceived });
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

    setLastUpdated(date: Date) {
        this._lastUpdated = date;
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
            if (this.lastFetchedOrder?.updatedAt && !this._lastUpdated) {
                // Set initial timestamp in case of network error later on
                this._lastUpdated = this.lastFetchedOrder.updatedAt;
            }
        }
        catch (e) {
            console.error(e);
            // Probably no database support. Ignore it and load everything.
            this.lastFetchedOrder = null;
        }
    }

    private getObjectFetcher(): ObjectFetcher<PrivateOrder> {
        return {
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
    }
}
