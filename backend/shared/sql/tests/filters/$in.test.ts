import { baseSQLFilterCompilers, createColumnFilter, SQLValueType } from '../../src/filters/SQLFilter.js';
import { SQL } from '../../src/SQL.js';
import { TableDefinition, test, testError, testMatch } from '../utils/index.js';

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
            age: createColumnFilter({ expression: SQL.column('age'), type: SQLValueType.Number, nullable: false }),
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

    it('throws when passing more than 1000 values to the filter', async () => {
        const filters = {
            ...baseSQLFilterCompilers,
            age: createColumnFilter({ expression: SQL.column('age'), type: SQLValueType.Number, nullable: false }),
        };

        await testError({
            filter: {
                age: {
                    $in: Array.from({ length: 1001 }, (_, i) => i + 1),
                },
            },
            filters,
            error: 'Too many values in $in filter, maximum is 1000',
        });
    });

    it('can filter on $in', async () => {
        const filters = {
            ...baseSQLFilterCompilers,
            age: createColumnFilter({ expression: SQL.column('age'), type: SQLValueType.Number, nullable: false }),
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
            age: createColumnFilter({ expression: SQL.column('age'), type: SQLValueType.Number, nullable: false }),
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
            age: createColumnFilter({ expression: SQL.column('age'), type: SQLValueType.Number, nullable: false }),
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
            age: createColumnFilter({ expression: SQL.column('age'), type: SQLValueType.Number, nullable: false }),
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
            age: createColumnFilter({ expression: SQL.column('age'), type: SQLValueType.Number, nullable: false }),
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
            age: createColumnFilter({ expression: SQL.column('age'), type: SQLValueType.Number, nullable: false }),
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
            age: createColumnFilter({ expression: SQL.column('age'), type: SQLValueType.Number, nullable: false }),
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

    it('throws an error when trying to search in json objects', async () => {
        const filters = {
            ...baseSQLFilterCompilers,
            settings: createColumnFilter({ expression: SQL.column('settings'), type: SQLValueType.JSONObject, nullable: false }),
        };
        await testError({
            filter: {
                settings: {
                    $in: ['apple', 'banana'],
                },
            },
            filters,
            error: 'Cannot compare with a JSON object',
        });
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
            'settings.randomValues': createColumnFilter({ expression: SQL.jsonExtract(SQL.column('settings'), '$.randomValues'), type: SQLValueType.JSONArray, nullable: true },
            ),
            'settings.name': createColumnFilter({ expression: SQL.jsonExtract(SQL.column('settings'), '$.name'), type: SQLValueType.JSONString, nullable: true },
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
                            $in: ['apple', 'banana', 'cherry', 'other'],
                        },
                    },
                    {
                        'settings.randomValues': {
                            $in: ['apple', 'banana', 'other'],
                        },
                    },
                    {
                        'settings.randomValues': {
                            $in: ['Apple', 'banana', 'other'],
                        },
                    },
                ],
                doNotMatch: [
                    {
                        'settings.randomValues': {
                            $in: ['orange', 'kiwi'],
                        },
                    },
                    {
                        'settings.randomValues': {
                            $in: ['pple'],
                        },
                    },
                    {
                        'settings.randomValues': {
                            $in: ['àpple'],
                        },
                    },
                ],
            });
        });

        it('Can check if a JSON string equals values, case insensitive', async () => {
            await testMatch({
                tableDefinition,
                filters,
                rows: [
                    {
                        settings: {
                            name: 'aPple',
                        },
                    },
                    {
                        settings: {
                            name: 'apple',
                        },
                    },
                    {
                        settings: {
                            name: 'APPLE',
                        },
                    },
                ],
                doMatch: [
                    {
                        'settings.name': {
                            $in: ['apple', 'banana', 'other'],
                        },
                    },
                    {
                        'settings.name': {
                            $in: ['apple'],
                        },
                    },
                    {
                        'settings.name': {
                            $in: ['Apple', 'other'],
                        },
                    },
                ],
                doNotMatch: [
                ],
            });
        });

        it('Can check if an emoji is in a JSON string array', async () => {
            await testMatch({
                tableDefinition,
                filters,
                rows: [
                    {
                        settings: {
                            randomValues: [
                                '🍎',
                                '🍌',
                                '👩🏽‍🎤',
                            ],
                        },
                    },
                ],
                doMatch: [
                    {
                        'settings.randomValues': {
                            $in: ['🍎', '🍌', '👩🏽‍🎤', 'other'],
                        },
                    },
                    {
                        'settings.randomValues': {
                            $in: ['🍎', '🍌', 'other'],
                        },
                    },
                    {
                        'settings.randomValues': {
                            $in: ['👩🏽‍🎤', 'other'],
                        },
                    },
                    {
                        'settings.randomValues': {
                            $in: ['👩🏽‍🎤'],
                        },
                    },
                ],
                doNotMatch: [
                    {
                        'settings.randomValues': {
                            $in: ['other'],
                        },
                    },
                    {
                        'settings.randomValues': {
                            $in: ['👩🏽'],
                        },
                    },
                    {
                        'settings.randomValues': {
                            $in: ['👩🏻‍🎤'],
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

        it('Including null will also check on key existence for json arrays', async () => {
            await testMatch({
                tableDefinition,
                filters,
                rows: [
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
                            $in: ['apple', null],
                        },
                    },
                    {
                        'settings.randomValues': {
                            $in: [null],
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
