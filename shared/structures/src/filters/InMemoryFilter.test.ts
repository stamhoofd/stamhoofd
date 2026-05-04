import type { InMemoryFilterDefinitions } from './InMemoryFilter.js';
import { baseInMemoryFilterCompilers, compileToInMemoryFilter, createInMemoryFilterCompiler, createInMemoryWildcardCompilerSelector } from './InMemoryFilter.js';
import type { StamhoofdFilter } from './StamhoofdFilter.js';

function testError({ filter, filters, error }: { filter: StamhoofdFilter; filters: InMemoryFilterDefinitions; error: string | RegExp }) {
    expect(() => {
        compileToInMemoryFilter(filter, filters);
    }).toThrow(error);
}

function test({ filter, filters, objects, doNotMatch }: { filter: StamhoofdFilter; filters: InMemoryFilterDefinitions; objects?: any[]; doNotMatch?: any[] }) {
    const compiled = compileToInMemoryFilter(filter, filters);
    for (const object of objects ?? []) {
        if (compiled(object) !== true) {
            expect.fail(`Object ${JSON.stringify(object)} did not match filter ${JSON.stringify(filter)}`);
        }
    }

    for (const object of doNotMatch ?? []) {
        if (compiled(object) !== false) {
            expect.fail(`Object ${JSON.stringify(object)} matched filter ${JSON.stringify(filter)}, but should not have`);
        }
    }
}

