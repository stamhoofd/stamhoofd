import { AutoEncoder, Decoder, field, NumberDecoder, StringDecoder } from '@simonbackx/simple-encoding';
import { baseInMemoryFilterCompilers, compileToInMemoryFilter, createInMemoryFilterCompiler, InMemoryFilterCompiler, InMemoryFilterDefinitions, PrivateOrder, SortDefinitions, StamhoofdFilter } from '@stamhoofd/structures';
import { GetIndexes, IndexBox, IndexBoxDecoder, IndexedDbIndexValue } from './IndexBox';

export enum OrderStoreDataIndex {
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

export enum OrderStoreGeneratedIndex {
    TotalPrice = 'totalPrice',
    Amount = 'amount',
    OpenBalance = 'openBalance',
    Location = 'location',
    TimeSlotTime = 'timeSlotTime',
}

export type OrderStoreIndex = OrderStoreDataIndex | OrderStoreGeneratedIndex;

export class PrivateOrderEncodeableIndexes extends AutoEncoder implements Record<OrderStoreGeneratedIndex, IndexedDbIndexValue> {
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

export const orderStoreIndexValueDefinitions: SortDefinitions<PrivateOrder> & Record<OrderStoreIndex, { getValue: (data: PrivateOrder) => IndexedDbIndexValue }> = {
    id: {
        getValue: value => value.id,
    },
    webshopId: {
        getValue: value => value.webshopId,
    },
    [OrderStoreDataIndex.CreatedAt]: {
        getValue: value => value.createdAt.getTime(),
    },
    [OrderStoreDataIndex.Number]: {
        getValue: value => value.number,
    },
    [OrderStoreDataIndex.Status]: {
        getValue: value => value.status,
    },
    [OrderStoreDataIndex.PaymentMethod]: {
        getValue: value => value.data.paymentMethod,
    },
    [OrderStoreDataIndex.CheckoutMethod]: {
        getValue: value => value.data.checkoutMethod?.type,
    },
    [OrderStoreDataIndex.TimeSlotDate]: {
        getValue: value => value.data.timeSlot?.date.getTime(),
    },
    [OrderStoreDataIndex.ValidAt]: {
        getValue: value => value.validAt?.getTime(),
    },
    [OrderStoreDataIndex.Name]: {
        getValue: value => value.data.customer.name,
    },
    [OrderStoreDataIndex.Email]: {
        getValue: value => value.data.customer.email,
    },
    [OrderStoreDataIndex.Phone]: {
        getValue: value => value.data.customer.phone,
    },
    // generated
    [OrderStoreGeneratedIndex.TotalPrice]: {
        getValue: value => value.data.totalPrice,
    },
    [OrderStoreGeneratedIndex.Amount]: {
        getValue: value => value.data.amount,
    },
    [OrderStoreGeneratedIndex.OpenBalance]: {
        getValue: value => value.openBalance,
    },
    [OrderStoreGeneratedIndex.Location]: {
        getValue: value => value.data.locationName,
    },
    [OrderStoreGeneratedIndex.TimeSlotTime]: {
        getValue: value => value.data.timeSlot?.timeIndex,
    },
};

export const createPrivateOrderIndexBox = (data: PrivateOrder) => {
    return new IndexBox({ data, getIndexes: getPrivateOrderIndexes });
};

export const getPrivateOrderIndexes: GetIndexes<PrivateOrder, PrivateOrderEncodeableIndexes> = (order) => {
    return PrivateOrderEncodeableIndexes.create(
        Object.fromEntries(Object.values(OrderStoreGeneratedIndex).map((generatedIndex) => {
            const getIndex = orderStoreIndexValueDefinitions[generatedIndex].getValue;
            return [generatedIndex, getIndex(order)];
        })),
    );
};

export const createPrivateOrderIndexBoxDecoder = () => new IndexBoxDecoder(
    PrivateOrder as Decoder<PrivateOrder>,
);

// todo: move to shared
export const privateOrderIndexBoxInMemoryFilterCompilers: InMemoryFilterDefinitions & Record<OrderStoreIndex, InMemoryFilterCompiler> = {
    ...baseInMemoryFilterCompilers,
    id: createInMemoryFilterCompiler('id'),
    timeSlotEndTime: createInMemoryFilterCompiler('data.timeSlot.endTime'),
    timeSlotStartTime: createInMemoryFilterCompiler('data.timeSlot.startTime'),
    webshopId: createInMemoryFilterCompiler('webshopId'),
    [OrderStoreDataIndex.CreatedAt]: createInMemoryFilterCompiler('createdAt'),
    [OrderStoreDataIndex.Number]: createInMemoryFilterCompiler('number'),
    [OrderStoreDataIndex.Status]: createInMemoryFilterCompiler('status'),
    [OrderStoreDataIndex.PaymentMethod]: createInMemoryFilterCompiler('data.paymentMethod'),
    [OrderStoreDataIndex.CheckoutMethod]: createInMemoryFilterCompiler('data.checkoutMethod.type'),
    [OrderStoreDataIndex.TimeSlotDate]: createInMemoryFilterCompiler('data.timeSlot.date'),
    [OrderStoreDataIndex.ValidAt]: createInMemoryFilterCompiler('validAt'),
    [OrderStoreDataIndex.Name]: createInMemoryFilterCompiler('data.customer.name'),
    [OrderStoreDataIndex.Email]: createInMemoryFilterCompiler('data.customer.email'),
    [OrderStoreDataIndex.Phone]: createInMemoryFilterCompiler('data.customer.phone'),

    // generated
    [OrderStoreGeneratedIndex.TotalPrice]: createInMemoryFilterCompiler('data.totalPrice'),
    [OrderStoreGeneratedIndex.Amount]: createInMemoryFilterCompiler('data.amount'),
    [OrderStoreGeneratedIndex.TimeSlotTime]: createInMemoryFilterCompiler('data.timeSlot.timeIndex'),

    // only frontend
    [OrderStoreGeneratedIndex.OpenBalance]: createInMemoryFilterCompiler('openBalance'),
    [OrderStoreGeneratedIndex.Location]: createInMemoryFilterCompiler('data.locationName'),
};

export function createCompiledFilterForPrivateOrderIndexBox(filter: StamhoofdFilter) {
    return compileToInMemoryFilter(filter, privateOrderIndexBoxInMemoryFilterCompilers);
}
