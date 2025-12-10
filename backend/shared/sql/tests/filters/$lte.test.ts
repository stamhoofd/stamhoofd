import { baseSQLFilterCompilers, createColumnFilter, SQLValueType } from '../../src/filters/SQLFilter';
import { SQL } from '../../src/SQL';
import { TableDefinition, test, testMatch } from '../utils';

describe('$lte', () => {
    /**
     * Tests that should be repeated for all filter types
     */
    describe('Common checks', () => {
        // todo
    });

    it('can filter on $lte', async () => {
        const filters = {
            ...baseSQLFilterCompilers,
            age: createColumnFilter({ expression: SQL.column('age'), type: SQLValueType.Number, nullable: false }),
        };

        await test({
            filter: {
                age: {
                    $lte: 18,
                },
            },
            filters,
            query: {
                query: '`default`.`age` <= ?',
                params: [18],
            },
        });
    });

    it('can invert $lte inside', async () => {
        const filters = {
            ...baseSQLFilterCompilers,
            age: createColumnFilter({ expression: SQL.column('age'), type: SQLValueType.Number, nullable: false }),
        };

        await test({
            filter: {
                age: {
                    $not: {
                        $lte: 18,
                    },
                },
            },
            filters,
            query: {
                query: '`default`.`age` > ?',
                params: [18],
            },
        });
    });

    it('can invert $lte outside', async () => {
        const filters = {
            ...baseSQLFilterCompilers,
            age: createColumnFilter({ expression: SQL.column('age'), type: SQLValueType.Number, nullable: false }),
        };

        await test({
            filter: {
                $not: {
                    age: {
                        $lte: 18,
                    },
                },
            },
            filters,
            query: {
                query: '`default`.`age` > ?',
                params: [18],
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
                            $lte: 'b',
                        },
                    },
                    {
                        name: {
                            $lte: 'alicea',
                        },
                    },
                    {
                        name: {
                            $lte: 'Alicea',
                        },
                    },
                    {
                        name: {
                            $lte: 'Alice',
                        },
                    },
                    {
                        name: {
                            $lte: 'aLice',
                        },
                    },
                    {
                        name: {
                            $lte: 'ALICE',
                        },
                    },
                    {
                        name: {
                            $lte: 'alice',
                        },
                    },
                ],
                doNotMatch: [
                    {
                        name: {
                            $lte: '',
                        },
                    },
                    {
                        name: {
                            $lte: 'a',
                        },
                    },
                    {
                        name: {
                            $lte: 'Alic',
                        },
                    },
                    {
                        name: {
                            $lte: 'alic',
                        },
                    },
                ],
            });
        });

        it('Comparing JSON string values is case sensitive', async () => {
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
                            $lte: 'alicea',
                        },
                    },
                    {
                        'settings.name': {
                            $lte: 'Alicea',
                        },
                    },
                    {
                        'settings.name': {
                            $lte: 'ALICEA',
                        },
                    },
                    {
                        'settings.name': {
                            $lte: 'Alice',
                        },
                    },
                    {
                        'settings.name': {
                            $lte: 'aLice',
                        },
                    },
                    {
                        'settings.name': {
                            $lte: 'ALICE',
                        },
                    },
                    {
                        'settings.name': {
                            $lte: 'alice',
                        },
                    },
                ],
                doNotMatch: [
                    {
                        'settings.name': {
                            $lte: '',
                        },
                    },
                    {
                        'settings.name': {
                            $lte: 'a',
                        },
                    },
                    {
                        'settings.name': {
                            $lte: 'Alic',
                        },
                    },
                    {
                        'settings.name': {
                            $lte: 'alic',
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
                doNotMatch: [
                    {
                        age: {
                            $lte: 9,
                        },
                    },
                    {
                        age: {
                            $lte: 0,
                        },
                    },
                    {
                        age: {
                            $lte: -9,
                        },
                    },
                    {
                        age: {
                            $lte: 1,
                        },
                    },
                ],
                doMatch: [
                    {
                        age: {
                            $lte: 10,
                        },
                    },
                    {
                        age: {
                            $lte: 10.1,
                        },
                    },
                    {
                        age: {
                            $lte: 12,
                        },
                    },
                    {
                        age: {
                            $lte: 20,
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
                doNotMatch: [
                    {
                        'settings.age': {
                            $lte: 9,
                        },
                    },
                    {
                        'settings.age': {
                            $lte: 0,
                        },
                    },
                    {
                        'settings.age': {
                            $lte: -9,
                        },
                    },
                    {
                        'settings.age': {
                            $lte: 1,
                        },
                    },
                ],
                doMatch: [
                    {
                        'settings.age': {
                            $lte: 10,
                        },
                    },
                    {
                        'settings.age': {
                            $lte: 10.1,
                        },
                    },
                    {
                        'settings.age': {
                            $lte: 12,
                        },
                    },
                    {
                        'settings.age': {
                            $lte: 20,
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
                doMatch: [
                    {
                        'settings.age': {
                            $lte: -1000,
                        },
                    },
                    {
                        'settings.age': {
                            $lte: 0,
                        },
                    },
                    {
                        'settings.age': {
                            $lte: null,
                        },
                    },
                    {
                        'settings.age': {
                            $lte: 1000000,
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
                doMatch: [
                    {
                        'settings.name': {
                            $lte: 'aaaa',
                        },
                    },
                    {
                        'settings.name': {
                            $lte: '',
                        },
                    },
                    {
                        'settings.name': {
                            $lte: null,
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
                doMatch: [
                    {
                        name: {
                            $lte: '',
                        },
                    },
                    {
                        name: {
                            $lte: 'aaaa',
                        },
                    },
                    {
                        name: {
                            $lte: null,
                        },
                    },
                ],
            });
        });
    });
});
