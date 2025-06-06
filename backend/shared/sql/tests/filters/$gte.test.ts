import { baseModernSQLFilterCompilers, createColumnFilter, SQLModernValueType } from '../../src/filters/modern/SQLModernFilter';
import { SQL } from '../../src/SQL';
import { TableDefinition, test, testMatch } from '../utils';

describe('$gte', () => {
    /**
     * Tests that should be repeated for all filter types
     */
    describe('Common checks', () => {
        // todo
    });

    it('can filter on $gte', async () => {
        const filters = {
            ...baseModernSQLFilterCompilers,
            age: createColumnFilter({ expression: SQL.column('age'), type: SQLModernValueType.Number, nullable: false }),
        };

        await test({
            filter: {
                age: {
                    $gte: 18,
                },
            },
            filters,
            query: {
                query: '`default`.`age` >= ?',
                params: [18],
            },
        });
    });

    it('can invert $gte inside', async () => {
        const filters = {
            ...baseModernSQLFilterCompilers,
            age: createColumnFilter({ expression: SQL.column('age'), type: SQLModernValueType.Number, nullable: false }),
        };

        await test({
            filter: {
                age: {
                    $not: {
                        $gte: 18,
                    },
                },
            },
            filters,
            query: {
                query: '`default`.`age` < ?',
                params: [18],
            },
        });
    });

    it('can invert $gte outside', async () => {
        const filters = {
            ...baseModernSQLFilterCompilers,
            age: createColumnFilter({ expression: SQL.column('age'), type: SQLModernValueType.Number, nullable: false }),
        };

        await test({
            filter: {
                $not: {
                    age: {
                        $gte: 18,
                    },
                },
            },
            filters,
            query: {
                query: '`default`.`age` < ?',
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
            ...baseModernSQLFilterCompilers,
            'name': createColumnFilter(
                { expression: SQL.column('name'), type: SQLModernValueType.String, nullable: true },
            ),
            'age': createColumnFilter(
                { expression: SQL.column('age'), type: SQLModernValueType.Number, nullable: true },
            ),
            'settings.name': createColumnFilter({ expression: SQL.jsonValue(SQL.column('settings'), '$.name'), type: SQLModernValueType.JSONString, nullable: true },
            ),
            'settings': createColumnFilter({ expression: SQL.column('settings'), type: SQLModernValueType.JSONObject, nullable: true }),
            'settings.enabled': createColumnFilter({ expression: SQL.jsonValue(SQL.column('settings'), '$.enabled'), type: SQLModernValueType.JSONBoolean, nullable: true },
            ),
            'settings.age': createColumnFilter({ expression: SQL.jsonValue(SQL.column('settings'), '$.age'), type: SQLModernValueType.JSONNumber, nullable: true },
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
                            $gte: 'a',
                        },
                    },
                    {
                        name: {
                            $gte: 'alic',
                        },
                    },
                    {
                        name: {
                            $gte: 'Alic',
                        },
                    },

                    {
                        name: {
                            $gte: 'Alice',
                        },
                    },
                    {
                        name: {
                            $gte: 'aLice',
                        },
                    },
                    {
                        name: {
                            $gte: 'ALICE',
                        },
                    },
                    {
                        name: {
                            $gte: 'alice',
                        },
                    },
                ],
                doNotMatch: [
                    {
                        name: {
                            $gte: 'b',
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
                            $gte: 'a',
                        },
                    },
                    {
                        'settings.name': {
                            $gte: 'alic',
                        },
                    },
                    {
                        'settings.name': {
                            $gte: 'Alic',
                        },
                    },
                    {
                        'settings.name': {
                            $gte: 'Alice',
                        },
                    },
                    {
                        'settings.name': {
                            $gte: 'aLice',
                        },
                    },
                    {
                        'settings.name': {
                            $gte: 'ALICE',
                        },
                    },
                    {
                        'settings.name': {
                            $gte: 'alice',
                        },
                    },
                ],
                doNotMatch: [

                    {
                        'settings.name': {
                            $gte: 'b',
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
                            $gte: 9,
                        },
                    },
                    {
                        age: {
                            $gte: 0,
                        },
                    },
                    {
                        age: {
                            $gte: -9,
                        },
                    },
                    {
                        age: {
                            $gte: 1,
                        },
                    },
                    {
                        age: {
                            $gte: 10,
                        },
                    },
                ],
                doNotMatch: [
                    {
                        age: {
                            $gte: 12,
                        },
                    },
                    {
                        age: {
                            $gte: 20,
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
                            $gte: 10,
                        },
                    },
                    {
                        'settings.age': {
                            $gte: 9,
                        },
                    },
                    {
                        'settings.age': {
                            $gte: 0,
                        },
                    },
                    {
                        'settings.age': {
                            $gte: -9,
                        },
                    },
                    {
                        'settings.age': {
                            $gte: 1,
                        },
                    },
                ],
                doNotMatch: [
                    {
                        'settings.age': {
                            $gte: 12,
                        },
                    },
                    {
                        'settings.age': {
                            $gte: 20,
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
                            $gte: null,
                        },
                    },
                ],
                doNotMatch: [
                    {
                        'settings.age': {
                            $gte: -1000,
                        },
                    },
                    {
                        'settings.age': {
                            $gte: 0,
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
                            $gte: null,
                        },
                    },
                ],
                doNotMatch: [
                    {
                        'settings.name': {
                            $gte: '',
                        },
                    },
                    {
                        'settings.name': {
                            $gte: 'aaaa',
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
                            $gte: null,
                        },
                    },
                ],
                doNotMatch: [
                    {
                        name: {
                            $gte: '',
                        },
                    },
                    {
                        name: {
                            $gte: 'aaaa',
                        },
                    },
                ],
            });
        });
    });
});
