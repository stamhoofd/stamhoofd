import { baseSQLFilterCompilers, createColumnFilter, SQLValueType } from '../../src/filters/SQLFilter';
import { SQL } from '../../src/SQL';
import { TableDefinition, test, testMatch, testMultipleErrors } from '../utils';

describe('$contains', () => {
    /**
     * Tests that should be repeated for all filter types
     */
    describe('Common checks', () => {
        // todo
    });

    it('Throws when passing non-string values', async () => {
        const filters = {
            ...baseSQLFilterCompilers,
            name: createColumnFilter({ expression: SQL.column('name'), type: SQLValueType.String, nullable: false }),
        };

        await testMultipleErrors({
            testFilters: [
                {
                    name: {
                        $contains: ['test'],
                    },
                },
            ],
            filters,
            error: 'Invalid compare value. Expected a string, number, boolean, date or null.',
        });

        await testMultipleErrors({
            testFilters: [
                {
                    name: {
                        $contains: 123,
                    },
                },
                {
                    name: {
                        $contains: true,
                    },
                },
            ],
            filters,
            error: 'Cannot compare',
        });

        await testMultipleErrors({
            testFilters: [
                {
                    name: {
                        $contains: null,
                    },
                },
            ],
            filters,
            error: 'Expected string at $contains filter',
        });
    });

    describe('Searching in native string columns', () => {
        it('Removes caps in the query', async () => {
            const filters = {
                ...baseSQLFilterCompilers,
                name: createColumnFilter({ expression: SQL.column('name'), type: SQLValueType.String, nullable: false }),
            };

            await test({
                filter: {
                    name: {
                        $contains: 'Caps Are Removed',
                    },
                },
                filters,
                query: {
                    query: '`default`.`name` LIKE ?',
                    params: ['%caps are removed%'],
                },
            });
        });

        it('Escapes percentage', async () => {
            const filters = {
                ...baseSQLFilterCompilers,
                name: createColumnFilter({ expression: SQL.column('name'), type: SQLValueType.String, nullable: false }),
            };

            await test({
                filter: {
                    name: {
                        $contains: '%',
                    },
                },
                filters,
                query: {
                    query: '`default`.`name` LIKE ?',
                    params: ['%\\%%'],
                },
            });
        });

        it('Escapes underscore', async () => {
            const filters = {
                ...baseSQLFilterCompilers,
                name: createColumnFilter({ expression: SQL.column('name'), type: SQLValueType.String, nullable: false }),
            };

            await test({
                filter: {
                    name: {
                        $contains: '_',
                    },
                },
                filters,
                query: {
                    query: '`default`.`name` LIKE ?',
                    params: ['%\\_%'],
                },
            });
        });

        it('Escapes backslash characters', async () => {
            const filters = {
                ...baseSQLFilterCompilers,
                name: createColumnFilter({ expression: SQL.column('name'), type: SQLValueType.String, nullable: false }),
            };

            await test({
                filter: {
                    name: {
                        $contains: '\\%',
                    },
                },
                filters,
                query: {
                    query: '`default`.`name` LIKE ?',
                    params: ['%\\\\\\%%'],
                },
            });
        });
    });

    describe('MySQL behaviour', () => {
        describe('Native MySQL strings', () => {
            const tableDefinition: TableDefinition = {
                name: {
                    type: 'varchar',
                    nullable: true,
                },
            };
            const filters = {
                ...baseSQLFilterCompilers,
                name: createColumnFilter({ expression: SQL.column('name'), type: SQLValueType.String, nullable: true }),
            };

            it('Can actually search for %', async () => {
                await testMatch({
                    tableDefinition,
                    filters,
                    rows: [
                        {
                            name: 'This contains 50% more',
                        },
                    ],
                    doMatch: [
                        {
                            name: {
                                $contains: '50%',
                            },
                        },
                        {
                            name: {
                                $contains: '0%',
                            },
                        },
                        {
                            name: {
                                $contains: '%',
                            },
                        },
                    ],
                    doNotMatch: [
                        {
                            name: {
                                $contains: '%%',
                            },
                        },
                        {
                            name: {
                                $contains: '%50',
                            },
                        },
                    ],
                });
            });

            it('Does not return values without % when filtering for %', async () => {
                await testMatch({
                    tableDefinition,
                    filters,
                    rows: [
                        {
                            name: 'This contains 50 percent more',
                        },
                    ],
                    doNotMatch: [
                        {
                            name: {
                                $contains: '%',
                            },
                        },
                    ],
                });
            });

            it('Can actually search for _', async () => {
                await testMatch({
                    tableDefinition,
                    filters,
                    rows: [
                        {
                            name: 'john_doe@example.com',
                        },
                    ],
                    doMatch: [
                        {
                            name: {
                                $contains: 'john_doe',
                            },
                        },
                        {
                            name: {
                                $contains: '_',
                            },
                        },
                        {
                            name: {
                                $contains: '_doe',
                            },
                        },
                    ],
                    doNotMatch: [
                        {
                            name: {
                                $contains: '__',
                            },
                        },
                        {
                            name: {
                                $contains: 'john__doe',
                            },
                        },
                    ],
                });
            });

            it('Does not return values without _ when filtering for _', async () => {
                await testMatch({
                    tableDefinition,
                    filters,
                    rows: [
                        {
                            name: 'johndoe@example.com',
                        },
                    ],
                    doNotMatch: [
                        {
                            name: {
                                $contains: '_',
                            },
                        },
                        {
                            name: {
                                $contains: 'john_',
                            },
                        },
                    ],
                });
            });

            it('Can search for backslash', async () => {
                await testMatch({
                    tableDefinition,
                    filters,
                    rows: [
                        {
                            name: 'john\\%doe',
                        },
                    ],
                    doMatch: [
                        {
                            name: {
                                $contains: '\\',
                            },
                        },
                        {
                            name: {
                                $contains: '\\%',
                            },
                        },
                    ],
                    doNotMatch: [
                        {
                            name: {
                                $contains: '\\_',
                            },
                        },
                        {
                            name: {
                                $contains: '\\\\',
                            },
                        },
                    ],
                });

                await testMatch({
                    tableDefinition,
                    filters,
                    rows: [
                        {
                            name: 'john\\doe',
                        },
                    ],
                    doNotMatch: [
                        {
                            name: {
                                $contains: '\\%',
                            },
                        },
                    ],
                });
            });
        });

        // Same, but for JSON strings:

        describe('JSON strings', () => {
            const tableDefinition: TableDefinition = {
                settings: {
                    type: 'json',
                    nullable: true,
                },
            };
            const filters = {
                ...baseSQLFilterCompilers,
                'settings.name': createColumnFilter({ expression: SQL.jsonExtract(SQL.column('settings'), '$.name'), type: SQLValueType.JSONString, nullable: false }),
            };

            it('Can actually search for %', async () => {
                await testMatch({
                    tableDefinition,
                    filters,
                    rows: [
                        {
                            settings: {
                                name: 'This contains 50% more',
                            },
                        },
                    ],
                    doMatch: [
                        {
                            'settings.name': {
                                $contains: '50%',
                            },
                        },
                        {
                            'settings.name': {
                                $contains: '0%',
                            },
                        },
                        {
                            'settings.name': {
                                $contains: '%',
                            },
                        },
                    ],
                    doNotMatch: [
                        {
                            'settings.name': {
                                $contains: '%%',
                            },
                        },
                        {
                            'settings.name': {
                                $contains: '%50',
                            },
                        },
                    ],
                });
            });

            it('Does not return values without % when filtering for %', async () => {
                await testMatch({
                    tableDefinition,
                    filters,
                    rows: [
                        {
                            settings: {
                                name: 'This contains 50 percent more',
                            },
                        },
                    ],
                    doNotMatch: [
                        {
                            'settings.name': {
                                $contains: '%',
                            },
                        },
                    ],
                });
            });

            it('Can actually search for _', async () => {
                await testMatch({
                    tableDefinition,
                    filters,
                    rows: [
                        {
                            settings: {
                                name: 'john_doe@example.com',
                            },
                        },
                    ],
                    doMatch: [
                        {
                            'settings.name': {
                                $contains: 'john_doe',
                            },
                        },
                        {
                            'settings.name': {
                                $contains: '_',
                            },
                        },
                        {
                            'settings.name': {
                                $contains: '_doe',
                            },
                        },
                    ],
                    doNotMatch: [
                        {
                            'settings.name': {
                                $contains: '__',
                            },
                        },
                        {
                            'settings.name': {
                                $contains: 'john__doe',
                            },
                        },
                    ],
                });
            });

            it('Does not return values without _ when filtering for _', async () => {
                await testMatch({
                    tableDefinition,
                    filters,
                    rows: [
                        {
                            settings: {
                                name: 'johndoe@example.com',
                            },
                        },
                    ],
                    doNotMatch: [
                        {
                            'settings.name': {
                                $contains: '_',
                            },
                        },
                        {
                            'settings.name': {
                                $contains: 'john_',
                            },
                        },
                    ],
                });
            });

            it('Can search for backslash', async () => {
                await testMatch({
                    tableDefinition,
                    filters,
                    rows: [
                        {
                            settings: {
                                name: 'john\\%doe',
                            },
                        },
                    ],
                    doMatch: [
                        {
                            'settings.name': {
                                $contains: '\\',
                            },
                        },
                        {
                            'settings.name': {
                                $contains: '\\%',
                            },
                        },
                    ],
                    doNotMatch: [
                        {
                            'settings.name': {
                                $contains: '\\_',
                            },
                        },
                        {
                            'settings.name': {
                                $contains: '\\\\',
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
                                name: 'john\\doe',
                            },
                        },
                    ],
                    doNotMatch: [
                        {
                            'settings.name': {
                                $contains: '\\%',
                            },
                        },
                    ],
                });
            });
        });

        describe('JSON arrays', () => {
            const tableDefinition: TableDefinition = {
                settings: {
                    type: 'json',
                    nullable: true,
                },
            };

            const filters = {
                ...baseSQLFilterCompilers,
                settings: {
                    ...baseSQLFilterCompilers,
                    names: createColumnFilter({ expression: SQL.jsonExtract(SQL.column('settings'), '$.names'), type: SQLValueType.JSONArray, nullable: false }),
                },
            };

            it('Can search in the array', async () => {
                await testMatch({
                    tableDefinition,
                    filters,
                    rows: [
                        {
                            settings: {
                                names: ['apple', 'BAnana', 'cherry'],
                            },
                        },
                    ],
                    doMatch: [
                        {
                            'settings.names': {
                                $contains: 'pple',
                            },
                        },
                        {
                            settings: {
                                names: {
                                    $contains: 'pple',
                                },
                            },
                        },
                        {
                            'settings.names': {
                                $contains: 'banana',
                            },
                        },
                        {
                            'settings.names': {
                                $contains: 'BAnana',
                            },
                        },
                    ],
                    doNotMatch: [
                        {
                            'settings.names': {
                                $contains: 'chrry',
                            },
                        },
                    ],
                });
            });

            it('Can search for % in the array', async () => {
                await testMatch({
                    tableDefinition,
                    filters,
                    rows: [
                        {
                            settings: {
                                names: ['apple', 'BAn%ana', 'cherry'],
                            },
                        },
                    ],
                    doMatch: [
                        {
                            'settings.names': {
                                $contains: '%',
                            },
                        },
                        {
                            'settings.names': {
                                $contains: 'BAn%ana',
                            },
                        },
                    ],
                    doNotMatch: [
                        {
                            'settings.names': {
                                $contains: 'BAnana',
                            },
                        },
                        {
                            'settings.names': {
                                $contains: '%%',
                            },
                        },
                    ],
                });
            });

            it('Can search for backslash in the array', async () => {
                await testMatch({
                    tableDefinition,
                    filters,
                    rows: [
                        {
                            settings: {
                                names: ['apple', 'BAn\\ana', 'cherry'],
                            },
                        },
                    ],
                    doMatch: [
                        {
                            'settings.names': {
                                $contains: '\\',
                            },
                        },
                        {
                            'settings.names': {
                                $contains: 'BAn\\ana',
                            },
                        },
                    ],
                    doNotMatch: [
                        {
                            'settings.names': {
                                $contains: 'BAnana',
                            },
                        },
                        {
                            'settings.names': {
                                $contains: '\\\\',
                            },
                        },
                    ],
                });
            });
        });

        describe('JSON wildcard arrays', () => {
            const tableDefinition: TableDefinition = {
                settings: {
                    type: 'json',
                    nullable: true,
                },
            };
            const filters = {
                ...baseSQLFilterCompilers,
                'settings.names': createColumnFilter({ expression: SQL.jsonExtract(SQL.column('settings'), '$.parents[*].name'), type: SQLValueType.JSONArray, nullable: false }),
            };

            it('Can search in the array', async () => {
                await testMatch({
                    tableDefinition,
                    filters,
                    rows: [
                        {
                            settings: {
                                parents: [
                                    { name: 'apple' },
                                    { name: 'BAnana' },
                                    { name: 'cherry' },
                                ],
                            },
                        },
                    ],
                    doMatch: [
                        {
                            'settings.names': {
                                $contains: 'pple',
                            },
                        },
                        {
                            'settings.names': {
                                $contains: 'banana',
                            },
                        },
                        {
                            'settings.names': {
                                $contains: 'BAnana',
                            },
                        },
                    ],
                    doNotMatch: [
                        {
                            'settings.names': {
                                $contains: 'chrry',
                            },
                        },
                    ],
                });
            });
        });
    });
});