describe('InMemoryFilter', () => {
    it('Cannot filter on unknown columns', async () => {
        const filters = {
            ...baseInMemoryFilterCompilers,
        };

        testError({
            filter: { name: 'John Doe' },
            filters,
            error: 'Unknown filter name',
        });
    });

    it('Cannot stack column filters', () => {
        const filters = {
            ...baseInMemoryFilterCompilers,
            name: createInMemoryFilterCompiler('name'),
            age: createInMemoryFilterCompiler('age'),
        };

        testError({
            filter: {
                name: {
                    age: 12,
                },
            },
            filters,
            error: 'Unknown filter age',
        });
    });

    describe('$eq', () => {
        it('Filtering strings is case insensitive', async () => {
            const filters = {
                ...baseInMemoryFilterCompilers,
                name: createInMemoryFilterCompiler('name'),
            };

            test({
                filter: { name: 'John Doe' },
                filters,
                objects: [
                    { name: 'John Doe' },
                    { name: 'john doe' },
                    { name: 'JOHN DOE' },
                    { name: 'JoHn DoE' },
                ],
                doNotMatch: [
                    { name: 'Jane Doe' },
                    { name: 'john doe ' },
                    { name: 'john doe  ' },
                    { name: null },
                ],
            });
        });

        it('Filtering numbers', async () => {
            const filters = {
                ...baseInMemoryFilterCompilers,
                age: createInMemoryFilterCompiler('age'),
            };

            test({
                filter: { age: 12 },
                filters,
                objects: [
                    { age: 12 },
                ],
                doNotMatch: [
                    { age: 11 },
                    { age: 13 },
                    { age: null },
                ],
            });
        });
    });

    describe('$contains', () => {
        it('Filtering strings is case insensitive', async () => {
            const filters = {
                ...baseInMemoryFilterCompilers,
                name: createInMemoryFilterCompiler('name'),
            };

            test({
                filter: {
                    name: {
                        $contains: 'TesT',
                    },
                },
                filters,
                objects: [
                    { name: 'test' },
                    { name: 'TesT' },
                    { name: 'TEST' },
                    { name: 'dit is een test' },
                ],
            });
        });

        it('Can use $and inside scope', async () => {
            const filters = {
                ...baseInMemoryFilterCompilers,
                name: createInMemoryFilterCompiler('name'),
            };

            test({
                filter: {
                    name: {
                        $and: [
                            { $contains: 'John' },
                            { $contains: 'doe' },
                        ],
                    },
                },
                filters,
                objects: [
                    { name: 'John Doe' },
                    { name: 'john o doe' },
                    { name: 'JOHN DOE' },
                    { name: 'JoHn DoE' },
                ],
            });
        });
    });

    describe('$or', () => {
        it('An empty $or is always false', () => {
            const filters = {
                ...baseInMemoryFilterCompilers,
                age: createInMemoryFilterCompiler('age'),
            };

            test({
                filter: {
                    $or: {},
                },
                filters,
                doNotMatch: [
                    { age: 12 },
                    { age: 13 },
                    { age: null },
                    false,
                    undefined,
                    null,
                    1,
                    new Date(),
                ],
            });
        });

        it('If one child is true, the whole $or is true', async () => {
            const filters = {
                ...baseInMemoryFilterCompilers,
                name: createInMemoryFilterCompiler('name'),
                age: createInMemoryFilterCompiler('age'),
            };

            test({
                filter: {
                    $or: {
                        name: 'John Doe',
                        age: 12,
                    },
                },
                filters,
                objects: [
                    { name: 'John Doe', age: 11 },
                    { name: 'John Smith', age: 12 },
                ],
                doNotMatch: [
                    { name: 'Jane Doe', age: 11 },
                    {},
                ],
            });
        });

        it('$or object children are $and together', async () => {
            const filters = {
                ...baseInMemoryFilterCompilers,
                name: createInMemoryFilterCompiler('name'),
                age: createInMemoryFilterCompiler('age'),
            };

            test({
                filter: [
                    {
                        $or: [
                            {
                                name: 'John Doe',
                                age: 11,
                            },
                            {
                                name: 'Jane Doe',
                                age: 12,
                            },
                        ],
                    },
                ],
                filters,
                objects: [
                    { name: 'John Doe', age: 11 },
                    { name: 'Jane Doe', age: 12 },
                ],
                doNotMatch: [
                    { name: 'John Doe', age: 12 },
                    { name: 'Jane Doe', age: 11 },
                    { name: 'John Smith', age: 11 },
                    { name: 'Jane Smith', age: 12 },
                    {},
                ],
            });
        });
    });

    describe('$and', () => {
        it('An empty $and is always true', () => {
            const filters = {
                ...baseInMemoryFilterCompilers,
                age: createInMemoryFilterCompiler('age'),
            };

            test({
                filter: {
                    $and: {},
                },
                filters,
                objects: [
                    { age: 12 },
                    { age: 13 },
                    { age: null },
                    { },
                    null,
                    new Date(),
                    10,
                    false,
                    undefined,
                ],
            });
        });
    });

    describe('Wildcards', () => {
        const filters: InMemoryFilterDefinitions = {
            ...baseInMemoryFilterCompilers,
            recordAnswers: createInMemoryFilterCompiler('details.recordAnswers', createInMemoryWildcardCompilerSelector({
                ...baseInMemoryFilterCompilers,
                id: createInMemoryFilterCompiler('id'),
            })),
        };

        it('Can filter on wildcards', async () => {
            test({
                filter: {
                    recordAnswers: {
                        a: {
                            id: '123',
                        },
                    },
                },
                filters,
                objects: [
                    {
                        details: {
                            recordAnswers: {
                                a: { id: '123' },
                                b: { id: '456' },
                            },
                        },
                    },
                    {
                        details: {
                            recordAnswers: {
                                b: { id: '456' },
                                a: { id: '123' },
                            },
                        },
                    },
                ],
                doNotMatch: [
                    {
                        details: {
                            recordAnswers: {
                                a: { id: '789' },
                                b: { id: '456' },
                            },
                        },
                    },
                    {
                        details: {
                            recordAnswers: {
                                b: { id: '456' },
                            },
                        },
                    },
                    {
                        details: null,
                    },
                ],
            });
        });
    });

    describe('$lt', () => {
        it('Numbers and null', async () => {
            const filters = {
                ...baseInMemoryFilterCompilers,
                age: createInMemoryFilterCompiler('age'),
            };

            test({
                filter: { age: {$lt: 5} },
                filters,
                objects: [
                    { age: null }, // null is always smaller than anything
                    { age: 4 },
                    { age: -5 }
                ],
                doNotMatch: [
                    { age: 5 },
                    { age: 10 },
                ],
            });
        });

        it('Strings and null', async () => {
            const filters = {
                ...baseInMemoryFilterCompilers,
                name: createInMemoryFilterCompiler('name'),
            };

            test({
                filter: { name: {$lt: 'John Doe'} },
                filters,
                objects: [
                    { name: null }, // null is always smaller than anything
                    { name: 'Jane Doe' },                    
                    { name: 'John Dod' },
                    { name: 'John Do' }
                ],
                doNotMatch: [
                    { name: 'John Dof' },
                    { name: 'John Doee' },
                    { name: 'John Doe' },
                ],
            });
        });

        it('Date and null', async () => {
            const filters = {
                ...baseInMemoryFilterCompilers,
                birthDay: createInMemoryFilterCompiler('birthDay'),
            };

            test({
                filter: { birthDay: {$lt: new Date(1994,5,24)} },
                filters,
                objects: [
                    { birthDay: null }, // null is always smaller than anything
                    { birthDay: new Date(1994,5,23) },
                    { birthDay: new Date(1993,5,24) },
                ],
                doNotMatch: [
                    { birthDay: new Date(1994,5,25) },
                    { birthDay: new Date(1995,5,24) },
                    { birthDay: new Date(1994,5,24) },
                ],
            });
        });
    });

    describe('$gt', () => {
        it('Numbers and null', async () => {
            const filters = {
                ...baseInMemoryFilterCompilers,
                age: createInMemoryFilterCompiler('age'),
            };

            test({
                filter: { age: {$gt: 5} },
                filters,
                objects: [
                    { age: 10 },
                    { age: 6 }
                ],
                doNotMatch: [
                    { age: null }, // null is always smaller than anything
                    { age: 5 },
                    { age: 4 },
                    { age: -10 },
                ],
            });
        });

        it('Strings and null', async () => {
            const filters = {
                ...baseInMemoryFilterCompilers,
                name: createInMemoryFilterCompiler('name'),
            };

            test({
                filter: { name: {$gt: 'John Doe'} },
                filters,
                objects: [
                    { name: 'John Dof' },
                    { name: 'John Doee' },
                ],
                doNotMatch: [
                    { name: null }, // null is always smaller than anything
                    { name: 'Jane Doe' },                    
                    { name: 'John Dod' },
                    { name: 'John Do' },
                    { name: 'John Doe' },
                ],
            });
        });

        it('Date and null', async () => {
            const filters = {
                ...baseInMemoryFilterCompilers,
                birthDay: createInMemoryFilterCompiler('birthDay'),
            };

            test({
                filter: { birthDay: {$gt: new Date(1994,5,24)} },
                filters,
                objects: [
                    { birthDay: new Date(1994,5,25) },
                    { birthDay: new Date(1995,5,24) }
                ],
                doNotMatch: [
                    { birthDay: null }, // null is always smaller than anything
                    { birthDay: new Date(1994,5,23) },
                    { birthDay: new Date(1993,5,24) },
                    { birthDay: new Date(1994,5,24) },
                ],
            });
        });
    });
});
