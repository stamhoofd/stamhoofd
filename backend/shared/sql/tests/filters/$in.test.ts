import { baseSQLFilterCompilers, createColumnFilter, SQLValueType } from '../../src/filters/SQLModernFilter';
import { SQL } from '../../src/SQL';
import { TableDefinition, test, testError, testMatch } from '../utils';

describe('$in', () => {
    /**
     * Tests that should be repeated for all filter types
     */
    describe('Common checks', () => {
        // todo
    });

    it('throws when not passing an array', async () => {
        const filters = {
            ...baseSQLFilterCompilers,
            age: createColumnFilter(SQL.column('age'), { type: SQLValueType.Number, nullable: false }),
        };

        await testError({
            filter: {
                age: {
                    $in: 18,
                },
            },
            filters,
            error: 'Expected array at $in filter',
        });
    });

    it('throws when passing more than 100 values to the filter', async () => {
        const filters = {
            ...baseSQLFilterCompilers,
            age: createColumnFilter(SQL.column('age'), { type: SQLValueType.Number, nullable: false }),
        };

        await testError({
            filter: {
                age: {
                    $in: Array.from({ length: 101 }, (_, i) => i + 1),
                },
            },
            filters,
            error: 'Too many values in $in filter, maximum is 100',
        });
    });

    it('can filter on $in', async () => {
        const filters = {
            ...baseSQLFilterCompilers,
            age: createColumnFilter(SQL.column('age'), { type: SQLValueType.Number, nullable: false }),
        };

        await test({
            filter: {
                age: {
                    $in: [18, 19, 20],
                },
            },
            filters,
            query: {
                query: '`default`.`age` IN (?)',
                params: [
                    [18, 19, 20],
                ],
            },
        });
    });

    it('can filter on single $in', async () => {
        const filters = {
            ...baseSQLFilterCompilers,
            age: createColumnFilter(SQL.column('age'), { type: SQLValueType.Number, nullable: false }),
        };

        await test({
            filter: {
                age: {
                    $in: [18],
                },
            },
            filters,
            query: {
                query: '`default`.`age` = ?',
                params: [18],
            },
        });
    });

    it('can filter on empty $in', async () => {
        const filters = {
            ...baseSQLFilterCompilers,
            age: createColumnFilter(SQL.column('age'), { type: SQLValueType.Number, nullable: false }),
        };

        await test({
            filter: {
                age: {
                    $in: [],
                },
            },
            filters,
            query: {
                query: '',
                params: [],
            },
        });
    });

    it('can invert $in inside', async () => {
        const filters = {
            ...baseSQLFilterCompilers,
            age: createColumnFilter(SQL.column('age'), { type: SQLValueType.Number, nullable: false }),
        };

        await test({
            filter: {
                age: {
                    $not: {
                        $in: [18, 19, 20],
                    },
                },
            },
            filters,
            query: {
                query: '`default`.`age` NOT IN (?)',
                params: [
                    [18, 19, 20],
                ],
            },
        });
    });

    it('can invert $in outside', async () => {
        const filters = {
            ...baseSQLFilterCompilers,
            age: createColumnFilter(SQL.column('age'), { type: SQLValueType.Number, nullable: false }),
        };

        await test({
            filter: {
                $not: {
                    age: {
                        $in: [18, 19, 20],
                    },
                },
            },
            filters,
            query: {
                query: '`default`.`age` NOT IN (?)',
                params: [
                    [18, 19, 20],
                ],
            },
        });
    });

    it('splits up when using null', async () => {
        const filters = {
            ...baseSQLFilterCompilers,
            age: createColumnFilter(SQL.column('age'), { type: SQLValueType.Number, nullable: false }),
        };

        await test({
            filter: {
                age: {
                    $in: [18, 19, 20, null],
                },
            },
            filters,
            query: {
                query: '`default`.`age` IS NULL OR `default`.`age` IN (?)',
                params: [
                    [18, 19, 20],
                ],
            },
        });
    });

    it('works when only including null', async () => {
        const filters = {
            ...baseSQLFilterCompilers,
            age: createColumnFilter(SQL.column('age'), { type: SQLValueType.Number, nullable: false }),
        };

        await test({
            filter: {
                age: {
                    $in: [null],
                },
            },
            filters,
            query: {
                query: '`default`.`age` IS NULL',
                params: [],
            },
        });
    });

    describe('JSON', () => {
        const tableDefinition: TableDefinition = {
            settings: {
                type: 'json',
                nullable: false,
            },
        };
        const filters = {
            ...baseSQLFilterCompilers,
            'settings.randomValues': createColumnFilter(
                SQL.jsonValue(SQL.column('settings'), '$.randomValues'),
                { type: SQLValueType.JSONArray, nullable: true },
            ),
        };

        it('Can check if a string is in a JSON string array, case insensitive', async () => {
            await testMatch({
                tableDefinition,
                filters,
                rows: [
                    {
                        settings: {
                            randomValues: [
                                'apple',
                                'Banana',
                                'cherrY',
                            ],
                        },
                    },
                ],
                doMatch: [
                    {
                        'settings.randomValues': {
                            $in: ['apple', 'banana', 'cherry'],
                        },
                    },
                    {
                        'settings.randomValues': {
                            $in: ['apple', 'banana'],
                        },
                    },
                    {
                        'settings.randomValues': {
                            $in: ['Apple', 'banana'],
                        },
                    },
                ],
                doNotMatch: [
                    {
                        'settings.randomValues': {
                            $in: ['orange', 'kiwi'],
                        },
                    },
                ],
            });
        });

        it('Can check if null is in a JSON array', async () => {
            await testMatch({
                tableDefinition,
                filters,
                rows: [
                    {
                        settings: {
                            randomValues: [
                                null,
                                'Banana',
                                false,
                                0,
                            ],
                        },
                    },
                ],
                doMatch: [
                    {
                        'settings.randomValues': {
                            $in: ['apple', null],
                        },
                    },
                ],
                doNotMatch: [
                    {
                        'settings.randomValues': {
                            $in: ['apple'],
                        },
                    },
                ],
            });
        });

        it('If a json array exists and does not contain null, it is not included when checking for null', async () => {
            await testMatch({
                tableDefinition,
                filters,
                rows: [
                    {
                        settings: {
                            randomValues: [
                                'Banana',
                                false,
                                0,
                            ],
                        },
                    },
                ],
                doMatch: [
                    {
                        'settings.randomValues': {
                            $in: [false],
                        },
                    },
                ],
                doNotMatch: [
                    {
                        'settings.randomValues': {
                            $in: ['apple', null],
                        },
                    },
                ],
            });
        });

        it('Including null also matches when a JSON path does not exist', async () => {
            await testMatch({
                tableDefinition,
                filters,
                rows: [
                    {
                        settings: {},
                    },
                ],
                doMatch: [
                    {
                        'settings.randomValues': {
                            $in: ['apple', 'banana', 'cherry', null],
                        },
                    },
                ],
                doNotMatch: [
                    {
                        'settings.randomValues': {
                            $in: ['apple', 'banana', 'cherry'],
                        },
                    },
                ],
            });
        });

        it('Can search numbers in a JSON array', async () => {
            await testMatch({
                tableDefinition,
                filters,
                rows: [
                    {
                        settings: {
                            randomValues: [
                                null,
                                'Banana',
                                false,
                                0,
                                5,
                                15,
                            ],
                        },
                    },
                ],
                doMatch: [
                    {
                        'settings.randomValues': {
                            $in: [5, 15],
                        },
                    },
                    {
                        'settings.randomValues': {
                            $in: [5],
                        },
                    },
                    {
                        'settings.randomValues': {
                            $in: [15],
                        },
                    },
                    {
                        'settings.randomValues': {
                            $in: [99, 15],
                        },
                    },
                ],
                doNotMatch: [
                    {
                        'settings.randomValues': {
                            $in: [6, 10],
                        },
                    },
                    {
                        'settings.randomValues': {
                            $in: [99, 14],
                        },
                    },
                    {
                        'settings.randomValues': {
                            $in: [],
                        },
                    },
                ],
            });
        });

        it('Can search booleans in a JSON array', async () => {
            await testMatch({
                tableDefinition,
                filters,
                rows: [
                    {
                        settings: {
                            randomValues: [
                                null,
                                'Banana',
                                false,
                                1,
                            ],
                        },
                    },
                ],
                doMatch: [
                    {
                        'settings.randomValues': {
                            $in: [false, true],
                        },
                    },
                    {
                        'settings.randomValues': {
                            $in: [false],
                        },
                    },
                ],
                doNotMatch: [
                    {
                        'settings.randomValues': {
                            $in: [true],
                        },
                    },
                    {
                        'settings.randomValues': {
                            $in: [0],
                        },
                    },
                    {
                        'settings.randomValues': {
                            $in: [],
                        },
                    },
                ],
            });
        });
    });
});
