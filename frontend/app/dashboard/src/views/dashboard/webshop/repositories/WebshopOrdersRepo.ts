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
import type { OrderIndexedDBIndex, OrderIndexKey, OrderIndexLookup } from '../ordersIndexedDBSorters';
import { compareIndexKeys, createPrivateOrderIndexBox, getExactIndexLookup, getFilterConjuncts, getIndexKeysOfFilter, getPrivateOrderIndexes, isIndexableValue, orderIndexesInMemoryFilterCompilers } from '../ordersIndexedDBSorters';
import type { WebshopDatabase, WebshopStoreName } from './WebshopDatabase';
import { WebshopSettingsKeys, WebshopSettingsStore } from './WebshopSettingsStore';
import type { ProgressListener, SyncProgress } from './syncProgress';
import { countSyncItems, getNewItemsFilter, SharedSync, SINGLE_FETCH_TIMEOUT_MS } from './syncProgress';
import { SyncState } from './SyncState';
import { v4 as uuidv4 } from 'uuid';
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
        after?: IDBValidKey | null;
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
        after?: IDBValidKey | null;
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

function requestResult<T>(request: IDBRequest): Promise<T> {
    return new Promise<T>((resolve, reject) => {
        request.onsuccess = () => resolve(request.result as T);
        request.onerror = () => reject(request.error);
    });
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

type SortEntry = { value: IDBValidKey; id: string };

/**
 * Responsible for offline storage of webshop orders.
 */
export class OrdersStore {
    static readonly storeName: WebshopStoreName = 'orders';
    private readonly database: WebshopDatabase;

    /**
     * Per index ('id' for the order ids): the stored index value of every order in that index, by order id. Read without loading
     * any order data. Only valid while the stored change token still equals indexValuesToken.
     */
    private readonly indexValues = new Map<OrderIndexKey, Map<string, IDBValidKey>>();
    private indexValuesToken: string | null = null;
    private readonly indexValuesPromises = new Map<OrderIndexKey, Promise<Map<string, IDBValidKey>>>();

    private lastCandidates: { indexFilter: string; token: string; result: Promise<{ ids: Set<string>; exact: boolean }> } | null = null;

    /**
     * The last candidate ids that sortIds sorted, so the next pages of the same sort only need to find where they start.
     */
    private lastSorted: { ids: Set<string>; sortKey: string; token: string; entries: SortEntry[] } | null = null;

    constructor({ database }: { database: WebshopDatabase }) {
        this.database = database;
    }

    private clearIndexValues() {
        this.indexValues.clear();
        this.indexValuesToken = null;
        this.lastCandidates = null;
        this.lastSorted = null;
    }

    reset() {
        this.clearIndexValues();
    }

    close() {
        this.clearIndexValues();
    }

    /**
     * The stored change token (see WebshopSettingsKeys.OrdersChangeToken). Stores one first if there is none yet, so the
     * index values of orders that were stored before tokens existed can be cached too.
     */
    private async getChangeToken(): Promise<string> {
        const db = await this.database.get();
        const transaction = db.transaction([WebshopSettingsStore.storeName], 'readonly');
        const token = await requestResult<string | undefined>(transaction.objectStore(WebshopSettingsStore.storeName).get(WebshopSettingsKeys.OrdersChangeToken));
        if (token !== undefined) {
            return token;
        }

        return await new Promise<string>((resolve, reject) => {
            const transaction = db.transaction([WebshopSettingsStore.storeName], 'readwrite');
            const settings = transaction.objectStore(WebshopSettingsStore.storeName);
            const request = settings.get(WebshopSettingsKeys.OrdersChangeToken);
            let token: string;
            request.onsuccess = () => {
                token = (request.result as string | undefined) ?? uuidv4();
                settings.put(token, WebshopSettingsKeys.OrdersChangeToken);
            };
            transaction.oncomplete = () => resolve(token);
            transaction.onerror = () => reject(transaction.error);
        });
    }

    /**
     * Stores a new change token in the transaction of a write, and keeps the cached index values if the write is the only
     * change since they were read: applyToIndexValues then brings them up to date. Otherwise they are cleared.
     */
    private replaceChangeToken(transaction: IDBTransaction, applyToIndexValues: () => void) {
        const settings = transaction.objectStore(WebshopSettingsStore.storeName);
        const newToken = uuidv4();
        let previousToken: string | undefined;

        const request = settings.get(WebshopSettingsKeys.OrdersChangeToken);
        request.onsuccess = () => {
            previousToken = request.result as string | undefined;
        };
        settings.put(newToken, WebshopSettingsKeys.OrdersChangeToken);

        transaction.addEventListener('complete', () => {
            if (this.indexValuesToken === null || previousToken !== this.indexValuesToken) {
                this.clearIndexValues();
                return;
            }
            applyToIndexValues();
            this.indexValuesToken = newToken;
        });
    }

    /**
     * The ids of the orders that can match the indexFilter, which may only read the keys of orderIndexesInMemoryFilterCompilers.
     * Only reads stored index values, so this is much faster than visiting every order.
     *
     * exact is false if the ids can also contain orders that do not match.
     */
    async getCandidateIds(indexFilter: StamhoofdFilter): Promise<{ ids: Set<string>; exact: boolean }> {
        const key = JSON.stringify(indexFilter);
        const token = await this.getChangeToken();
        if (this.lastCandidates && this.lastCandidates.indexFilter === key && this.lastCandidates.token === token) {
            return this.lastCandidates.result;
        }

        // Stored before it resolves, so a count and a fetch of the same new filter share one read
        const result = this.readCandidateIds(indexFilter, token);
        const candidates = { indexFilter: key, token, result };
        this.lastCandidates = candidates;
        result.catch(() => {
            if (this.lastCandidates === candidates) {
                this.lastCandidates = null;
            }
        });
        return result;
    }

    private async readCandidateIds(indexFilter: StamhoofdFilter, token: string): Promise<{ ids: Set<string>; exact: boolean }> {
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
            this.getIndexValues('id', token),
            ...[...keys].map(async k => [k, await this.getIndexValues(k, token)] as const),
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
        const compare = (a: SortEntry, b: SortEntry) => {
            const c = compareIndexKeys(a.value, b.value);
            return direction * (c !== 0 ? c : (a.id < b.id ? -1 : (a.id > b.id ? 1 : 0)));
        };

        const token = await this.getChangeToken();
        const sortKey = sortItem.key + ' ' + direction;
        let entries: SortEntry[];

        if (this.lastSorted && this.lastSorted.ids === ids && this.lastSorted.sortKey === sortKey && this.lastSorted.token === token) {
            entries = this.lastSorted.entries;
        }
        else {
            const isCached = this.indexValuesToken === token && this.indexValues.has(sortItem.key);
            const values = (sortItem.key === 'id' || isCached || ids.size > maxIdsToSortWithoutIndexValues)
                ? await this.getIndexValues(sortItem.key, token)
                : await this.readStoredIndexValues(ids, sortItem.key);

            entries = [];
            for (const id of ids) {
                const value = values.get(id);
                if (value !== undefined) {
                    entries.push({ value, id });
                }
            }
            entries.sort(compare);
            this.lastSorted = { ids, sortKey, token, entries };
        }

        let start = 0;
        if (after !== null) {
            const afterEntry: SortEntry = sortItem.key === 'id' ? { value: after, id: after as string } : { value: (after as IDBValidKey[])[0], id: (after as IDBValidKey[])[1] as string };

            // First entry after afterEntry
            let end = entries.length;
            while (start < end) {
                const middle = (start + end) >>> 1;
                if (compare(entries[middle], afterEntry) <= 0) {
                    start = middle + 1;
                }
                else {
                    end = middle;
                }
            }
        }

        return entries.slice(start).map(e => e.id);
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

    /**
     * @param token the current change token, which the cached values have to match
     */
    private async getIndexValues(index: OrderIndexKey, token: string): Promise<Map<string, IDBValidKey>> {
        const cached = this.indexValues.get(index);
        if (cached && this.indexValuesToken === token) {
            return cached;
        }

        let promise = this.indexValuesPromises.get(index);
        if (!promise) {
            promise = this.readIndexValues(index).finally(() => {
                this.indexValuesPromises.delete(index);
            });
            this.indexValuesPromises.set(index, promise);
        }
        return promise;
    }

    private async readIndexValues(index: OrderIndexKey): Promise<Map<string, IDBValidKey>> {
        const db = await this.database.get();
        const values = new Map<string, IDBValidKey>();

        // One transaction, so the token belongs to exactly these values
        const transaction = db.transaction([OrdersStore.storeName, WebshopSettingsStore.storeName], 'readonly');
        const tokenPromise = requestResult<string | undefined>(transaction.objectStore(WebshopSettingsStore.storeName).get(WebshopSettingsKeys.OrdersChangeToken));

        await new Promise<void>((resolve, reject) => {
            const objectStore = transaction.objectStore(OrdersStore.storeName);
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

        const token = await tokenPromise;
        if (token !== undefined) {
            if (this.indexValuesToken !== token) {
                this.indexValues.clear();
                this.indexValuesToken = token;
            }
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
        const db = await this.database.get();

        return new Promise<void>((resolve, reject) => {
            const transaction = db.transaction([OrdersStore.storeName, WebshopSettingsStore.storeName], 'readwrite');

            transaction.onerror = (event) => {
                // Don't forget to handle errors!
                reject(event);
            };

            this.replaceChangeToken(transaction, () => {
                for (const values of this.indexValues.values()) {
                    values.delete(id);
                }
            });

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
        const db = await this.database.get();

        return new Promise<void>((resolve, reject) => {
            const transaction = db.transaction([OrdersStore.storeName, WebshopSettingsStore.storeName], 'readwrite');

            this.replaceChangeToken(transaction, () => {
                for (const order of orders) {
                    this.updateIndexValues(order);
                }
            });

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

    async streamRaw<T>({ callback, filter, limit, sortItem, after, ids, transform, openTransaction, signal }: {
        transform: (rawOrder: any) => Promise<T>;
        /**
         * Called for every order that matches, before the cursor moves on. Anything it awaits has to
         * keep the transaction alive, so it may only await work on `openTransaction`.
         */
        callback: (data: T) => void | Promise<void>;
        filter?: StamhoofdFilter;
        limit?: number;
        sortItem?: SortItem & { key: OrderIndexedDBIndex | 'id' };
        /**
         * Only visit the orders the cursor of the sortItem visits after the order with this key ([index value, id], or the id
         * when sorting on id).
         */
        after?: IDBValidKey | null;
        /**
         * Only visit these orders, in this order. Cannot be combined with a sortItem or after.
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

        const db = await this.database.get();

        return await new Promise<number>((resolve, reject) => {
            const transaction = openTransaction ?? db.transaction([OrdersStore.storeName], 'readonly');

            transaction.onerror = (event) => {
                // Don't forget to handle errors!
                this.database.delete().catch(console.error);
                reject(event);
            };

            const objectStore = transaction.objectStore(OrdersStore.storeName);

            let matchedItemsCount = 0;
            let totalIterationCount = 0;

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
                if (sortItem || after) {
                    reject(new Error('ids cannot be combined with a sortItem or after'));
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
            const isAscending = sortItem?.order !== SortItemDirection.DESC;

            // Index value and id of the order to continue after, when sorting on an index
            let afterInIndex: { value: IDBValidKey; id: IDBValidKey } | null = null;

            try {
                if (sortItem && after !== null && after !== undefined && sortItem.key !== 'id') {
                    afterInIndex = { value: (after as IDBValidKey[])[0], id: (after as IDBValidKey[])[1] };
                }

                if (sortItem) {
                    const direction: IDBCursorDirection = isAscending ? 'next' : 'prev';
                    if (sortItem.key === 'id') {
                        const range = (after === null || after === undefined) ? null : (isAscending ? IDBKeyRange.lowerBound(after, true) : IDBKeyRange.upperBound(after, true));
                        request = objectStore.openCursor(range, direction);
                    } else {
                        // Starts at the first order with the same index value: the ones up to the id are skipped below
                        const range = afterInIndex ? (isAscending ? IDBKeyRange.lowerBound(afterInIndex.value) : IDBKeyRange.upperBound(afterInIndex.value)) : null;
                        request = objectStore.index(sortItem.key).openCursor(range, direction);
                    }
                } else {
                    request = objectStore.openCursor();
                }
            } catch (e) {
                reject(e);
                return;
            }

            /**
             * Moves the cursor past the orders with the index value of afterInIndex, up to and including its id.
             * Returns false once the cursor is after it.
             */
            const skipUpToAfter = (cursor: IDBCursorWithValue): boolean => {
                if (!afterInIndex || indexedDB.cmp(cursor.key, afterInIndex.value) !== 0) {
                    afterInIndex = null;
                    return false;
                }
                const position = indexedDB.cmp(cursor.primaryKey, afterInIndex.id) * (isAscending ? 1 : -1);
                if (position > 0) {
                    afterInIndex = null;
                    return false;
                }
                if (position === 0) {
                    cursor.continue();
                }
                else {
                    cursor.continuePrimaryKey(afterInIndex.value, afterInIndex.id);
                }
                return true;
            };

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

                if (skipUpToAfter(cursor)) {
                    return;
                }

                handleValue(cursor.value, () => cursor.continue());
            };

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
        const db = await this.database.get();

        return new Promise<void>((resolve, reject) => {
            const transaction = db.transaction([OrdersStore.storeName, WebshopSettingsStore.storeName], 'readwrite');

            transaction.onerror = (event) => {
                // Don't forget to handle errors!
                reject(event);
            };

            // Do the actual saving
            const objectStore = transaction.objectStore(OrdersStore.storeName);

            this.replaceChangeToken(transaction, () => {
                for (const values of this.indexValues.values()) {
                    values.clear();
                }
            });

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
