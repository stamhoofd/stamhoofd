import { AutoEncoder, field, NumberDecoder, StringDecoder } from '@simonbackx/simple-encoding';
import type { InMemoryFilterDefinitions, PrivateOrder, SortDefinitions, SortItem, StamhoofdFilter } from '@stamhoofd/structures';
import { baseInMemoryFilterCompilers, createInMemoryFilterCompiler, SortItemDirection } from '@stamhoofd/structures';
import type { IndexedDbIndexValue } from './IndexBox';
import { IndexBox } from './IndexBox';

export enum OrderIndexedDBIndex {
    Number = 'number',
    CreatedAt = 'createdAt',
    Status = 'status',
    PaymentMethod = 'paymentMethod',
    CheckoutMethod = 'checkoutMethod',
    TimeSlotDate = 'timeSlotDate',
    ValidAt = 'validAt',
    Name = 'name',
    Email = 'email',
    Phone = 'phone',
    TotalPrice = 'totalPrice',
    Amount = 'amount',
    OpenBalance = 'openBalance',
    Location = 'location',
    TimeSlotTime = 'timeSlotTime',
}

/**
 * Don't forget to add the required in memory filters.
 */
export const ordersIndexedDBSorters: SortDefinitions<PrivateOrder> = {
    id: {
        getValue: value => value.id,
    },
    [OrderIndexedDBIndex.CreatedAt]: {
        getValue: value => value.createdAt.getTime(),
    },
    [OrderIndexedDBIndex.Number]: {
        getValue: value => value.number,
    },
    [OrderIndexedDBIndex.Status]: {
        getValue: value => value.status,
    },
    [OrderIndexedDBIndex.PaymentMethod]: {
        getValue: value => value.data.paymentMethod,
    },
    [OrderIndexedDBIndex.CheckoutMethod]: {
        getValue: value => value.data.checkoutMethod?.type,
    },
    [OrderIndexedDBIndex.TimeSlotDate]: {
        getValue: value => value.data.timeSlot?.date.getTime(),
    },
    [OrderIndexedDBIndex.ValidAt]: {
        getValue: value => value.validAt?.getTime(),
    },
    [OrderIndexedDBIndex.Name]: {
        getValue: value => value.data.customer.name,
    },
    [OrderIndexedDBIndex.Email]: {
        getValue: value => value.data.customer.email,
    },
    [OrderIndexedDBIndex.Phone]: {
        getValue: value => value.data.customer.phone,
    },

    // Generated (these are stored in the indexes)
    [OrderIndexedDBIndex.TotalPrice]: {
        getValue: value => value.data.totalPrice,
    },
    [OrderIndexedDBIndex.Amount]: {
        getValue: value => value.data.amount,
    },
    [OrderIndexedDBIndex.OpenBalance]: {
        getValue: value => value.openBalance,
    },
    [OrderIndexedDBIndex.Location]: {
        getValue: value => value.data.locationName,
    },
    [OrderIndexedDBIndex.TimeSlotTime]: {
        getValue: value => value.data.timeSlot?.timeIndex,
    },
};

/**
 * Compilers for filtering on the index values that are stored alongside each order (IndexBox.indexes),
 * instead of on a decoded order.
 *
 * The stored values are lowercased copies of the values the equally named sorter reads from an order.
 * Every in-memory comparison lowercases both of its sides, so filtering an index key matches the same
 * orders as filtering the same key on a decoded order - without paying for the decode.
 *
 * Only the keys in OrderIndexedDBIndex exist here: anything else (items, payments, recordAnswers, the
 * ticket keys, ...) has to be filtered on a decoded order.
 */
export const orderIndexesInMemoryFilterCompilers: InMemoryFilterDefinitions = {
    ...baseInMemoryFilterCompilers,
    ...Object.fromEntries(
        Object.values(OrderIndexedDBIndex).map(index => [index, createInMemoryFilterCompiler(index)]),
    ),
};

export type OrderIndexLookup = { index: OrderIndexedDBIndex; key: number | string };

const exactLookupIndexes: OrderIndexedDBIndex[] = [OrderIndexedDBIndex.Number, OrderIndexedDBIndex.Email, OrderIndexedDBIndex.Phone];

