import { InMemoryFilterDefinitions, baseInMemoryFilterCompilers, createInMemoryFilterCompiler } from './InMemoryFilter';

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
    '#': createInMemoryFilterCompiler('number'),
};
