import { SimpleError } from '@simonbackx/simple-errors';
import { Request } from '@simonbackx/simple-networking';
import type { ObjectFetcher } from '@stamhoofd/components/tables/classes/ObjectFetcher.ts';
import type { CountFilteredRequest, PrivateOrderWithTickets, SortItem, SortList, StamhoofdFilter } from '@stamhoofd/structures';
import { assertSort, getOrderSearchFilter, getSortFilter, LimitedFilteredRequest, mergeFilters, SortItemDirection } from '@stamhoofd/structures';
import { parsePhoneNumber } from 'libphonenumber-js';
import { toRaw } from 'vue';
import type { OrderIndexedDBIndex } from '../ordersIndexedDBSorters';
import { getOrderIndexKey, ordersIndexedDBSorters, splitIndexFilter } from '../ordersIndexedDBSorters';
import type { WebshopManager } from '../WebshopManager';
import { OrderRequiredFilterHelper } from './OrderRequiredFilterHelper';

/**
 * Where to continue for a next request that fetch returned: by its identity, so tables and exports that fetch at the same
 * time each continue their own pages.
 */
const resumeStates = new WeakMap<LimitedFilteredRequest, {
    /**
     * The sort index key of the last order of the previous page: the next page continues after it, also when other tabs
     * changed the stored orders in between.
     */
    indexKeyToResumeAfter: IDBValidKey | null;
}>();

type ObjectType = PrivateOrderWithTickets;

function extendSort(list: SortList): SortList {
    /**
     * IndexedDB does first sort on the index of the cursor and next on the id.
     * Because of this we always have to sort on id, with the same direction/order as the first sort item.
     */
    const order = list[0]?.order ?? SortItemDirection.ASC;
    return assertSort(list, [{ key: 'id', order }]);
}

/**
 * The keys this builds (number, email, phone, name) can all be filtered on the stored index values.
 */
function searchToFilter(search: string | null): StamhoofdFilter | null {
    return getOrderSearchFilter(search, parsePhoneNumber);
}

/**
 * The key of the order in the sort index, as OrdersStore.sortIds expects it.
 */
function getSortIndexKey(order: PrivateOrderWithTickets, sortItem: SortItem & { key: OrderIndexedDBIndex | 'id' }): IDBValidKey | null {
    const value = getOrderIndexKey(order, sortItem.key);
    if (value === null || sortItem.key === 'id') {
        return value;
    }
    return [value, order.id];
}

