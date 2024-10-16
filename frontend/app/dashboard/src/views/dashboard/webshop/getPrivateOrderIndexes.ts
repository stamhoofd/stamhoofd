import { AutoEncoder, Decoder, field, NumberDecoder } from '@simonbackx/simple-encoding';
import { baseInMemoryFilterCompilers, compileToInMemoryFilter, createInMemoryFilterCompiler, InMemoryFilterCompiler, InMemoryFilterDefinitions, PrivateOrder, SortDefinitions, StamhoofdFilter } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { GetIndexes, IndexBox, IndexBoxDecoder, IndexedDbIndexValue } from './IndexBox';

export enum OrderStoreDataIndex {
    Number = 'number',
    CreatedAt = 'createdAt',
    Status = 'status',
    PaymentMethod = 'paymentMethod',
    CheckoutMethod = 'checkoutMethod',
    TimeSlotDate = 'timeSlotDate',
    TimeSlotTime = 'timeSlotTime',
    ValidAt = 'validAt',
    Name = 'name',
};

export enum OrderStoreGeneratedIndex {
    TotalPrice = 'totalPrice',
    Amount = 'amount',
}

export type OrderStoreIndex = OrderStoreDataIndex | OrderStoreGeneratedIndex;

export class PrivateOrderEncodeableIndexes extends AutoEncoder implements Record<OrderStoreGeneratedIndex, IndexedDbIndexValue> {
    @field({ decoder: NumberDecoder })
    totalPrice: number = 0;

    @field({ decoder: NumberDecoder })
    amount: number = 0;
}

export const orderStoreIndexValueDefinitions: SortDefinitions<PrivateOrder> & Record<OrderStoreIndex, { getValue: (data: PrivateOrder) => IndexedDbIndexValue }> = {
    id: {
        getValue: value => value.id,
    },
    [OrderStoreDataIndex.CreatedAt]: {
        getValue: value => Formatter.dateTimeIso(value.createdAt),
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
    [OrderStoreDataIndex.TimeSlotTime]: {
        getValue: value => value.data.timeSlot?.endTime,
    },
    [OrderStoreDataIndex.ValidAt]: {
        getValue: value => value.validAt?.getTime(),
    },
    [OrderStoreDataIndex.Name]: {
        getValue: value => value.data.customer.name,
    },
    [OrderStoreGeneratedIndex.TotalPrice]: {
        getValue: value => value.data.totalPrice,
    },
    [OrderStoreGeneratedIndex.Amount]: {
        getValue: value => value.data.amount,
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
    [OrderStoreDataIndex.CreatedAt]: createInMemoryFilterCompiler('createdAt'),
    [OrderStoreDataIndex.Number]: createInMemoryFilterCompiler('number'),
    [OrderStoreDataIndex.Status]: createInMemoryFilterCompiler('status'),
    [OrderStoreDataIndex.PaymentMethod]: createInMemoryFilterCompiler('data.paymentMethod'),
    [OrderStoreDataIndex.CheckoutMethod]: createInMemoryFilterCompiler('data.checkoutMethod.type'),
    [OrderStoreDataIndex.TimeSlotDate]: createInMemoryFilterCompiler('data.timeSlot.date'),
    [OrderStoreDataIndex.TimeSlotTime]: createInMemoryFilterCompiler('data.timeSlot.endTime'),
    [OrderStoreDataIndex.ValidAt]: createInMemoryFilterCompiler('validAt'),
    [OrderStoreDataIndex.Name]: createInMemoryFilterCompiler('data.customer.name'),
    [OrderStoreGeneratedIndex.TotalPrice]: createInMemoryFilterCompiler('data.totalPrice'),
    [OrderStoreGeneratedIndex.Amount]: createInMemoryFilterCompiler('data.amount'),
};

export function createCompiledFilterForPrivateOrderIndexBox(filter: StamhoofdFilter) {
    return compileToInMemoryFilter(filter, privateOrderIndexBoxInMemoryFilterCompilers);
}
