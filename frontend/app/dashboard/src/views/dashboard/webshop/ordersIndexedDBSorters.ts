import { AutoEncoder, field, NumberDecoder, StringDecoder } from '@simonbackx/simple-encoding';
import { InMemorySortDefinitions, PrivateOrder } from '@stamhoofd/structures';
import { Sorter } from '@stamhoofd/utility';
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

class SortDefinition<T, R> {
    readonly getValue: (value: T) => R;
    readonly sort: (a: T, b: T) => number;

    constructor({ getValue, sort }: {
        getValue: (value: T) => R;
        sort: (a: R, b: R) => number;
    }) {
        this.getValue = getValue;
        this.sort = (a: T, b: T) => {
            const valueA: R = getValue(a);
            const valueB: R = getValue(b);
            return sort(valueA, valueB);
        };
    }
}

/**
 * Don't forget to add the required in memory filters.
 */
export const ordersIndexedDBSorters: InMemorySortDefinitions<PrivateOrder> = {
    id: new SortDefinition({
        getValue: value => value.id,
        sort: Sorter.byStringValue,
    }),
    [OrderIndexedDBIndex.CreatedAt]: new SortDefinition({
        getValue: value => value.createdAt.getTime(),
        sort: Sorter.byNumberValue,

    }),
    [OrderIndexedDBIndex.Number]: new SortDefinition({
        getValue: value => value.number ?? 0,
        sort: Sorter.byNumberValue,
    }),
    [OrderIndexedDBIndex.Status]: new SortDefinition({
        getValue: value => value.status,
        sort: Sorter.byStringValue,
    }),
    [OrderIndexedDBIndex.PaymentMethod]: new SortDefinition({
        getValue: value => value.data.paymentMethod,
        sort: Sorter.byStringValue,
    }),
    [OrderIndexedDBIndex.CheckoutMethod]: new SortDefinition({
        getValue: value => value.data.checkoutMethod?.type ?? '',
        sort: Sorter.byStringValue,
    }),
    [OrderIndexedDBIndex.TimeSlotDate]: new SortDefinition({
        getValue: value => value.data.timeSlot?.date.getTime() ?? 0,
        sort: Sorter.byNumberValue,
    }),
    [OrderIndexedDBIndex.ValidAt]: new SortDefinition({
        getValue: value => value.validAt?.getTime() ?? 0,
        sort: Sorter.byNumberValue,
    }),
    [OrderIndexedDBIndex.Name]: new SortDefinition({
        getValue: value => value.data.customer.name,
        sort: Sorter.byStringValue,
    }),
    [OrderIndexedDBIndex.Email]: new SortDefinition({
        getValue: value => value.data.customer.email,
        sort: Sorter.byStringValue,
    }),
    [OrderIndexedDBIndex.Phone]: new SortDefinition({
        getValue: value => value.data.customer.phone,
        sort: Sorter.byStringValue,
    }),

    // Generated (these are stored in the indexes)
    [OrderIndexedDBIndex.TotalPrice]: new SortDefinition({
        getValue: value => value.data.totalPrice,
        sort: Sorter.byNumberValue,
    }),
    [OrderIndexedDBIndex.Amount]: new SortDefinition({
        getValue: value => value.data.amount,
        sort: Sorter.byNumberValue,
    }),
    [OrderIndexedDBIndex.OpenBalance]: new SortDefinition({
        getValue: value => value.openBalance,
        sort: Sorter.byNumberValue,
    }),
    [OrderIndexedDBIndex.Location]: new SortDefinition({
        getValue: value => value.data.locationName,
        sort: Sorter.byStringValue,
    }),
    [OrderIndexedDBIndex.TimeSlotTime]: new SortDefinition({
        getValue: value => value.data.timeSlot?.timeIndex ?? '',
        sort: Sorter.byStringValue,
    }),
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
