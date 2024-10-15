import { ObjectFetcher } from '@stamhoofd/components';
import { assertSort, CountFilteredRequest, getSortFilter, LimitedFilteredRequest, PrivateOrder, PrivateOrderWithTickets, SortDefinitions, SortItem, SortList, TicketPrivate } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { OrderStoreIndexedDbIndex, WebshopManager } from '../WebshopManager';

type ObjectType = PrivateOrderWithTickets;

function extendSort(list: SortList): SortList {
    // todo: add createdAt?
    return assertSort(list, [{ key: 'id' }]);
}

const orderSorters: SortDefinitions<PrivateOrderWithTickets> = {
    createdAt: {
        getValue(a) {
            return Formatter.dateTimeIso(a.createdAt);
        },
    },
    id: {
        getValue(a) {
            return a.id;
        },
    },
    number: {
        getValue(a) {
            return a.number;
        },
    },
    status: {
        getValue(a) {
            return a.status;
        },
    },
    paymentMethod: {
        getValue(a) {
            return a.data.paymentMethod;
        },
    },
    checkoutMethod: {
        getValue(a) {
            return a.data.checkoutMethod?.type;
        },
    },
};

export function useOrdersObjectFetcher(manager: WebshopManager, overrides?: Partial<ObjectFetcher<ObjectType>>): ObjectFetcher<ObjectType> {
    return {
        extendSort,
        async fetch(data: LimitedFilteredRequest) {
            const arrayBuffer: PrivateOrderWithTickets[] = [];

            const filters = [data.filter, data.search];
            if (data.pageFilter) {
                filters.unshift(data.pageFilter);
            }

            const availableIndexes = Object.values(OrderStoreIndexedDbIndex);
            const sortItems = (data.sort as (SortItem & { key: OrderStoreIndexedDbIndex })[]).filter((item) => {
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

            const sortItem: (SortItem & { key: OrderStoreIndexedDbIndex }) | undefined = sortItems[0];

            await manager.streamOrders({
                callback: (order: PrivateOrder) => {
                    arrayBuffer.push(
                        PrivateOrderWithTickets.create(order),
                    );
                },
                filters,
                limit: data.limit,
                sortItem,
            });

            await addTickets(manager, arrayBuffer);

            const lastObject = arrayBuffer[arrayBuffer.length - 1];

            let next: LimitedFilteredRequest | undefined = undefined;

            if (lastObject) {
                next = new LimitedFilteredRequest({
                    filter: data.filter,
                    sort: data.sort,
                    limit: data.limit,
                    pageFilter: getSortFilter(lastObject, orderSorters, data.sort),
                });
            }

            return { results: arrayBuffer, next };
        },
        async fetchCount(data: CountFilteredRequest): Promise<number> {
            let count = 0;

            const filters = [data.filter, data.search];

            await manager.streamOrders({
                callback: (_order: PrivateOrder) => {
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
