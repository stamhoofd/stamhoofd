import { AutoEncoder, field, NumberDecoder, StringDecoder } from '@simonbackx/simple-encoding';
import type { InMemoryFilterDefinitions } from '@stamhoofd/structures/filters/InMemoryFilter.js';
import type { SortDefinitions } from '@stamhoofd/structures/filters/Sorters.js';
import type { StamhoofdFilter } from '@stamhoofd/structures/filters/StamhoofdFilter.js';
import type { PrivateOrder } from '@stamhoofd/structures/webshops/Order.js';
import { baseInMemoryFilterCompilers, createInMemoryFilterCompiler } from '@stamhoofd/structures/filters/InMemoryFilter.js';
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

export type OrderIndexKey = OrderIndexedDBIndex | 'id';

/**
 * The keys whose stored index value is the lowercased value a filter on that key reads from a decoded order.
 * Every in-memory comparison lowercases both of its sides, so filtering these keys on the stored index values
 * matches the same orders as filtering them on decoded orders. A missing index value means the order has null there.
 *
 * Other indexes are left out: when an order has no value (e.g. no time slot), PrivateOrderEncodeableIndexes
 * stores its default (0 or '') instead of leaving the order out of the index.
 */
const filterableIndexKeys: OrderIndexKey[] = [
    'id',
    OrderIndexedDBIndex.Number,
    OrderIndexedDBIndex.CreatedAt,
    OrderIndexedDBIndex.Status,
    OrderIndexedDBIndex.PaymentMethod,
    OrderIndexedDBIndex.Name,
    OrderIndexedDBIndex.Email,
    OrderIndexedDBIndex.Phone,
    OrderIndexedDBIndex.TotalPrice,
    OrderIndexedDBIndex.Amount,
];

/**
 * Compilers for filtering on the index values stored alongside each order (IndexBox.indexes), plus its id.
 */
export const orderIndexesInMemoryFilterCompilers: InMemoryFilterDefinitions = {
    ...baseInMemoryFilterCompilers,
    ...Object.fromEntries(
        filterableIndexKeys.map(key => [key, createInMemoryFilterCompiler(key)]),
    ),
};

const logicalOperators = ['$and', '$or', '$not'];

/**
 * The filter split in parts that all have to match ($and), e.g. { a: 1, $and: [{ b: 2 }, { c: 3 }] } gives { a: 1 }, { b: 2 } and { c: 3 }.
 */
export function getFilterConjuncts(filter: StamhoofdFilter | null): StamhoofdFilter[] {
    if (filter === null) {
        return [];
    }
    if (Array.isArray(filter)) {
        return filter.flatMap(getFilterConjuncts);
    }
    if (typeof filter !== 'object') {
        return [filter];
    }

    const entries = Object.entries(filter);
    if (entries.length === 1 && entries[0][0] === '$and') {
        return getFilterConjuncts(entries[0][1] as StamhoofdFilter);
    }
    if (entries.length > 1) {
        return entries.flatMap(([key, value]) => getFilterConjuncts({ [key]: value } as StamhoofdFilter));
    }
    return [filter];
}

/**
 * The keys the filter reads, or null if it reads a key that cannot be filtered on the stored index values.
 */
export function getIndexKeysOfFilter(filter: StamhoofdFilter | null): Set<OrderIndexKey> | null {
    const keys = new Set<OrderIndexKey>();

    const collect = (f: StamhoofdFilter | null): boolean => {
        if (Array.isArray(f)) {
            return f.every(collect);
        }
        if (f === null || typeof f !== 'object') {
            return false;
        }
        return Object.entries(f).every(([key, value]) => {
            if (logicalOperators.includes(key)) {
                return collect(value as StamhoofdFilter);
            }
            if (!(filterableIndexKeys as string[]).includes(key)) {
                return false;
            }
            keys.add(key as OrderIndexKey);
            return true;
        });
    };

    return collect(filter) && keys.size > 0 ? keys : null;
}

