import { InMemoryFilterDefinitions, baseInMemoryFilterCompilers, createInMemoryFilterCompiler, createInMemoryFilterCompilerFromCompositePath } from './InMemoryFilter';

export const memberWithRegistrationsBlobInMemoryFilterCompilers: InMemoryFilterDefinitions = {
    ...baseInMemoryFilterCompilers,
    age: createInMemoryFilterCompiler('details.defaultAge'),
    gender: createInMemoryFilterCompiler('details.gender'),
};

export const registrationInMemoryFilterCompilers: InMemoryFilterDefinitions = {
    ...baseInMemoryFilterCompilers,
};

export const registerItemInMemoryFilterCompilers: InMemoryFilterDefinitions = {
    ...baseInMemoryFilterCompilers,
};

export const privateOrderInMemoryFilterCompilers: InMemoryFilterDefinitions = {
    ...baseInMemoryFilterCompilers,
    id: createInMemoryFilterCompiler('id'),
    number: createInMemoryFilterCompiler('number'),
    status: createInMemoryFilterCompiler('status'),
    paymentMethod: createInMemoryFilterCompiler('data.paymentMethod'),
    checkoutMethod: createInMemoryFilterCompiler('data.checkoutMethod.type'),
    timeSlotDate: createInMemoryFilterCompiler('data.timeSlot.date'),
    timeSlotTime: createInMemoryFilterCompiler('data.timeSlot.endTime'),
    validAt: createInMemoryFilterCompiler('validAt'),
    name: createInMemoryFilterCompilerFromCompositePath(['data.customer.firstName', 'data.customer.lastName']),
};
