import type { PrivateOrder, SortDefinitions } from '@stamhoofd/structures';
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
export const ordersIndexedDBSorters: SortDefinitions<PrivateOrder> & Record<'id' | OrderIndexedDBIndex, { getValue: (value: PrivateOrder) => string | number }> = {
    id: {
        getValue: value => value.id,
    },
    [OrderIndexedDBIndex.CreatedAt]: {
        getValue: value => value.createdAt.getTime(),
    },
    [OrderIndexedDBIndex.Number]: {
        getValue: value => value.number ?? 0,
    },
    [OrderIndexedDBIndex.Status]: {
        getValue: value => value.status,
    },
    [OrderIndexedDBIndex.PaymentMethod]: {
        getValue: value => value.data.paymentMethod,
    },
    [OrderIndexedDBIndex.CheckoutMethod]: {
        getValue: value => value.data.checkoutMethod?.type ?? '',
    },
    [OrderIndexedDBIndex.TimeSlotDate]: {
        getValue: value => value.data.timeSlot?.date.getTime() ?? '',
    },
    [OrderIndexedDBIndex.ValidAt]: {
        getValue: value => value.validAt?.getTime() ?? '',
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
        getValue: value => value.data.timeSlot?.timeIndex ?? '',
    },
};

/**
 * Wraps a PrivateOrder in an IndexBox - which will save extra indexes in encoded form only.
 * IndexedDB uses these generated indexes for efficient sorting.
 */
export function createPrivateOrderIndexBox(data: PrivateOrder) {
    return new IndexBox({ data, getIndexes: getPrivateOrderIndexes });
};

function getPrivateOrderIndexes(order: PrivateOrder): Record<string, string | number> {
    return Object.fromEntries(Object.values(OrderIndexedDBIndex).map((generatedIndex) => {
        const getIndex = ordersIndexedDBSorters[generatedIndex].getValue;
        let index = getIndex(order);

        if (typeof index === 'string') {
            index = index.toLocaleLowerCase();
        }

        return [generatedIndex, index];
    }));
};