/**
 * Splits off the parts of the filter that can be evaluated on the stored index values.
 *
 * @param alwaysMatching parts that every stored order matches, which can be left out of both
 * @returns indexFilter: an $and of those parts, which every order that matches the filter also matches
 * @returns coversFilter: true if the indexFilter matches exactly the same orders as the filter
 */
export function splitIndexFilter(filter: StamhoofdFilter | null, alwaysMatching: StamhoofdFilter | null): { indexFilter: StamhoofdFilter | null; coversFilter: boolean } {
    const ignored = new Set(getFilterConjuncts(alwaysMatching).map(c => JSON.stringify(c)));
    const indexConjuncts: StamhoofdFilter[] = [];
    let coversFilter = true;

    for (const conjunct of getFilterConjuncts(filter)) {
        if (ignored.has(JSON.stringify(conjunct))) {
            continue;
        }
        if (getIndexKeysOfFilter(conjunct)) {
            indexConjuncts.push(conjunct);
        } else {
            coversFilter = false;
        }
    }

    return {
        indexFilter: indexConjuncts.length === 0 ? null : (indexConjuncts.length === 1 ? indexConjuncts[0] : { $and: indexConjuncts }),
        coversFilter,
    };
}

export type OrderIndexLookup = { index: OrderIndexedDBIndex; key: number | string };

const exactLookupIndexes: OrderIndexedDBIndex[] = [OrderIndexedDBIndex.Number, OrderIndexedDBIndex.Email, OrderIndexedDBIndex.Phone];

/**
 * Returns the index key to look up if the filter only matches orders with one exact value for an index,
 * e.g. { email: { $eq: 'x@y.be' } }, so the index can return just those orders.
 */
export function getExactIndexLookup(filter: StamhoofdFilter | null): OrderIndexLookup | null {
    if (filter === null || typeof filter !== 'object' || Array.isArray(filter)) {
        return null;
    }

    const entries = Object.entries(filter);
    if (entries.length !== 1 || !(exactLookupIndexes as string[]).includes(entries[0][0])) {
        return null;
    }
    const [index, condition] = entries[0] as [OrderIndexedDBIndex, unknown];

    if (condition === null || typeof condition !== 'object') {
        return null;
    }

    const conditionEntries = Object.entries(condition as Record<string, unknown>);
    if (conditionEntries.length !== 1 || conditionEntries[0][0] !== '$eq') {
        return null;
    }

    const value = conditionEntries[0][1];
    if (typeof value === 'number') {
        return { index, key: value };
    }
    if (typeof value === 'string') {
        // Same lowercasing as the stored index values
        return { index, key: value.toLocaleLowerCase() };
    }
    return null;
}

/**
 * Whether IndexedDB stores the value as a key in an index. Orders without one are left out of that index.
 */
export function isIndexableValue(value: unknown): value is IDBValidKey {
    return value !== null && value !== undefined && !(typeof value === 'number' && Number.isNaN(value));
}

/**
 * The key of the order in the index of a sort key, or null if the order is not in that index.
 */
export function getOrderIndexKey(order: PrivateOrder, key: OrderIndexKey): IDBValidKey | null {
    const value: unknown = key === 'id' ? order.id : getPrivateOrderIndexes(order)[key];
    return isIndexableValue(value) ? value : null;
}

/**
 * Compares index keys like indexedDB.cmp, but much faster for the numbers and strings that the indexes contain.
 */
export function compareIndexKeys(a: IDBValidKey, b: IDBValidKey): number {
    const typeA = typeof a;
    if (typeA === typeof b && (typeA === 'string' || typeA === 'number')) {
        return a < b ? -1 : (a > b ? 1 : 0);
    }
    return indexedDB.cmp(a, b);
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

export function getPrivateOrderIndexes(order: PrivateOrder): PrivateOrderEncodeableIndexes {
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
