import { AutoEncoder, field, NumberDecoder, StringDecoder } from '@simonbackx/simple-encoding';
import { PrivateOrder, SortDefinitions } from '@stamhoofd/structures';
import { IndexBox, IndexedDbIndexValue } from './IndexBox';

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
