import { baseModernSQLFilterCompilers, createColumnFilter, SQLModernValueType } from '../../src/filters/SQLModernFilter';
import { SQL } from '../../src/SQL';
import { test, testError } from '../utils';

describe('Special filter cases', () => {
    it('Can combine $and with $or', async () => {
        const filters = {
            ...baseModernSQLFilterCompilers,
            name: createColumnFilter({ expression: SQL.column('name'), type: SQLModernValueType.String, nullable: true }),
            age: createColumnFilter({ expression: SQL.column('age'), type: SQLModernValueType.Number, nullable: false }),
        };

        await test({
            filter: [
                {
                    $or: {
                        name: 'John Doe',
                        age: 11,
                    },
                },
                {
                    $and: [
                        {
                            age: 12,
                        },
                        {
                            name: 'Jane Doe',
                        },
                    ],
                },
            ],
            filters,
            query: {
                query: '(`default`.`name` = ? OR `default`.`age` = ?) AND `default`.`age` = ? AND `default`.`name` = ?',
                params: [
                    'john doe',
                    11,
                    12,
                    'jane doe',
                ],
            },
        });
    });

    it('Cannot filter on unknown columns', async () => {
        const filters = {
            ...baseModernSQLFilterCompilers,
        };

        await testError({
            filter: {
                name: 'John Doe',
            },
            filters,
            error: 'Unknown filter name',
        });
    });

    it('Cannot stack column filters', async () => {
        const filters = {
            ...baseModernSQLFilterCompilers,
            name: createColumnFilter({ expression: SQL.column('name'), type: SQLModernValueType.String, nullable: true }),
            age: createColumnFilter({ expression: SQL.column('age'), type: SQLModernValueType.Number, nullable: false }),
        };

        await testError({
            filter: {
                name: {
                    age: 12,
                },
            },
            filters,
            error: 'Unknown filter age',
        });
    });

    describe('Empty filters', () => {
        it('an empty object filter is always true', async () => {
            const filters = {
                ...baseModernSQLFilterCompilers,
            };

            await test({
                filter: {},
                filters,
                query: {
                    query: 'true',
                    params: [],
                },
            });
        });

        it('an empty array filter is always true', async () => {
            const filters = {
                ...baseModernSQLFilterCompilers,
            };

            await test({
                filter: [],
                filters,
                query: {
                    query: 'true',
                    params: [],
                },
            });
        });

        it('a null filter is always true', async () => {
            const filters = {
                ...baseModernSQLFilterCompilers,
            };

            await test({
                filter: null,
                filters,
                query: {
                    query: 'true',
                    params: [],
                },
            });
        });
    });
});
