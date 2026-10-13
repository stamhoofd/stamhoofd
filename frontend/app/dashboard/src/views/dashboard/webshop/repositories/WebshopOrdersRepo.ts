import type { Decoder, PatchableArrayAutoEncoder } from '@simonbackx/simple-encoding';
import { ArrayDecoder, EncodeMedium, ObjectData } from '@simonbackx/simple-encoding';
import { SimpleError } from '@simonbackx/simple-errors';
import { EventBus } from '@stamhoofd/components/EventBus.ts';
import { AppManager } from '@stamhoofd/networking/AppManager';
import type { ObjectFetcher } from '@stamhoofd/components/tables/classes/ObjectFetcher.ts';
import { fetchAll } from '@stamhoofd/components/tables/classes/ObjectFetcher.ts';
import type { SessionContext } from '@stamhoofd/networking/SessionContext';
import type { CountFilteredRequest, InMemoryFilterRunner, SortItem, SortList, StamhoofdFilter } from '@stamhoofd/structures';
import { compileToInMemoryFilter, CountResponse, LimitedFilteredRequest, OrderStatus, PaginatedResponseDecoder, PrivateOrder, privateOrderWithTicketsFilterCompilers, SortItemDirection, Version } from '@stamhoofd/structures';
import { IndexBoxDecoder } from '../IndexBox';
import type { OrderIndexedDBIndex, OrderIndexKey, OrderIndexLookup } from '../ordersIndexedDBSorters';
import { compareIndexKeys, createPrivateOrderIndexBox, getExactIndexLookup, getFilterConjuncts, getIndexKeysOfFilter, getPrivateOrderIndexes, isIndexableValue, orderIndexesInMemoryFilterCompilers } from '../ordersIndexedDBSorters';
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
        this.store.reset();
    }

    close() {
        this.store.close();
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
        callback: (data: T) => void | Promise<void>;
        filter?: StamhoofdFilter;
        limit?: number;
        sortItem?: SortItem & { key: OrderIndexedDBIndex | 'id' };
        advanceCount?: number;
        ids?: string[];
        openTransaction?: IDBTransaction;
        signal?: AbortSignal;
    },
    ): Promise<number> {
        try {
            return await this.store.streamRaw<T>(options);
        } catch (e) {
            if (e instanceof CallbackError || e instanceof CompilerFilterError || options.signal?.aborted) {
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

    async getCandidateIds(indexFilter: StamhoofdFilter): Promise<{ ids: Set<string>; exact: boolean }> {
        return this.store.getCandidateIds(indexFilter);
    }

    async sortIds(ids: Set<string>, sortItem: SortItem & { key: OrderIndexKey }, after: IDBValidKey | null): Promise<string[]> {
        return this.store.sortIds(ids, sortItem, after);
    }

    async countAll() {
        return await this.store.countAll();
    }
}

function setIndexValue(values: Map<string, IDBValidKey>, id: string, value: unknown) {
    if (isIndexableValue(value)) {
        values.set(id, value);
    } else {
        // Like IndexedDB, leave out orders without a value for the index
        values.delete(id);
    }
}

/**
 * Up to this many orders are sorted by reading their own stored index values, if the values of the whole sort index are not cached yet.
 */
const maxIdsToSortWithoutIndexValues = 100;

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

    /**
     * Per index ('id' for the order ids): the stored index value of every order in that index, by order id. Read without loading
     * any order data and kept up to date by the writes of this store. Cleared when another store (e.g. in another tab) reports a change.
     */
    private readonly indexValues = new Map<OrderIndexKey, Map<string, IDBValidKey>>();
    private readonly indexValuesPromises = new Map<OrderIndexKey, Promise<Map<string, IDBValidKey>>>();

    /**
     * Tells the stores of the same webshop in other tabs (or other managers in this tab) that orders changed.
     */
    private channel: BroadcastChannel | null = null;

    /**
     * Increased whenever the cached index values are cleared, so a read that started before does not cache outdated values.
     */
    private indexValuesClearCount = 0;

    /**
     * Increased whenever an index value can have changed.
     */
    private indexValuesVersion = 0;

    private lastCandidates: { indexFilter: string; version: number; result: { ids: Set<string>; exact: boolean } } | null = null;

    constructor({ database }: { database: WebshopDatabase }) {
        this.database = database;
    }

    /**
     * Without change messages, writes in other tabs would leave the cache outdated. The app has no other tabs.
     */
    private get canCacheIndexValues() {
        return typeof BroadcastChannel !== 'undefined' || AppManager.shared.isNative;
    }

    private getChannel(): BroadcastChannel | null {
        if (typeof BroadcastChannel === 'undefined') {
            return null;
        }
        if (!this.channel) {
            this.channel = new BroadcastChannel(this.database.databaseName + '-orders');
            this.channel.onmessage = () => {
                // Changed by another store: start over
                this.clearIndexValues();
            };
        }
        return this.channel;
    }

    private notifyOtherStores() {
        this.getChannel()?.postMessage('changed');
    }

    private clearIndexValues() {
        this.indexValues.clear();
        this.indexValuesClearCount++;
        this.indexValuesVersion++;
    }

    reset() {
        this.clearIndexValues();
    }

    close() {
        this.channel?.close();
        this.channel = null;
        this.clearIndexValues();
    }

    /**
     * The ids of the orders that can match the indexFilter, which may only read the keys of orderIndexesInMemoryFilterCompilers.
     * Only reads stored index values, so this is much faster than visiting every order.
     *
     * exact is false if the ids can also contain orders that do not match.
     */
    async getCandidateIds(indexFilter: StamhoofdFilter): Promise<{ ids: Set<string>; exact: boolean }> {
        const key = JSON.stringify(indexFilter);
        const version = this.indexValuesVersion;
        if (this.lastCandidates && this.lastCandidates.indexFilter === key && this.lastCandidates.version === version) {
            return this.lastCandidates.result;
        }

        const result = await this.readCandidateIds(indexFilter);
        if (this.indexValuesVersion === version) {
            this.lastCandidates = { indexFilter: key, version, result };
        }
        return result;
    }

    private async readCandidateIds(indexFilter: StamhoofdFilter): Promise<{ ids: Set<string>; exact: boolean }> {
        const conjuncts = getFilterConjuncts(indexFilter);

        for (const conjunct of conjuncts) {
            const lookup = getExactIndexLookup(conjunct);
            if (lookup) {
                // Typically a handful of orders: the other parts are left to the filter on the decoded orders
                return { ids: await this.lookupIds(lookup), exact: conjuncts.length === 1 };
            }
        }

        const keys = getIndexKeysOfFilter(indexFilter);
        if (!keys) {
            throw new Error('The index filter reads keys without stored index values');
        }

        const compiledIndexFilter = compileToInMemoryFilter(indexFilter, orderIndexesInMemoryFilterCompilers);
        const [ids, ...keyValues] = await Promise.all([
            this.getIndexValues('id'),
            ...[...keys].map(async k => [k, await this.getIndexValues(k)] as const),
        ]);

        const candidates = new Set<string>();
        const indexes: Record<string, unknown> = {};
        for (const id of ids.keys()) {
            for (const [k, values] of keyValues) {
                indexes[k] = values.get(id) ?? null;
            }
            if (compiledIndexFilter(indexes)) {
                candidates.add(id);
            }
        }
        return { ids: candidates, exact: true };
    }

    private async lookupIds(lookup: OrderIndexLookup): Promise<Set<string>> {
        const db = await this.database.get();
        return await new Promise<Set<string>>((resolve, reject) => {
            const request = db.transaction([OrdersStore.storeName], 'readonly').objectStore(OrdersStore.storeName).index(lookup.index).getAllKeys(IDBKeyRange.only(lookup.key));
            request.onsuccess = () => resolve(new Set(request.result as string[]));
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Sorts the ids in the order a cursor on the index of the sortItem visits them: by index value, then by id.
     * Like that cursor, it leaves out orders that are not in the index (e.g. without a number).
     *
     * @param after only keep the orders the cursor visits after the order with this key ([index value, id], or the id when sorting on id)
     */
    async sortIds(ids: Set<string>, sortItem: SortItem & { key: OrderIndexKey }, after: IDBValidKey | null): Promise<string[]> {
        const direction = sortItem.order === SortItemDirection.DESC ? -1 : 1;
        const compare = (a: { value: IDBValidKey; id: string }, b: { value: IDBValidKey; id: string }) => {
            const c = compareIndexKeys(a.value, b.value);
            return direction * (c !== 0 ? c : (a.id < b.id ? -1 : (a.id > b.id ? 1 : 0)));
        };

        const values = (sortItem.key === 'id' || this.indexValues.has(sortItem.key) || ids.size > maxIdsToSortWithoutIndexValues)
            ? await this.getIndexValues(sortItem.key)
            : await this.readStoredIndexValues(ids, sortItem.key);

        const afterEntry = after === null
            ? null
            : (sortItem.key === 'id' ? { value: after, id: after as string } : { value: (after as IDBValidKey[])[0], id: (after as IDBValidKey[])[1] as string });

        const entries: { value: IDBValidKey; id: string }[] = [];
        for (const id of ids) {
            const value = values.get(id);
            if (value === undefined) {
                continue;
            }
            const entry = { value, id };
            if (afterEntry && compare(entry, afterEntry) <= 0) {
                continue;
            }
            entries.push(entry);
        }

        entries.sort(compare);
        return entries.map(e => e.id);
    }

    /**
     * The index values of these orders, read from their records.
     */
    private async readStoredIndexValues(ids: Set<string>, index: OrderIndexedDBIndex): Promise<Map<string, IDBValidKey>> {
        const db = await this.database.get();
        const values = new Map<string, IDBValidKey>();

        await new Promise<void>((resolve, reject) => {
            const transaction = db.transaction([OrdersStore.storeName], 'readonly');
            const objectStore = transaction.objectStore(OrdersStore.storeName);
            transaction.oncomplete = () => resolve();
            transaction.onerror = () => reject(transaction.error);

            for (const id of ids) {
                const request = objectStore.get(id);
                request.onsuccess = () => {
                    const value: unknown = request.result?.indexes?.[index];
                    if (isIndexableValue(value)) {
                        values.set(id, value);
                    }
                };
            }
        });

        return values;
    }

    private async getIndexValues(index: OrderIndexKey): Promise<Map<string, IDBValidKey>> {
        const db = await this.database.get();
        if (!this.canCacheIndexValues) {
            return this.readIndexValues(db, index);
        }

        const cached = this.indexValues.get(index);

        if (cached) {
            // Catches orders that other tabs added or deleted
            const count = await new Promise<number>((resolve, reject) => {
                const objectStore = db.transaction([OrdersStore.storeName], 'readonly').objectStore(OrdersStore.storeName);
                const request = (index === 'id' ? objectStore : objectStore.index(index)).count();
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            });
            if (count === cached.size) {
                return cached;
            }
            this.indexValues.delete(index);
            this.indexValuesVersion++;
        }

        let promise = this.indexValuesPromises.get(index);
        if (!promise) {
            promise = this.readIndexValues(db, index).finally(() => {
                this.indexValuesPromises.delete(index);
            });
            this.indexValuesPromises.set(index, promise);
        }
        return promise;
    }

    private async readIndexValues(db: IDBDatabase, index: OrderIndexKey): Promise<Map<string, IDBValidKey>> {
        const values = new Map<string, IDBValidKey>();

        // Listen before reading, so no change made during the read goes unnoticed
        this.getChannel();
        const clearCountBefore = this.indexValuesClearCount;

        await new Promise<void>((resolve, reject) => {
            const objectStore = db.transaction([OrdersStore.storeName], 'readonly').objectStore(OrdersStore.storeName);
            const request = (index === 'id' ? objectStore : objectStore.index(index)).openKeyCursor();
            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                const cursor = request.result;
                if (!cursor) {
                    resolve();
                    return;
                }
                values.set(cursor.primaryKey as string, cursor.key);
                cursor.continue();
            };
        });

        // A change reported during the read may be missing from it: use it once, but don't keep it
        if (this.canCacheIndexValues && this.indexValuesClearCount === clearCountBefore) {
            this.indexValues.set(index, values);
        }
        return values;
    }

    private updateIndexValues(order: PrivateOrder) {
        if (this.indexValues.size === 0) {
            return;
        }

        const indexes = order.status === OrderStatus.Deleted ? null : getPrivateOrderIndexes(order);
        for (const [index, values] of this.indexValues) {
            setIndexValue(values, order.id, index === 'id' ? (indexes && order.id) : indexes?.[index]);
        }
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

            transaction.oncomplete = () => {
                for (const values of this.indexValues.values()) {
                    values.delete(id);
                }
                this.indexValuesVersion++;
                this.notifyOtherStores();
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
                for (const order of orders) {
                    this.updateIndexValues(order);
                }
                this.indexValuesVersion++;
                this.notifyOtherStores();
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

    async streamRaw<T>({ callback, filter, limit, sortItem, advanceCount, ids, transform, openTransaction, signal }: {
        transform: (rawOrder: any) => Promise<T>;
        /**
         * Called for every order that matches, before the cursor moves on. Anything it awaits has to
         * keep the transaction alive, so it may only await work on `openTransaction`.
         */
        callback: (data: T) => void | Promise<void>;
        filter?: StamhoofdFilter;
        limit?: number;
        sortItem?: SortItem & { key: OrderIndexedDBIndex | 'id' };
        advanceCount?: number;
        /**
         * Only visit these orders, in this order. Cannot be combined with a sortItem or advanceCount.
         */
        ids?: string[];
        openTransaction?: IDBTransaction;
        /**
         * Stops the stream and rejects with the abort reason. Checked before every cursor step.
         */
        signal?: AbortSignal;
    },
    ): Promise<number> {
        signal?.throwIfAborted();

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

            let matchedItemsCount = 0;
            let totalIterationCount = advanceCount ?? 0;

            let compiledFilter: InMemoryFilterRunner | undefined;

            try {
                if (filter) {
                    compiledFilter = compileToInMemoryFilter(filter, privateOrderWithTicketsFilterCompilers);
                }
            } catch (e: any) {
                console.error('Compile filter failed', e);
                reject(new CompilerFilterError((e.message as string | undefined) ?? 'Compile filter failed'));
                return;
            }

            /**
             * Returns true if the stream should stop.
             */
            const shouldStop = (): boolean => {
                if (signal?.aborted) {
                    // Not continuing the cursor lets the transaction complete normally
                    reject(signal.reason);
                    return true;
                }

                if (limit && matchedItemsCount >= limit) {
                    resolve(totalIterationCount);
                    return true;
                }
                return false;
            };

            const handleValue = (value: any, next: () => void) => {
                transform(value).then(async (decodedResult) => {
                    if (compiledFilter && !compiledFilter(decodedResult)) {
                        totalIterationCount += 1;
                        next();
                        return;
                    }

                    try {
                        await callback(decodedResult);
                    } catch (e: any) {
                        console.error('callback failed', e);
                        // Propagate error
                        reject(new CallbackError((e.message as string | undefined) ?? 'Callback failed'));
                        return;
                    }

                    totalIterationCount += 1;
                    matchedItemsCount += 1;
                    next();
                }).catch((e) => {
                    reject(e);
                });
            };

            if (ids) {
                if (sortItem || advanceCount) {
                    reject(new Error('ids cannot be combined with a sortItem or advanceCount'));
                    return;
                }
                let position = 0;

                const getNext = () => {
                    if (shouldStop()) {
                        return;
                    }
                    if (position >= ids.length) {
                        resolve(totalIterationCount);
                        return;
                    }
                    const getRequest = objectStore.get(ids[position]);
                    position += 1;
                    getRequest.onsuccess = () => {
                        if (getRequest.result === undefined) {
                            totalIterationCount += 1;
                            getNext();
                            return;
                        }
                        handleValue(getRequest.result, getNext);
                    };
                };
                getNext();
                return;
            }

            let request: IDBRequest<IDBCursorWithValue | null>;

            try {
                if (sortItem) {
                    const direction: IDBCursorDirection = sortItem.order === SortItemDirection.DESC ? 'prev' : 'next';
                    const source = sortItem.key === 'id' ? objectStore : objectStore.index(sortItem.key);
                    request = source.openCursor(null, direction);
                } else {
                    request = objectStore.openCursor();
                }
            } catch (e) {
                reject(e);
                return;
            }

            const onsuccess = () => {
                if (shouldStop()) {
                    return;
                }

                const cursor = request.result;
                if (!cursor) {
                    // no more results
                    resolve(totalIterationCount);
                    return;
                }

                handleValue(cursor.value, () => cursor.continue());
            };

            if (advanceCount) {
                request.onsuccess = () => {
                    const cursor = request.result;
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

            transaction.oncomplete = () => {
                this.clearIndexValues();
                this.notifyOtherStores();
            };

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
