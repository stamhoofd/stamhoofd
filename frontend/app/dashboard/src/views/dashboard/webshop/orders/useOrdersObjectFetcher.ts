import { ObjectFetcher } from '@stamhoofd/components';
import { assertSort, CountFilteredRequest, getOrderSearchFilter, getSortFilter, LimitedFilteredRequest, mergeFilters, PrivateOrderWithTickets, SortItem, SortItemDirection, SortList, StamhoofdFilter, TicketPrivate } from '@stamhoofd/structures';
import { parsePhoneNumber } from 'libphonenumber-js';
import { WebshopManager } from '../WebshopManager';
import { OrderStoreDataIndex, OrderStoreGeneratedIndex, OrderStoreIndex, orderStoreIndexValueDefinitions } from '../getPrivateOrderIndexes';

type ObjectType = PrivateOrderWithTickets;

function extendSort(list: SortList): SortList {
    // Id should always be sorted by ASC if not the only one in the list (because other indexes first sort by own key, then by id ASC)
    return assertSort(list, [{ key: 'id', order: SortItemDirection.ASC }]);
}

function searchToFilter(search: string | null): StamhoofdFilter | null {
    return getOrderSearchFilter(search, parsePhoneNumber);
}

export function useOrdersObjectFetcher(manager: WebshopManager, overrides?: Partial<ObjectFetcher<ObjectType>>): ObjectFetcher<ObjectType> {
    const availableIndexes: OrderStoreIndex[] = (Object.values(OrderStoreDataIndex) as OrderStoreIndex[])
        .concat(Object.values(OrderStoreGeneratedIndex));

    return {
        extendSort,
        async fetch(data: LimitedFilteredRequest) {
            const arrayBuffer: PrivateOrderWithTickets[] = [];

            const filters = [data.filter];

            const searchFilter = searchToFilter(data.search);
            if (searchFilter !== null) {
                filters.push(searchFilter);
            }

            if (data.pageFilter) {
                filters.unshift(data.pageFilter);
            }

            for (const item of data.sort) {
                const key = item.key;
                const doesIndexExist = key === 'id' || availableIndexes.includes(key as OrderStoreIndex);
                if (!doesIndexExist) {
                    console.error(`Index ${key} for IndexedDb order store is not supported.`);
                    throw new Error(`Index ${key} for IndexedDb order store is not supported.`);
                }
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

            const sortItem = data.sort[0] as (SortItem & { key: OrderStoreIndex | 'id' });
            const filter = mergeFilters(filters, '$and');

            if (sortItem.key === 'id' && data.sort.length > 1) {
                // We don't support this
                throw new Error('Sorting first by id and other keys is not supported');
            }

            await manager.streamOrders({
                callback: (order) => {
                    arrayBuffer.push(
                        PrivateOrderWithTickets.create(order),
                    );
                },
                filter,
                limit: data.limit,
                sortItem,
            }).catch(console.error);

            await addTickets(manager, arrayBuffer);

            const lastItem = arrayBuffer[arrayBuffer.length - 1];
            let next: LimitedFilteredRequest | undefined = undefined;

            if (lastItem && arrayBuffer.length >= data.limit) {
                const pageFilter = getSortFilter(lastItem, orderStoreIndexValueDefinitions, data.sort);

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

            return { results: arrayBuffer, next };
        },
        async fetchCount(data: CountFilteredRequest): Promise<number> {
            let count = 0;

            const filters = [data.filter];

            const searchFilter = searchToFilter(data.search);
            if (searchFilter !== null) {
                filters.push(searchFilter);
            }

            const filter = mergeFilters(filters, '$and');

            await manager.streamOrders({
                callback: () => {
                    count++;
                },
                filter,
            });

            return count;
        },
        ...overrides,
    };
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
