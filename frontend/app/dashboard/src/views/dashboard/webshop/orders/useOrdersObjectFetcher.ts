import { ObjectFetcher } from '@stamhoofd/components';
import { assertSort, CountFilteredRequest, LimitedFilteredRequest, PrivateOrder, PrivateOrderWithTickets, SortItem, SortList, TicketPrivate } from '@stamhoofd/structures';
import { OrderStoreIndexedDbIndex, WebshopManager } from '../WebshopManager';

type ObjectType = PrivateOrderWithTickets;

function extendSort(list: SortList): SortList {
    // todo: add createdAt?
    return assertSort(list, [{ key: 'id' }]);
}

// todo: maybe move
export function useOrdersObjectFetcher(manager: WebshopManager, { onUpdatedOrders, overrides }: {
    onUpdatedOrders?: () => boolean | void;
    overrides?: Partial<ObjectFetcher<ObjectType>>;
} = {}): ObjectFetcher<ObjectType> {
    let startedFetchOrders = false;

    return {
        extendSort,
        async fetch(data: LimitedFilteredRequest) {
            console.error(JSON.stringify(data.sort));
            const arrayBuffer: PrivateOrderWithTickets[] = [];

            const compiledFilters = [data.filter, data.search].map(filter => PrivateOrder.createCompiledFilter(filter));

            const availableIndexes = Object.values(OrderStoreIndexedDbIndex);
            const sortItems = (data.sort as (SortItem & { key: OrderStoreIndexedDbIndex })[]).filter((item) => {
                const key = item.key;
                // skip id
                if ((key as string) === 'id') {
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

            const streamOrdersPromise = manager.streamOrders((order: PrivateOrder) => {
                if (compiledFilters.every(filter => filter(order))) {
                    arrayBuffer.push(
                        PrivateOrderWithTickets.create(order),
                    );
                }
            }, sortItem);

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

            return { results: arrayBuffer };
        },

        async fetchCount(data: CountFilteredRequest): Promise<number> {
            let count = 0;

            const compiledFilters = [data.filter, data.search].map(filter => PrivateOrder.createCompiledFilter(filter));

            await manager.streamOrders((order: PrivateOrder) => {
                if (compiledFilters.every(filter => filter(order))) {
                    count++;
                }
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
