import { ObjectFetcher } from '@stamhoofd/components';
import { assertSort, CountFilteredRequest, getSortFilter, LimitedFilteredRequest, PrivateOrder, PrivateOrderWithTickets, SortItem, SortList, TicketPrivate } from '@stamhoofd/structures';
import { WebshopManager } from '../WebshopManager';
import { OrderStoreDataIndex, OrderStoreGeneratedIndex, OrderStoreIndex, orderStoreIndexValueDefinitions, PrivateOrderEncodeableIndexes } from '../getPrivateOrderIndexes';

type ObjectType = PrivateOrderWithTickets;

function extendSort(list: SortList): SortList {
    // todo: add createdAt?
    return assertSort(list, [{ key: 'id' }]);
}

export function useOrdersObjectFetcher(manager: WebshopManager, overrides?: Partial<ObjectFetcher<ObjectType>>): ObjectFetcher<ObjectType> {
    const availableIndexes: OrderStoreIndex[] = (Object.values(OrderStoreDataIndex) as OrderStoreIndex[])
        .concat(Object.values(OrderStoreGeneratedIndex));

    return {
        extendSort,
        async fetch(data: LimitedFilteredRequest) {
            const arrayBuffer: PrivateOrderWithTickets[] = [];

            const filters = [data.filter, data.search];
            if (data.pageFilter) {
                filters.unshift(data.pageFilter);
            }

            const sortItems = (data.sort as (SortItem & { key: OrderStoreIndex })[]).filter((item) => {
                const key = item.key;
                // skip id
                if ((key as string) === 'id') {
                    // https://www.w3.org/TR/IndexedDB-2/#sorted-list-order
                    // The records in an index are always sorted according to the record's key. However unlike object stores, a given index can contain multiple records with the same key. Such records are additionally sorted according to the index's record's value (meaning the key of the record in the referenced object store).
                    return false;
                }
                const doesIndexExist = availableIndexes.includes(key);
                if (!doesIndexExist) {
                    console.error(`Index ${key} for IndexedDb order store is not supported.`);
                }
                return doesIndexExist;
            });

            if (sortItems.length > 1) {
                console.error('Only 1 sort item is supported for the IndexedDb order store');
            }

            const sortItem: (SortItem & { key: OrderStoreIndex }) | undefined = sortItems[0];
            let lastItem: { value: PrivateOrder; indexes: PrivateOrderEncodeableIndexes } | undefined = undefined;

            await manager.streamOrders({
                callback: (data) => {
                    arrayBuffer.push(
                        PrivateOrderWithTickets.create(data.value),
                    );
                    lastItem = data;
                },
                filters,
                limit: data.limit,
                sortItem,
            }).catch(console.error);

            await addTickets(manager, arrayBuffer);

            let next: LimitedFilteredRequest | undefined = undefined;

            if (lastItem) {
                const sortList: SortItem[] = [...sortItems];
                if (sortList.length > 0 && !sortList.some(item => item.key === 'id')) {
                    const order = sortList[0].order;
                    sortList.push({ key: 'id', order });
                }

                const pageFilter = getSortFilter(lastItem, orderStoreIndexValueDefinitions, sortList);

                next = new LimitedFilteredRequest({
                    filter: data.filter,
                    sort: data.sort,
                    limit: data.limit,
                    pageFilter,
                });
            }

            return { results: arrayBuffer, next };
        },
        async fetchCount(data: CountFilteredRequest): Promise<number> {
            let count = 0;

            const filters = [data.filter, data.search];

            await manager.streamOrders({
                callback: () => {
                    count++;
                },
                filters,
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
