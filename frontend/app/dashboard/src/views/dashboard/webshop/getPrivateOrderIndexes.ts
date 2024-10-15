import { AutoEncoder, Decoder, field, NumberDecoder } from '@simonbackx/simple-encoding';
import { baseInMemoryFilterCompilers, compileToInMemoryFilter, createInMemoryFilterCompiler, createInMemoryFilterCompilerFromCompositePath, InMemoryFilterCompiler, InMemoryFilterDefinitions, PrivateOrder, SortDefinitions, StamhoofdFilter } from '@stamhoofd/structures';
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

export const orderStoreIndexValueDefinitions: SortDefinitions<{ value: PrivateOrder; indexes: PrivateOrderEncodeableIndexes }> & Record<OrderStoreIndex, { getValue: (data: { value: PrivateOrder; indexes: PrivateOrderEncodeableIndexes }) => IndexedDbIndexValue }> = {
    createdAt: {
        getValue({ value }) {
            return Formatter.dateTimeIso(value.createdAt);
        },
    },
    id: {
        getValue({ value }) {
            return value.id;
        },
    },
    number: {
        getValue({ value }) {
            return value.number;
        },
    },
    status: {
        getValue({ value }) {
            return value.status;
        },
    },
    paymentMethod: {
        getValue({ value }) {
            return value.data.paymentMethod;
        },
    },
    checkoutMethod: {
        getValue({ value }) {
            return value.data.checkoutMethod?.type;
        },
    },
    timeSlotDate: {
        getValue({ value }) {
            return value.data.timeSlot?.date.getTime();
        },
    },
    timeSlotTime: {
        getValue({ value }) {
            return value.data.timeSlot?.endTime;
        },
    },
    validAt: {
        getValue({ value }) {
            return value.validAt?.getTime();
        },
    },
    name: {
        getValue: ({ value }) => value.data.customer.name,
    },
    // auto generate definitions for generated indexes
    ...(Object.fromEntries(Object.values(OrderStoreGeneratedIndex).map((index) => {
        return [index, {
            getValue: ({ indexes }: { indexes: PrivateOrderEncodeableIndexes }) => indexes[index],
        }];
    })) as unknown as Record<OrderStoreGeneratedIndex, { getValue: (data: { value: PrivateOrder; indexes: PrivateOrderEncodeableIndexes }) => IndexedDbIndexValue }>),
};

const generatedIndexDefinitions: Record<OrderStoreGeneratedIndex, (order: PrivateOrder) => IndexedDbIndexValue> = {
    [OrderStoreGeneratedIndex.TotalPrice]: order => order.data.totalPrice,
    [OrderStoreGeneratedIndex.Amount]: order => order.data.cart.items.reduce((acc, item) => acc + item.amount, 0),
};

export const createPrivateOrderIndexBox = (data: PrivateOrder) => {
    return new IndexBox({ data, getIndexes: getPrivateOrderIndexes });
};

export const getPrivateOrderIndexes: GetIndexes<PrivateOrder, PrivateOrderEncodeableIndexes> = (order) => {
    return PrivateOrderEncodeableIndexes.create(
        Object.fromEntries(Object.values(OrderStoreGeneratedIndex).map((generatedIndex) => {
            const getIndex = generatedIndexDefinitions[generatedIndex];
            return [generatedIndex, getIndex(order)];
        })),
    );
};

export const createPrivateOrderIndexBoxDecoder = () => new IndexBoxDecoder(
    PrivateOrder as Decoder<PrivateOrder>,
    PrivateOrderEncodeableIndexes as Decoder<PrivateOrderEncodeableIndexes>,
);

export const privateOrderIndexBoxInMemoryFilterCompilers: InMemoryFilterDefinitions & Record<OrderStoreIndex, InMemoryFilterCompiler> = {
    ...baseInMemoryFilterCompilers,
    id: createInMemoryFilterCompiler('value.id'),
    [OrderStoreDataIndex.CreatedAt]: createInMemoryFilterCompiler('value.createdAt'),
    [OrderStoreDataIndex.Number]: createInMemoryFilterCompiler('value.number'),
    [OrderStoreDataIndex.Status]: createInMemoryFilterCompiler('value.status'),
    [OrderStoreDataIndex.PaymentMethod]: createInMemoryFilterCompiler('value.data.paymentMethod'),
    [OrderStoreDataIndex.CheckoutMethod]: createInMemoryFilterCompiler('value.data.checkoutMethod.type'),
    [OrderStoreDataIndex.TimeSlotDate]: createInMemoryFilterCompiler('value.data.timeSlot.date'),
    [OrderStoreDataIndex.TimeSlotTime]: createInMemoryFilterCompiler('value.data.timeSlot.endTime'),
    [OrderStoreDataIndex.ValidAt]: createInMemoryFilterCompiler('value.validAt'),
    [OrderStoreDataIndex.Name]: createInMemoryFilterCompilerFromCompositePath(['value.data.customer.firstName', 'value.data.customer.lastName']),
    ...(Object.fromEntries(Object.values(OrderStoreGeneratedIndex).map((index) => {
        return [index, createInMemoryFilterCompiler(`indexes.${index}`)];
    })) as Record<OrderStoreGeneratedIndex, InMemoryFilterCompiler>),
};

export function createCompiledFilterForPrivateOrderIndexBox(filter: StamhoofdFilter) {
    return compileToInMemoryFilter(filter, privateOrderIndexBoxInMemoryFilterCompilers);
}
