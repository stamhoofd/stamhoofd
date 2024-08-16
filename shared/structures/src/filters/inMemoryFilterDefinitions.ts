import { InMemoryFilterDefinitions, baseInMemoryFilterCompilers, createInMemoryFilterCompiler } from "./InMemoryFilter";

export const memberWithRegistrationsBlobInMemoryFilterCompilers: InMemoryFilterDefinitions = {
    ...baseInMemoryFilterCompilers,
    age: createInMemoryFilterCompiler('details.defaultAge'),
    gender: createInMemoryFilterCompiler('details.gender')
}

