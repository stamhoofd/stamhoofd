import { baseSQLFilterCompilers, createColumnFilter, SQLValueType } from '../../src/filters/SQLFilter.js';
import { SQL } from '../../src/SQL.js';
import { TableDefinition, test, testError, testMatch, testMultiple, testMultipleErrors } from '../utils/index.js';

describe('$eq', () => {
    /**
     * Tests that should be repeated for all filter types
     */
    describe('Common checks', () => {
        it('Cannot be used at the root level', async () => {
            const filters = {
                ...baseSQLFilterCompilers,
            };

            await testMultipleErrors({
                testFilters: [
                    {
                        $eq: 'value',
                    },
                    {
                        $and: [
                            {
                                $eq: 'value',
                            },
                        ],
                    },
                    'value',
                ],
                filters,
                error: 'Cannot compare at root level',
            });
        });
    });

    it('removes caps when filtering strings', async () => {
        const filters = {
            ...baseSQLFilterCompilers,
            name: createColumnFilter({ expression: SQL.column('name'), type: SQLValueType.String, nullable: false }),
        };

        // Caps are removed
        await test({
            filter: {
                name: {
                    $eq: 'John Doe',
                },
            },
            filters,
            query: {
                query: '`default`.`name` = ?',
                params: ['john doe'],
            },
        });
    });

    it('converts true to 1', async () => {
        const filters = {
            ...baseSQLFilterCompilers,
            enabled: createColumnFilter({ expression: SQL.column('enabled'), type: SQLValueType.Boolean, nullable: false }),
        };

        await testMultiple({
            testFilters: [
                {
                    enabled: true,
                },
                {
                    enabled: {
                        $eq: true,
                    },
                },
            ],
            filters,
            query: {
                query: '`default`.`enabled` = ?',
                params: [1],
            },
        });
    });

    it('converts false to 0', async () => {
        const filters = {
            ...baseSQLFilterCompilers,
            enabled: createColumnFilter({ expression: SQL.column('enabled'), type: SQLValueType.Boolean, nullable: false }),
        };

        await testMultiple({
            testFilters: [
                {
                    enabled: false,
                },
                {
                    enabled: {
                        $eq: false,
                    },
                },
            ],
            filters,
            query: {
                query: '`default`.`enabled` = ?',
                params: [0],
            },
        });
    });

    it('allows  1 as true', async () => {
        const filters = {
            ...baseSQLFilterCompilers,
            enabled: createColumnFilter({ expression: SQL.column('enabled'), type: SQLValueType.Boolean, nullable: false }),
        };

        await testMultiple({
            testFilters: [
                {
                    enabled: 1,
                },
                {
                    enabled: {
                        $eq: 1,
                    },
                },
            ],
            filters,
            query: {
                query: '`default`.`enabled` = ?',
                params: [1],
            },
        });
    });

    it('allows 0 as false', async () => {
        const filters = {
            ...baseSQLFilterCompilers,
            enabled: createColumnFilter({ expression: SQL.column('enabled'), type: SQLValueType.Boolean, nullable: false }),
        };

        await testMultiple({
            testFilters: [
                {
                    enabled: 0,
                },
                {
                    enabled: {
                        $eq: 0,
                    },
                },
            ],
            filters,
            query: {
                query: '`default`.`enabled` = ?',
                params: [0],
            },
        });
    });

    it('comparing a nullable value is converted to <=> to be consistent with mysql', async () => {
        const filters = {
            ...baseSQLFilterCompilers,
            name: createColumnFilter({ expression: SQL.column('name'), type: SQLValueType.String, nullable: true }),
        };

        await testMultiple({
            testFilters: [
                {
                    name: 'John Doe',
                },
            ],
            filters,
            query: {
                query: '`default`.`name` <=> ?',
                params: ['john doe'],
            },
        });
    });

    it('comparing a non-nullable value is not converted to <=>', async () => {
        const filters = {
            ...baseSQLFilterCompilers,
            name: createColumnFilter({ expression: SQL.column('name'), type: SQLValueType.String, nullable: false }),
        };

        await testMultiple({
            testFilters: [
                {
                    name: 'John Doe',
                },
            ],
            filters,
            query: {
                query: '`default`.`name` = ?',
                params: ['john doe'],
            },
        });
    });

    it('not comparing a nullable value is converted to a NOT <=> to be consistent with mysql', async () => {
        const filters = {
            ...baseSQLFilterCompilers,
            name: createColumnFilter({ expression: SQL.column('name'), type: SQLValueType.String, nullable: true }),
        };

        await testMultiple({
            testFilters: [
                {
                    name: {
                        $neq: 'John Doe',
                    },
                },
            ],
            filters,
            query: {
                query: 'NOT (`default`.`name` <=> ?)',
                params: ['john doe'],
            },
        });
    });

    it('does not allow numbers as boolean value', async () => {
        const filters = {
            ...baseSQLFilterCompilers,
            enabled: createColumnFilter({ expression: SQL.column('enabled'), type: SQLValueType.Boolean, nullable: false }),
        };

        await testMultipleErrors({
            testFilters: [
                {
                    enabled: 2,
                },
                {
                    enabled: {
                        $eq: 2,
                    },
                },
                {
                    enabled: {
                        $eq: -1,
                    },
                },
                {
                    enabled: {
                        $eq: NaN,
                    },
                },
                {
                    enabled: {
                        $eq: Infinity,
                    },
                },
            ],
            filters,
            error: 'Cannot compare a number with a boolean column',
        });
    });

    it('cannot compare a number with a string', async () => {
        const filters = {
            ...baseSQLFilterCompilers,
            name: createColumnFilter({ expression: SQL.column('name'), type: SQLValueType.String, nullable: false }),
        };

        await testError({
            filter: {
                name: {
                    $eq: 5,
                },
            },
            filters,
            error: 'Cannot compare a number with a non-number column',
        });
    });

    it('cannot compare a string with a number', async () => {
        const filters = {
            ...baseSQLFilterCompilers,
            age: createColumnFilter({ expression: SQL.column('age'), type: SQLValueType.Number, nullable: false }),
        };

        await testError({
            filter: {
                age: {
                    $eq: 'John Doe',
                },
            },
            filters,
            error: 'Cannot compare a string with a non-string column',
        });
    });

    it('cannot compare a number with a date', async () => {
        const filters = {
            ...baseSQLFilterCompilers,
            createdAt: createColumnFilter({ expression: SQL.column('createdAt'), type: SQLValueType.Datetime, nullable: false }),
        };

        await testError({
            filter: {
                createdAt: {
                    $eq: 5,
                },
            },
            filters,
            error: 'Cannot compare a number with a non-number column',
        });
    });

    it('cannot compare a date with a string', async () => {
        const filters = {
            ...baseSQLFilterCompilers,
            name: createColumnFilter({ expression: SQL.column('name'), type: SQLValueType.String, nullable: false }),
        };

        await testError({
            filter: {
                name: {
                    $eq: new Date(),
                },
            },
            filters,
            error: 'Cannot compare a date with a non-datetime column',
        });
    });

    it('cannot compare a date magic variable with a string', async () => {
        const filters = {
            ...baseSQLFilterCompilers,
            name: createColumnFilter({ expression: SQL.column('name'), type: SQLValueType.String, nullable: false }),
        };

        await testError({
            filter: {
                name: {
                    $eq: {
                        $: '$now',
                    },
                },
            },
            filters,
            error: 'Cannot compare a date with a non-datetime column',
        });
    });

    it('$eq filter is interpreted automatically for numbers', async () => {
        const filters = {
            ...baseSQLFilterCompilers,
            age: createColumnFilter({ expression: SQL.column('age'), type: SQLValueType.Number, nullable: false }),
        };

        await test({
            filter: {
                age: 5,
            },
            filters,
            query: {
                query: '`default`.`age` = ?',
                params: [5],
            },
        });
    });

    it('$eq filter is interpreted automatically for strings', async () => {
        const filters = {
            ...baseSQLFilterCompilers,
            name: createColumnFilter({ expression: SQL.column('name'), type: SQLValueType.String, nullable: false }),
        };

        await test({
            filter: {
                name: 'John Doe',
            },
            filters,
            query: {
                query: '`default`.`name` = ?',
                params: ['john doe'],
            },
        });
    });

    it('$eq filter is interpreted automatically for null', async () => {
        const filters = {
            ...baseSQLFilterCompilers,
            name: createColumnFilter({ expression: SQL.column('name'), type: SQLValueType.String, nullable: true }),
        };

        await test({
            filter: {
                name: null,
            },
            filters,
            query: {
                query: '`default`.`name` IS NULL',
                params: [],
            },
        });
    });

    it('$eq filter is interpreted automatically for magic variables', async () => {
        const filters = {
            ...baseSQLFilterCompilers,
            createdAt: createColumnFilter({ expression: SQL.column('createdAt'), type: SQLValueType.Datetime, nullable: false }),
        };

        jest.useFakeTimers().setSystemTime(new Date());

        try {
            await test({
                filter: {
                    createdAt: {
                        $: '$now',
                    },
                },
                filters,
                query: {
                    query: '`default`.`createdAt` = ?',
                    params: [
                        new Date(),
                    ],
                },
            });
        }
        finally {
            jest.useRealTimers();
        }
    });

    describe('JSON', () => {
        const tableDefinition: TableDefinition = {
            settings: {
                type: 'json',
                nullable: true,
            },
        };
        const filters = {
            ...baseSQLFilterCompilers,
            'settings.name': createColumnFilter({ expression: SQL.jsonExtract(SQL.column('settings'), '$.name'), type: SQLValueType.JSONString, nullable: false }),
            // wip:
            'settings.parents[*].name': createColumnFilter({ expression: SQL.jsonExtract(SQL.column('settings'), '$.parents[*].name'), type: SQLValueType.JSONArray, nullable: false }),
            'settings.parents[*].age': createColumnFilter({ expression: SQL.jsonExtract(SQL.column('settings'), '$.parents[*].age'), type: SQLValueType.JSONArray, nullable: false }),
            'settings.randomValues': createColumnFilter({ expression: SQL.jsonExtract(SQL.column('settings'), '$.randomValues'), type: SQLValueType.JSONArray, nullable: true }),
            'settings': createColumnFilter({ expression: SQL.column('settings'), type: SQLValueType.JSONObject, nullable: true }),
            'settings.enabled': createColumnFilter({ expression: SQL.jsonExtract(SQL.column('settings'), '$.enabled'), type: SQLValueType.JSONBoolean, nullable: true }),
            'settings.age': createColumnFilter({ expression: SQL.jsonExtract(SQL.column('settings'), '$.age'), type: SQLValueType.JSONNumber, nullable: true }),
        };

        it('JSON strings match case insensitive and whole string', async () => {
            await testMatch({
                tableDefinition,
                filters,
                rows: [
                    {
                        settings: {
                            name: 'John Doe',
                        },
                    },
                ],
                doMatch: [
                    {
                        'settings.name': 'John Doe',
                    },
                    {
                        'settings.name': {
                            $eq: 'John Doe',
                        },
                    },
                    {
                        'settings.name': 'john doe',
                    },
                    {
                        'settings.name': 'jOhn dOe',
                    },
                ],
                doNotMatch: [
                    {
                        'settings.name': 'Jane Doe',
                    },
                    {
                        'settings.name': 'John',
                    },
                    {
                        'settings.name': 'john',
                    },
                ],
            });
        });

        it('Can search strings in a string array', async () => {
            await testMatch({
                tableDefinition,
                filters,
                rows: [
                    {
                        settings: {
                            name: 'Junior Doe',
                            parents: [
                                { name: 'John Doe' },
                                { name: 'Jane Doe' },
                            ],
                        },
                    },
                ],
                doMatch: [
                    {
                        'settings.parents[*].name': 'John Doe',
                    },
                    {
                        'settings.parents[*].name': 'Jane Doe',
                    },
                    {
                        'settings.parents[*].name': 'jane doe',
                    },
                    {
                        'settings.parents[*].name': 'john doe',
                    },
                ],
                doNotMatch: [
                    {
                        'settings.parents[*].name': 'John',
                    },
                    {
                        'settings.parents[*].name': 'Jane',
                    },
                    {
                        'settings.parents[*].name': 'jane',
                    },
                    {
                        'settings.parents[*].name': 'john',
                    },
                    {
                        'settings.parents[*].name': 'Jane Doe ',
                    },
                    {
                        'settings.parents[*].name': 5,
                    },
                    {
                        'settings.parents[*].name': true,
                    },
                ],
            });
        });

        it('Can search numbers in a number array', async () => {
            await testMatch({
                tableDefinition,
                filters,
                rows: [
                    {
                        settings: {
                            name: 'Junior Doe',
                            parents: [
                                { name: 'John Doe', age: 50 },
                                { name: 'Jane Doe', age: 45 },
                            ],
                        },
                    },
                ],
                doMatch: [
                    {
                        'settings.parents[*].age': 50,
                    },
                    {
                        'settings.parents[*].age': 45,
                    },
                ],
                doNotMatch: [
                    {
                        'settings.parents[*].age': 51,
                    },
                    {
                        'settings.parents[*].age': 49,
                    },
                    {
                        'settings.parents[*].age': 45.1,
                    },
                    {
                        'settings.parents[*].age': '49',
                    },
                    {
                        'settings.parents[*].age': 'test',
                    },
                ],
            });
        });

        it('Can search in a mixed array', async () => {
            await testMatch({
                tableDefinition,
                filters,
                rows: [
                    {
                        settings: {
                            name: 'Junior Doe',
                            randomValues: [true, 0, 'tesT'],
                        },
                    },
                ],
                doMatch: [
                    {
                        'settings.randomValues': true,
                    },
                    {
                        'settings.randomValues': 0,
                    },
                    {
                        'settings.randomValues': 'tesT',
                    },
                    {
                        'settings.randomValues': 'Test',
                    },
                ],
                doNotMatch: [
                    {
                        'settings.randomValues': false,
                    },
                    {
                        'settings.randomValues': 1,
                    },
                    {
                        'settings.randomValues': 'tes',
                    },
                ],
            });
        });

        it('Can search null in a JSON array', async () => {
            await testMatch({
                tableDefinition,
                filters,
                rows: [
                    {
                        settings: {
                            name: 'Junior Doe',
                            parents: [
                                { name: null, age: 50 },
                                { name: 'Jane Doe', age: null },
                            ],
                        },
                    },
                ],
                doMatch: [
                    {
                        'settings.parents[*].age': null,
                    },
                    {
                        'settings.parents[*].name': null,
                    },
                ],
            });

            await testMatch({
                tableDefinition,
                filters,
                rows: [
                    {
                        settings: {
                            name: 'Junior Doe',
                            parents: [
                                { name: 'Set', age: 50 },
                                { name: 'Jane Doe', age: 45 },
                            ],
                        },
                    },
                ],
                doNotMatch: [
                    {
                        'settings.parents[*].age': null,
                    },
                    {
                        'settings.parents[*].name': null,
                    },
                ],
            });
        });

        it('Can check JSON booleans', async () => {
            await testMatch({
                tableDefinition,
                filters,
                rows: [
                    {
                        settings: {
                            enabled: true,
                        },
                    },
                ],
                doMatch: [
                    {
                        'settings.enabled': true,
                    },
                    {
                        'settings.enabled': 1,
                    },
                ],
                doNotMatch: [
                    {
                        'settings.enabled': false,
                    },
                    {
                        'settings.enabled': null,
                    },
                ],
            });

            await testMatch({
                tableDefinition,
                filters,
                rows: [
                    {
                        settings: {
                            enabled: false,
                        },
                    },
                ],
                doMatch: [
                    {
                        'settings.enabled': false,
                    },
                    {
                        'settings.enabled': 0,
                    },
                ],
                doNotMatch: [
                    {
                        'settings.enabled': true,
                    },
                    {
                        'settings.enabled': null,
                    },
                ],
            });

            await testMatch({
                tableDefinition,
                filters,
                rows: [
                    {
                        settings: {
                            enabled: null,
                        },
                    },
                    {
                        settings: {},
                    },
                    {
                        settings: null,
                    },
                    {
                        settings: 'null',
                    },
                ],
                doMatch: [
                    {
                        'settings.enabled': null,
                    },
                ],
                doNotMatch: [
                    {
                        'settings.enabled': true,
                    },
                    {
                        'settings.enabled': false,
                    },
                ],
            });
        });

        it('Can compare JSON numbers', async () => {
            await testMatch({
                tableDefinition,
                filters,
                rows: [
                    {
                        settings: {
                            age: 10,
                        },
                    },
                ],
                doMatch: [
                    {
                        'settings.age': 10,
                    },
                ],
                doNotMatch: [
                    {
                        'settings.age': 11,
                    },
                    {
                        'settings.age': 9,
                    },
                ],
            });

            await testMatch({
                tableDefinition,
                filters,
                rows: [
                    {
                        settings: {
                            age: null,
                        },
                    },
                    {
                        settings: { },
                    },
                    {
                        settings: null,
                    },
                    {
                        settings: 'null',
                    },
                ],
                doMatch: [
                    {
                        'settings.age': null,
                    },
                ],
                doNotMatch: [
                    {
                        'settings.age': 0,
                    },
                ],
            });

            await testMatch({
                tableDefinition,
                filters,
                rows: [
                    {
                        settings: {
                            enabled: null,
                        },
                    },
                    {
                        settings: {},
                    },
                    {
                        settings: null,
                    },
                    {
                        settings: 'null',
                    },
                ],
                doMatch: [
                    {
                        'settings.enabled': null,
                    },
                ],
                doNotMatch: [
                    {
                        'settings.enabled': true,
                    },
                    {
                        'settings.enabled': false,
                    },
                ],
            });
        });

        it('Checking a json value for null also matches if the key does not exist', async () => {
            await testMatch({
                tableDefinition,
                filters,
                rows: [
                    {
                        settings: null,
                    },
                    {
                        settings: {
                            something: false,
                        },
                    },
                    {
                        settings: {
                            name: null,
                        },
                    },
                    {
                        settings: {
                            parents: [
                                { name: null },
                            ],
                        },
                    },
                    {
                        settings: {
                            parents: [
                                { age: null },
                            ],
                        },
                    },
                ],
                doMatch: [
                    {
                        'settings.name': null,
                    },
                    {
                        'settings.parents[*].age': null,
                    },
                    {
                        'settings.parents[*].name': null,
                    },
                ],
            });
        });

        it('Can check if a json string is null', async () => {
            await testMatch({
                tableDefinition,
                filters,
                rows: [
                    {
                        settings: {
                            name: null,
                        },
                    },
                    {
                        settings: null,
                    },
                    {
                        settings: {},
                    },
                ],
                doMatch: [
                    {
                        'settings.name': null,
                    },
                ],
            });
        });

        it('Can check if a json number is null', async () => {
            await testMatch({
                tableDefinition,
                filters,
                rows: [
                    {
                        settings: {
                            age: null,
                        },
                    },
                    {
                        settings: null,
                    },
                    {
                        settings: {},
                    },
                ],
                doMatch: [
                    {
                        'settings.age': null,
                    },
                ],
            });
        });

        it('Can differentiate null string vs json null when comparing to null', async () => {
            await testMatch({
                tableDefinition,
                filters,
                rows: [
                    {
                        settings: {
                            name: 'null',
                        },
                    },
                ],
                doNotMatch: [
                    {
                        'settings.name': null,
                    },
                ],
            });
        });

        it('Can differentiate 0 number vs json null when comparing to null', async () => {
            await testMatch({
                tableDefinition,
                filters,
                rows: [
                    {
                        settings: {
                            age: 0,
                        },
                    },
                ],
                doNotMatch: [
                    {
                        'settings.age': null,
                    },
                ],
            });
        });

        it('can check if a json object column is null', async () => {
            await testMatch({
                tableDefinition,
                filters,
                rows: [
                    {
                        settings: 'null',
                    },
                    {
                        settings: null,
                    },
                ],
                doMatch: [
                    {
                        settings: {
                            $eq: null,
                        },
                    },
                    {
                        settings: null,
                    },
                ],
            });

            await testMatch({
                tableDefinition,
                filters,
                rows: [
                    {
                        settings: {},
                    },
                ],
                doNotMatch: [
                    {
                        settings: {
                            $eq: null,
                        },
                    },
                    {
                        settings: null,
                    },
                ],
            });
        });

        it('can check if a JSON array column is null', async () => {
            await testMatch({
                tableDefinition,
                filters,
                rows: [
                    {
                        settings: 'null',
                    },
                    {
                        settings: null,
                    },
                    {
                        settings: {},
                    },
                    {
                        settings: {
                            randomValues: null,
                        },
                    },
                ],
                doMatch: [
                    {
                        'settings.randomValues': {
                            $eq: null,
                        },
                    },
                    {
                        'settings.randomValues': null,
                    },
                ],
                doNotMatch: [
                    {
                        'settings.randomValues': {
                            $neq: null,
                        },
                    },
                ],
            });

            await testMatch({
                tableDefinition,
                filters,
                rows: [
                    {
                        settings: {
                            randomValues: [],
                        },
                    },
                ],
                doNotMatch: [
                    {
                        'settings.randomValues': {
                            $eq: null,
                        },
                    },
                    {
                        'settings.randomValues': null,
                    },
                ],
                doMatch: [
                    {
                        'settings.randomValues': {
                            $neq: null,
                        },
                    },
                ],
            });
        });
    });
});