/**
 * Returns the index key to look up if the filter only matches orders with one exact value for an index,
 * so a cursor on that index can visit just those orders instead of every order.
 */
export function getExactIndexLookup(filter: StamhoofdFilter | null): OrderIndexLookup | null {
    if (filter === null || typeof filter !== 'object' || Array.isArray(filter)) {
        return null;
    }

    const entries = Object.entries(filter as Record<string, unknown>);
    if (entries.length !== 1) {
        return null;
    }

    const [index, condition] = entries[0];
    if (!exactLookupIndexes.includes(index as OrderIndexedDBIndex) || condition === null || typeof condition !== 'object') {
        return null;
    }

    const conditionEntries = Object.entries(condition as Record<string, unknown>);
    if (conditionEntries.length !== 1 || conditionEntries[0][0] !== '$eq') {
        return null;
    }

    const value = conditionEntries[0][1];
    if (typeof value === 'number') {
        return { index: index as OrderIndexedDBIndex, key: value };
    }
    if (typeof value === 'string') {
        // Same lowercasing as the stored index values
        return { index: index as OrderIndexedDBIndex, key: value.toLocaleLowerCase() };
    }
    return null;
}

/**
 * Sorts orders in the order a cursor on the sortItem index returns them: by stored index value, then by id.
 * Like that cursor, it leaves out orders without a value for the index (e.g. a null number).
 */
export function sortOrdersLikeIndex<O extends PrivateOrder>(orders: O[], sortItem: SortItem & { key: OrderIndexedDBIndex | 'id' }): O[] {
    const withKeys: { order: O; key: IDBValidKey }[] = [];
    for (const order of orders) {
        if (sortItem.key === 'id') {
            withKeys.push({ order, key: order.id });
            continue;
        }
        const value: unknown = getPrivateOrderIndexes(order)[sortItem.key];
        if (value === null || value === undefined || (typeof value === 'number' && Number.isNaN(value))) {
            continue;
        }
        withKeys.push({ order, key: [value as IDBValidKey, order.id] });
    }

    const direction = sortItem.order === SortItemDirection.DESC ? -1 : 1;
    withKeys.sort((a, b) => direction * indexedDB.cmp(a.key, b.key));
    return withKeys.map(o => o.order);
}

/**
 * Wraps a PrivateOrder in an IndexBox - which will save extra indexes in encoded form only.
 * IndexedDB uses these generated indexes for efficient sorting.
 */
export function createPrivateOrderIndexBox(data: PrivateOrder) {
    return new IndexBox({ data, getIndexes: getPrivateOrderIndexes });
};

export class PrivateOrderEncodeableIndexes extends AutoEncoder implements Record<OrderIndexedDBIndex, IndexedDbIndexValue> {
    @field({ decoder: NumberDecoder })
    createdAt: number = 0;

    @field({ decoder: NumberDecoder })
    number: number = 0;

    @field({ decoder: StringDecoder })
    status: string = '';

    @field({ decoder: StringDecoder })
    paymentMethod: string = '';

    @field({ decoder: StringDecoder })
    checkoutMethod: string = '';

    @field({ decoder: NumberDecoder })
    timeSlotDate: number = 0;

    @field({ decoder: NumberDecoder })
    validAt: number = 0;

    @field({ decoder: StringDecoder })
    name: string = '';

    @field({ decoder: StringDecoder })
    email: string = '';

    @field({ decoder: StringDecoder })
    phone: string = '';

    @field({ decoder: NumberDecoder })
    totalPrice: number = 0;

    @field({ decoder: NumberDecoder })
    amount: number = 0;

    @field({ decoder: NumberDecoder })
    openBalance: number = 0;

    @field({ decoder: StringDecoder })
    location: string = '';

    @field({ decoder: StringDecoder })
    timeSlotTime: string = '';
}

function getPrivateOrderIndexes(order: PrivateOrder): PrivateOrderEncodeableIndexes {
    return PrivateOrderEncodeableIndexes.create(
        Object.fromEntries(
            Object.values(OrderIndexedDBIndex).map((generatedIndex) => {
                const getIndex = ordersIndexedDBSorters[generatedIndex].getValue;
                let index = getIndex(order);

                if (typeof index === 'string') {
                    index = index.toLocaleLowerCase();
                }

                return [generatedIndex, index];
            }),
        ),
    );
};
