import { AutoEncoder, field, NumberDecoder, StringDecoder } from '@simonbackx/simple-encoding';
import type { InMemoryFilterDefinitions, PrivateOrder, SortDefinitions } from '@stamhoofd/structures';
import { baseInMemoryFilterCompilers, createInMemoryFilterCompiler } from '@stamhoofd/structures';
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
