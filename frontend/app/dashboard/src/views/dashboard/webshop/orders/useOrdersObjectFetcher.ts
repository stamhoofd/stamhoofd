import { ObjectFetcher } from '@stamhoofd/components';
import { assertSort, CountFilteredRequest, getOrderSearchFilter, getSortFilter, LimitedFilteredRequest, mergeFilters, PrivateOrderWithTickets, SortItem, SortItemDirection, SortList, StamhoofdFilter, TicketPrivate } from '@stamhoofd/structures';
import { parsePhoneNumber } from 'libphonenumber-js';
import { WebshopManager } from '../WebshopManager';
import { OrderIndexedDBIndex, ordersIndexedDBSorters } from '../ordersIndexedDBSorters';
import { Request } from '@simonbackx/simple-networking';
import { SimpleError } from '@simonbackx/simple-errors';

type ObjectType = PrivateOrderWithTickets;

function extendSort(list: SortList): SortList {
    // Id should always be sorted by ASC if not the only one in the list (because other indexes first sort by own key, then by id ASC)
    return assertSort(list, [{ key: 'id', order: SortItemDirection.ASC }]);
}

function searchToFilter(search: string | null): StamhoofdFilter | null {
    return getOrderSearchFilter(search, parsePhoneNumber);
}

export function useOrdersObjectFetcher(manager: WebshopManager, overrides?: Partial<ObjectFetcher<ObjectType>>): ObjectFetcher<ObjectType> {
    const objectFetcher = {
        isOffline: false,
        internetPromise: null as Promise<void> | null,
        lastInternetLoad: 0,
        extendSort,
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
            try {
                // Prevent doing multiple calls within 5 seconds (other rate limiting should happen outside of the object fetcher)
                if (!this.isOffline && this.lastInternetLoad > Date.now() - 5_000) {
                    return;
                }

                this.isOffline = false;
                await manager.fetchOrders({
                    isFetchAll: false,
                });
                await manager.fetchTickets({
                    isFetchAll: false,
                });
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

        async fetch(data: LimitedFilteredRequest) {
            console.log('Orders(IndexedDb).fetch', data);
            const arrayBuffer: PrivateOrderWithTickets[] = [];
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
            const filter = mergeFilters(filters, '$and');

            if (sortItem.key === 'id' && data.sort.length > 1) {
                // We don't support this
                throw new Error('Sorting first by id and other keys is not supported');
            }

            console.log('Orders(IndexedDb).fetch', 'streamOrders, filter', filter, 'sortItem', sortItem, 'limit', data.limit);

            await manager.streamOrders({
                callback: (order) => {
                    arrayBuffer.push(
                        PrivateOrderWithTickets.create(order),
                    );
                },
                filter,
                limit: data.limit,
                sortItem,
            });

            console.log('Orders(IndexedDb).fetch', 'addTickets');
            await addTickets(manager, arrayBuffer);

            const lastItem = arrayBuffer[arrayBuffer.length - 1];
            let next: LimitedFilteredRequest | undefined = undefined;

            if (lastItem && arrayBuffer.length >= data.limit) {
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

            console.log('[Done] Orders(IndexedDb).fetch', { results: arrayBuffer, next });

            if (!data.pageFilter && arrayBuffer.length === 0 && this.isOffline) {
                // First page load failed
                throw new SimpleError({
                    code: 'network_error',
                    message: 'No internet connection',
                });
            }

            return { results: arrayBuffer, next };
        },
        async fetchCount(data: CountFilteredRequest): Promise<number> {
            console.log('Orders(IndexedDb).fetchCount', data);
            let count = 0;

            const filters = [data.filter];

            const searchFilter = searchToFilter(data.search);
            if (searchFilter !== null) {
                filters.push(searchFilter);
            }

            const filter = mergeFilters(filters, '$and');

            await this.loadFromInternet();

            await manager.streamOrders({
                callback: () => {
                    count++;
                },
                filter,
            });
            console.log('[Done] Orders(IndexedDb).fetchCount', data, count);

            return count;
        },
        ...overrides,
    };

    return objectFetcher;
}

async function addTickets(manager: WebshopManager, arrayBuffer: PrivateOrderWithTickets[]): Promise<void> {
    const ticketBuffer: TicketPrivate[] = [];

    await manager.streamTickets((ticket) => {
        ticketBuffer.push(ticket);
    }, false);

    await manager.streamTicketPatches((patch) => {
        const ticket = ticketBuffer.find(o => o.id === patch.id);
        if (ticket) {
            ticket.deepSet(ticket.patch(patch));
        }
    });

    for (const ticket of ticketBuffer) {
        const order = arrayBuffer.find(o => o.id === ticket.orderId);
        if (order) {
            order.tickets.push(ticket);
        }
        else {
            console.warn('Couldn\'t find order for ticket', ticket);
        }
    }
}
