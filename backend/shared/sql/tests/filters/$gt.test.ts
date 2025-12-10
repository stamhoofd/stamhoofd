import { baseSQLFilterCompilers, createColumnFilter, SQLValueType } from '../../src/filters/SQLFilter';
import { SQL } from '../../src/SQL';
import { TableDefinition, test, testMatch } from '../utils';

describe('$gt', () => {
    /**
     * Tests that should be repeated for all filter types
     */
    describe('Common checks', () => {
        // todo
    });

    it('can filter on $gt', async () => {
        const filters = {
            ...baseSQLFilterCompilers,
            age: createColumnFilter({ expression: SQL.column('age'), type: SQLValueType.Number, nullable: false }),
        };

        await test({
            filter: {
                age: {
                    $gt: 18,
                },
            },
            filters,
            query: {
                query: '`default`.`age` > ?',
                params: [18],
            },
        });
    });

    it('can invert $gt inside', async () => {
        const filters = {
            ...baseSQLFilterCompilers,
            age: createColumnFilter({ expression: SQL.column('age'), type: SQLValueType.Number, nullable: false }),
        };

        await test({
            filter: {
                age: {
                    $not: {
                        $gt: 18,
                    },
                },
            },
            filters,
            query: {
                query: '`default`.`age` <= ?',
                params: [18],
            },
        });
    });

    it('can invert $gt outside', async () => {
        const filters = {
            ...baseSQLFilterCompilers,
            age: createColumnFilter({ expression: SQL.column('age'), type: SQLValueType.Number, nullable: false }),
        };

        await test({
            filter: {
                $not: {
                    age: {
                        $gt: 18,
                    },
                },
            },
            filters,
            query: {
                query: '`default`.`age` <= ?',
                params: [18],
            },
        });
    });

    it('can compare string values with $gt', async () => {
        const filters = {
            ...baseSQLFilterCompilers,
            name: createColumnFilter({ expression: SQL.column('name'), type: SQLValueType.String, nullable: false }),
        };
        await test({
            filter: {
                name: {
                    $gt: 'Alice',
                },
            },
            filters,
            query: {
                query: '`default`.`name` > ?',
                params: ['alice'],
            },
        });
    });

    it('can compare JSON string values with $gt', async () => {
        const filters = {
            ...baseSQLFilterCompilers,
            'settings.name': createColumnFilter({ expression: SQL.jsonExtract(SQL.column('settings'), '$.name'), type: SQLValueType.JSONString, nullable: false },
            ),
        };
        await test({
            filter: {
                'settings.name': {
                    $gt: 'Alice',
                },
            },
            filters,
            query: {
                query: 'JSON_VALUE(`default`.`settings`,"$.name" RETURNING CHAR CHARACTER SET utf8mb4 ERROR ON ERROR) > ?',
                params: ['alice'],
            },
        });
    });

    describe('MySQL Behaviour', () => {
        const tableDefinition: TableDefinition = {
            settings: {
                type: 'json',
                nullable: true,
            },
            name: {
                type: 'varchar',
                nullable: true,
            },
            age: {
                type: 'int',
                nullable: true,
            },
        };
        const filters = {
            ...baseSQLFilterCompilers,
            'name': createColumnFilter(
                { expression: SQL.column('name'), type: SQLValueType.String, nullable: true },
            ),
            'age': createColumnFilter(
                { expression: SQL.column('age'), type: SQLValueType.Number, nullable: true },
            ),
            'settings.name': createColumnFilter({ expression: SQL.jsonExtract(SQL.column('settings'), '$.name'), type: SQLValueType.JSONString, nullable: true },
            ),
            'settings': createColumnFilter({ expression: SQL.column('settings'), type: SQLValueType.JSONObject, nullable: true }),
            'settings.enabled': createColumnFilter({ expression: SQL.jsonExtract(SQL.column('settings'), '$.enabled'), type: SQLValueType.JSONBoolean, nullable: true },
            ),
            'settings.age': createColumnFilter({ expression: SQL.jsonExtract(SQL.column('settings'), '$.age'), type: SQLValueType.JSONNumber, nullable: true },
            ),
        };

        it('Comparing string values is case insensitive', async () => {
            await testMatch({
                tableDefinition,
                filters,
                rows: [
                    {
                        name: 'alice',
                    },
                    {
                        name: 'Alice',
                    },
                    {
                        name: 'ALICE',
                    },
                ],
                doMatch: [
                    {
                        name: {
                            $gt: 'a',
                        },
                    },
                    {
                        name: {
                            $gt: 'alic',
                        },
                    },
                    {
                        name: {
                            $gt: 'Alic',
                        },
                    },
                ],
                doNotMatch: [
                    {
                        name: {
                            $gt: 'Alice',
                        },
                    },
                    {
                        name: {
                            $gt: 'aLice',
                        },
                    },
                    {
                        name: {
                            $gt: 'ALICE',
                        },
                    },
                    {
                        name: {
                            $gt: 'alice',
                        },
                    },
                    {
                        name: {
                            $gt: 'b',
                        },
                    },
                ],
            });
        });

        it('Comparing JSON string values is case insensitive', async () => {
            await testMatch({
                tableDefinition,
                filters,
                rows: [
                    {
                        settings: {
                            name: 'alice',
                        },
                    },
                    {
                        settings: {
                            name: 'Alice',
                        },
                    },
                    {
                        settings: {
                            name: 'ALICE',
                        },
                    },
                ],
                doMatch: [
                    {
                        'settings.name': {
                            $gt: 'a',
                        },
                    },
                    {
                        'settings.name': {
                            $gt: 'alic',
                        },
                    },
                    {
                        'settings.name': {
                            $gt: 'Alic',
                        },
                    },
                ],
                doNotMatch: [
                    {
                        'settings.name': {
                            $gt: 'Alice',
                        },
                    },
                    {
                        'settings.name': {
                            $gt: 'aLice',
                        },
                    },
                    {
                        'settings.name': {
                            $gt: 'ALICE',
                        },
                    },
                    {
                        'settings.name': {
                            $gt: 'alice',
                        },
                    },
                    {
                        'settings.name': {
                            $gt: 'b',
                        },
                    },
                ],
            });
        });

        it('Comparing numbers values is numberic', async () => {
            await testMatch({
                tableDefinition,
                filters,
                rows: [
                    {
                        age: 10,
                    },
                ],
                doMatch: [
                    {
                        age: {
                            $gt: 9,
                        },
                    },
                    {
                        age: {
                            $gt: 0,
                        },
                    },
                    {
                        age: {
                            $gt: -9,
                        },
                    },
                    {
                        age: {
                            $gt: 1,
                        },
                    },
                ],
                doNotMatch: [
                    {
                        age: {
                            $gt: 10,
                        },
                    },
                    {
                        age: {
                            $gt: 12,
                        },
                    },
                    {
                        age: {
                            $gt: 20,
                        },
                    },
                ],
            });
        });

        it('Comparing JSON numbers values is numberic', async () => {
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
                        'settings.age': {
                            $gt: 9,
                        },
                    },
                    {
                        'settings.age': {
                            $gt: 0,
                        },
                    },
                    {
                        'settings.age': {
                            $gt: -9,
                        },
                    },
                    {
                        'settings.age': {
                            $gt: 1,
                        },
                    },
                ],
                doNotMatch: [
                    {
                        'settings.age': {
                            $gt: 10,
                        },
                    },
                    {
                        'settings.age': {
                            $gt: 12,
                        },
                    },
                    {
                        'settings.age': {
                            $gt: 20,
                        },
                    },
                ],
            });
        });

        it('NULL values are always the smallest for JSON numbers', async () => {
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
                doNotMatch: [
                    {
                        'settings.age': {
                            $gt: -1000,
                        },
                    },
                    {
                        'settings.age': {
                            $gt: 0,
                        },
                    },
                    {
                        'settings.age': {
                            $gt: null,
                        },
                    },
                ],
            });
        });

        it('NULL values are always the smallest for JSON strings', async () => {
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
                doNotMatch: [
                    {
                        'settings.name': {
                            $gt: '',
                        },
                    },
                    {
                        'settings.name': {
                            $gt: 'aaaa',
                        },
                    },
                    {
                        'settings.name': {
                            $gt: null,
                        },
                    },
                ],
            });
        });

        it('NULL values are always the smallest for strings', async () => {
            await testMatch({
                tableDefinition,
                filters,
                rows: [
                    {
                        name: null,
                    },
                ],
                doNotMatch: [
                    {
                        name: {
                            $gt: '',
                        },
                    },
                    {
                        name: {
                            $gt: 'aaaa',
                        },
                    },
                    {
                        name: {
                            $gt: null,
                        },
                    },
                ],
            });
        });
    });
});
