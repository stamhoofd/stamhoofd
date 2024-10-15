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

// todo: maybe move
export function useOrdersObjectFetcher(manager: WebshopManager, { onUpdatedOrders, overrides }: {
    onUpdatedOrders?: () => boolean | void;
    overrides?: Partial<ObjectFetcher<ObjectType>>;
} = {}): ObjectFetcher<ObjectType> {
    let startedFetchOrders = false;

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

            const streamOrdersPromise = manager.streamOrders({
                callback: (order: PrivateOrder) => {
                    arrayBuffer.push(
                        PrivateOrderWithTickets.create(order),
                    );
                },
                filters,
                limit: data.limit,
                sortItem,
            });

            let fetchOrdersPromise: Promise<boolean> | null = null;

            if (!startedFetchOrders) {
                // fetch orders from backend on first fetch
                fetchOrdersPromise = manager.fetchOrders2();
            }

            let shouldAddTickets = true;

            if (startedFetchOrders === false) {
                startedFetchOrders = true;

                if (fetchOrdersPromise && onUpdatedOrders) {
                    fetchOrdersPromise.then((hadUpdatedOrders) => {
                        if (hadUpdatedOrders) {
                            const shouldAddTicketsOrVoid = onUpdatedOrders();
                            // prevent fetching tickets if not necessary (for example because orders is refreshed)
                            if (shouldAddTicketsOrVoid === false) {
                                shouldAddTickets = false;
                            }
                        }
                    }).catch(console.error);
                }
            }

            await streamOrdersPromise;

            if (shouldAddTickets) {
                await addTickets(manager, arrayBuffer);
            }

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
        beforeRefresh: () => {
            startedFetchOrders = false;
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
