import { ObjectFetcher } from '@stamhoofd/components';
import { assertSort, CountFilteredRequest, Country, getSortFilter, LimitedFilteredRequest, mergeFilters, PrivateOrderWithTickets, SortItem, SortList, StamhoofdFilter, TicketPrivate } from '@stamhoofd/structures';
import { DataValidator } from '@stamhoofd/utility';
import { parsePhoneNumber } from 'libphonenumber-js';
import { WebshopManager } from '../WebshopManager';
import { OrderStoreDataIndex, OrderStoreGeneratedIndex, OrderStoreIndex, orderStoreIndexValueDefinitions } from '../getPrivateOrderIndexes';

type ObjectType = PrivateOrderWithTickets;

function extendSort(list: SortList): SortList {
    // todo: add createdAt?
    return assertSort(list, [{ key: 'id' }]);
}

// todo: add to backend also?
function searchToFilter(search: string | null): StamhoofdFilter | null {
    if (search !== null && search !== undefined) {
        const parsedInt = Number.parseInt(search);

        if (!Number.isNaN(parsedInt) && !(search.length > 1 && search[0] === '0')) {
            return {
                [OrderStoreDataIndex.Number]: {
                    $eq: parsedInt,
                },
            };
        }

        if (search.includes('@')) {
            const isCompleteAddress = DataValidator.isEmailValid(search);
            return {
                [OrderStoreDataIndex.Email]: {
                    [(isCompleteAddress ? '$eq' : '$contains')]: search,
                },
            };
        }

        if (search.match(/^\+?[0-9\s-]+$/)) {
            try {
                // todo: how to determine country?
                const phoneNumber = parsePhoneNumber(search, Country.Belgium);

                if (phoneNumber && phoneNumber.isValid()) {
                    const formatted = phoneNumber.formatInternational();
                    return {
                        [OrderStoreDataIndex.Phone]: {
                            $eq: formatted,
                        },
                    };
                }
            }
            catch (e) {
                console.error('Failed to parse phone number', search, e);
            }
        }

        return {
            [OrderStoreDataIndex.Name]: {
                $contains: search,
            },
        };
    }

    return null;
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

            const filter = mergeFilters(filters, '$and');

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
                    search: data.search,
                    pageFilter,
                });
            }

            return { results: arrayBuffer, next };
        },
        async fetchCount(data: CountFilteredRequest): Promise<number> {
            let count = 0;

            const filter = mergeFilters([data.filter, data.search], '$and');

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
