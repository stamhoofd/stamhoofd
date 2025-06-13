import { AutoEncoder, field, NumberDecoder, StringDecoder } from '@simonbackx/simple-encoding';
import { PrivateOrder, SortDefinitions } from '@stamhoofd/structures';
import { IndexBox, IndexedDbIndexValue } from './IndexBox';

export enum OrderIndexedDBDataIndex {
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
};

export enum OrderIndexedDBGeneratedIndex {
    TotalPrice = 'totalPrice',
    Amount = 'amount',
    OpenBalance = 'openBalance',
    Location = 'location',
    TimeSlotTime = 'timeSlotTime',
}

export type OrderIndexedDBIndex = OrderIndexedDBDataIndex | OrderIndexedDBGeneratedIndex;

/**
 * Don't forget to add the required in memory filters.
 */
export const ordersIndexedDBSorters: SortDefinitions<PrivateOrder> = {
    id: {
        getValue: value => value.id,
    },
    [OrderIndexedDBDataIndex.CreatedAt]: {
        getValue: value => value.createdAt.getTime(),
    },
    [OrderIndexedDBDataIndex.Number]: {
        getValue: value => value.number,
    },
    [OrderIndexedDBDataIndex.Status]: {
        getValue: value => value.status,
    },
    [OrderIndexedDBDataIndex.PaymentMethod]: {
        getValue: value => value.data.paymentMethod,
    },
    [OrderIndexedDBDataIndex.CheckoutMethod]: {
        getValue: value => value.data.checkoutMethod?.type,
    },
    [OrderIndexedDBDataIndex.TimeSlotDate]: {
        getValue: value => value.data.timeSlot?.date.getTime(),
    },
    [OrderIndexedDBDataIndex.ValidAt]: {
        getValue: value => value.validAt?.getTime(),
    },
    [OrderIndexedDBDataIndex.Name]: {
        getValue: value => value.data.customer.name,
    },
    [OrderIndexedDBDataIndex.Email]: {
        getValue: value => value.data.customer.email,
    },
    [OrderIndexedDBDataIndex.Phone]: {
        getValue: value => value.data.customer.phone,
    },

    // Generated (these are stored in the indexes)
    [OrderIndexedDBGeneratedIndex.TotalPrice]: {
        getValue: value => value.data.totalPrice,
    },
    [OrderIndexedDBGeneratedIndex.Amount]: {
        getValue: value => value.data.amount,
    },
    [OrderIndexedDBGeneratedIndex.OpenBalance]: {
        getValue: value => value.openBalance,
    },
    [OrderIndexedDBGeneratedIndex.Location]: {
        getValue: value => value.data.locationName,
    },
    [OrderIndexedDBGeneratedIndex.TimeSlotTime]: {
        getValue: value => value.data.timeSlot?.timeIndex,
    },
};

/**
 * Wraps a PrivateOrder in an IndexBox - which will save extra indexes in encoded form only.
 * IndexedDB uses these generated indexes for efficient sorting.
 */
export function createPrivateOrderIndexBox(data: PrivateOrder) {
    return new IndexBox({ data, getIndexes: getPrivateOrderIndexes });
};

export class PrivateOrderEncodeableIndexes extends AutoEncoder implements Record<OrderIndexedDBGeneratedIndex, IndexedDbIndexValue> {
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
            Object.values(OrderIndexedDBGeneratedIndex).map((generatedIndex) => {
                const getIndex = ordersIndexedDBSorters[generatedIndex].getValue;
                return [generatedIndex, getIndex(order)];
            }),
        ),
    );
};
