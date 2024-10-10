import { ObjectFetcher } from '@stamhoofd/components';
import { assertSort, CountFilteredRequest, LimitedFilteredRequest, PrivateOrder, PrivateOrderWithTickets, SortList, TicketPrivate } from '@stamhoofd/structures';
import { WebshopManager } from '../WebshopManager';

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
    // let count: number | null = null;

    return {
        extendSort,
        async fetch(data: LimitedFilteredRequest) {
            const arrayBuffer: PrivateOrderWithTickets[] = [];

            // data = {
            //     ...data,
            //     filter: {
            //         number: 12,
            //     },
            // };

            // data.filter = {
            //     '#': 12,
            // };

            const streamOrdersPromise = manager.streamOrders((order: PrivateOrder) => {
                // todo: filter
                // todo: sort
                if (order.doesMatchFilter(data.filter) && order.doesMatchFilter(data.search)) {
                    arrayBuffer.push(
                        PrivateOrderWithTickets.create(order),
                    );
                }
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
            count = arrayBuffer.length;

            if (shouldAddTickets) {
                await addTickets(manager, arrayBuffer);
            }

            return { results: arrayBuffer };
        },

        async fetchCount(data: CountFilteredRequest): Promise<number> {
            // todo: should filter the results, but best to only stream orders once?
            return await manager.getOrdersCountFromDatabase();
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
