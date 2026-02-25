import { baseSQLFilterCompilers, createColumnFilter, SQLValueType } from '../../src/filters/SQLFilter.js';
import { SQL } from '../../src/SQL.js';
import { TableDefinition, test, testMatch } from '../utils/index.js';

describe('$lt', () => {
    /**
     * Tests that should be repeated for all filter types
     */
    describe('Common checks', () => {
        // todo
    });

    it('can filter on $lt', async () => {
        const filters = {
            ...baseSQLFilterCompilers,
            age: createColumnFilter({ expression: SQL.column('age'), type: SQLValueType.Number, nullable: false }),
        };

        await test({
            filter: {
                age: {
                    $lt: 18,
                },
            },
            filters,
            query: {
                query: '`default`.`age` < ?',
                params: [18],
            },
        });
    });

    it('can invert $lt inside', async () => {
        const filters = {
            ...baseSQLFilterCompilers,
            age: createColumnFilter({ expression: SQL.column('age'), type: SQLValueType.Number, nullable: false }),
        };

        await test({
            filter: {
                age: {
                    $not: {
                        $lt: 18,
                    },
                },
            },
            filters,
            query: {
                query: '`default`.`age` >= ?',
                params: [18],
            },
        });
    });

    it('can invert $lt outside', async () => {
        const filters = {
            ...baseSQLFilterCompilers,
            age: createColumnFilter({ expression: SQL.column('age'), type: SQLValueType.Number, nullable: false }),
        };

        await test({
            filter: {
                $not: {
                    age: {
                        $lt: 18,
                    },
                },
            },
            filters,
            query: {
                query: '`default`.`age` >= ?',
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
                            $lt: 'b',
                        },
                    },
                    {
                        name: {
                            $lt: 'alicea',
                        },
                    },
                    {
                        name: {
                            $lt: 'Alicea',
                        },
                    },
                ],
                doNotMatch: [
                    {
                        name: {
                            $lt: 'Alice',
                        },
                    },
                    {
                        name: {
                            $lt: 'aLice',
                        },
                    },
                    {
                        name: {
                            $lt: 'ALICE',
                        },
                    },
                    {
                        name: {
                            $lt: 'alice',
                        },
                    },
                    {
                        name: {
                            $lt: 'a',
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
                            $lt: 'alicea',
                        },
                    },
                    {
                        'settings.name': {
                            $lt: 'Alicea',
                        },
                    },
                    {
                        'settings.name': {
                            $lt: 'ALICEA',
                        },
                    },
                ],
                doNotMatch: [
                    {
                        'settings.name': {
                            $lt: 'Alice',
                        },
                    },
                    {
                        'settings.name': {
                            $lt: 'aLice',
                        },
                    },
                    {
                        'settings.name': {
                            $lt: 'ALICE',
                        },
                    },
                    {
                        'settings.name': {
                            $lt: 'alice',
                        },
                    },
                    {
                        'settings.name': {
                            $lt: '',
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
                            $lt: 10,
                        },
                    },
                    {
                        age: {
                            $lt: 9,
                        },
                    },
                    {
                        age: {
                            $lt: 0,
                        },
                    },
                    {
                        age: {
                            $lt: -9,
                        },
                    },
                    {
                        age: {
                            $lt: 1,
                        },
                    },
                ],
                doMatch: [
                    {
                        age: {
                            $lt: 12,
                        },
                    },
                    {
                        age: {
                            $lt: 20,
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
                            $lt: 10,
                        },
                    },
                    {
                        'settings.age': {
                            $lt: 9,
                        },
                    },
                    {
                        'settings.age': {
                            $lt: 0,
                        },
                    },
                    {
                        'settings.age': {
                            $lt: -9,
                        },
                    },
                    {
                        'settings.age': {
                            $lt: 1,
                        },
                    },
                ],
                doMatch: [
                    {
                        'settings.age': {
                            $lt: 12,
                        },
                    },
                    {
                        'settings.age': {
                            $lt: 20,
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
                            $lt: -1000,
                        },
                    },
                    {
                        'settings.age': {
                            $lt: 0,
                        },
                    },
                ],
                doNotMatch: [
                    {
                        'settings.age': {
                            $lt: null,
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
                            $lt: 'aaaa',
                        },
                    },
                    {
                        'settings.name': {
                            $lt: '',
                        },
                    },
                ],
                doNotMatch: [
                    {
                        'settings.name': {
                            $lt: null,
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
                            $lt: '',
                        },
                    },
                    {
                        name: {
                            $lt: 'aaaa',
                        },
                    },
                ],
                doNotMatch: [
                    {
                        name: {
                            $lt: null,
                        },
                    },
                ],
            });
        });
    });
});