export function useOrdersObjectFetcher(manager: WebshopManager, overrides?: Partial<ObjectFetcher<ObjectType>>): ObjectFetcher<ObjectType> & { reset: () => void; isWaitingForInternet: boolean } {
    const objectFetcher = {
        isOffline: false,
        internetPromise: null as Promise<void> | null,
        lastInternetLoad: 0,
        lastInternetAttempt: 0,
        /**
         * True while a fetch waits for the sync before reading, so it will read whatever the sync stores.
         */
        isWaitingForInternet: false,
        extendSort,
        /**
         * Only the first read waits for the network: until then the stored orders can be missing or outdated.
         * Later reads use the stored orders right away, and the sync updates the table when it brings in changes.
         */
        async syncBeforeReading() {
            if (this.lastInternetLoad === 0 && !this.isOffline) {
                this.isWaitingForInternet = true;
                try {
                    await this.loadFromInternet();
                }
                finally {
                    this.isWaitingForInternet = false;
                }
                return;
            }

            this.loadFromInternet().catch(console.error);
        },
        async loadFromInternet() {
            if (this.internetPromise) {
                return this.internetPromise;
            }

            this.internetPromise = this.doLoadFromInternet().finally(() => {
                this.internetPromise = null;
            });

            return this.internetPromise;
        },
        async doLoadFromInternet() {
            // Prevent doing multiple calls within 5 seconds (other rate limiting should happen outside of the object fetcher).
            // Until a sync succeeded, the stored orders can be missing, so a retry always fetches.
            if (this.lastInternetLoad !== 0 && this.lastInternetAttempt > Date.now() - 5_000) {
                return;
            }
            this.lastInternetAttempt = Date.now();

            try {
                this.isOffline = false;

                await manager.orders.fetchAllUpdated();
                await manager.tickets.fetchAllUpdated();
                this.lastInternetLoad = Date.now();
            }
            catch (e) {
                if (Request.isNetworkError(e)) {
                    console.warn('Failed to fetch new orders from the network', e);
                    this.isOffline = true;
                }
                else {
                    throw e;
                }
            }
        },

        async fetch(data: LimitedFilteredRequest, options?: { signal?: AbortSignal }) {
            data = toRaw(data);
            console.log('Orders(IndexedDb).fetch', data);
            const results: PrivateOrderWithTickets[] = [];
            const filters = [data.filter];

            const searchFilter = searchToFilter(data.search);
            if (searchFilter !== null) {
                filters.push(searchFilter);
            }

            // A next page continues after the order in resumeStates: its pageFilter is not needed to read it
            if (!data.pageFilter) {
                await this.syncBeforeReading();
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

            const indexKeyToResumeAfter = resumeStates.get(data)?.indexKeyToResumeAfter ?? null;

            const { indexFilter } = splitIndexFilter(filter, OrderRequiredFilterHelper.getDefault(manager.preview.id));

            if (indexFilter) {
                // Find and sort the matching orders on their stored index values, so only the orders of this page get decoded
                const { ids } = await manager.orders.getCandidateIds(indexFilter);
                const sortedIds = await manager.orders.sortIds(ids, sortItem, indexKeyToResumeAfter);

                await manager.streamOrdersWithPatchedTickets({
                    callback: (order) => {
                        results.push(order);
                    },
                    filter,
                    limit: data.limit,
                    ids: sortedIds,
                    signal: options?.signal,
                });
            }
            else {
                await manager.streamOrdersWithPatchedTickets({
                    callback: (order) => {
                        results.push(order);
                    },
                    filter,
                    limit: data.limit,
                    sortItem,
                    after: indexKeyToResumeAfter,
                    signal: options?.signal,
                });
            }

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
                resumeStates.set(next, {
                    indexKeyToResumeAfter: getSortIndexKey(lastItem, sortItem),
                });
            }

            return { results, next };
        },
        async fetchCount(data: CountFilteredRequest, options?: { signal?: AbortSignal }): Promise<number> {
            data = toRaw(data);
            console.log('Orders(IndexedDb).fetchCount', data);

            await this.syncBeforeReading();

            if (!data.search && OrderRequiredFilterHelper.isDefault(manager.preview.id, data.filter)) {
                return await manager.orders.countAll();
            }

            let count = 0;

            const filters = [data.filter];

            const searchFilter = searchToFilter(data.search);
            if (searchFilter !== null) {
                filters.push(searchFilter);
            }

            const filter = mergeFilters(filters, '$and');
            const { indexFilter, coversFilter } = splitIndexFilter(filter, OrderRequiredFilterHelper.getDefault(manager.preview.id));
            const candidates = indexFilter ? await manager.orders.getCandidateIds(indexFilter) : null;

            if (candidates && candidates.exact && coversFilter) {
                return candidates.ids.size;
            }

            await manager.streamOrdersWithPatchedTickets({
                callback: () => {
                    count++;
                },
                filter,
                ids: candidates ? [...candidates.ids] : undefined,
                // Counting never looks at an order, let alone at its tickets
                withTickets: false,
                signal: options?.signal,
            });
            console.log('[Done] Orders(IndexedDb).fetchCount', data, count);

            return count;
        },
        reset() {
            this.isOffline = false;
            this.lastInternetLoad = 0;
            this.lastInternetAttempt = 0;
            this.internetPromise = null;
        },
        ...overrides,
    };

    return objectFetcher;
}
