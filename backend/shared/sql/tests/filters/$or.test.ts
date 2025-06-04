import { baseSQLFilterCompilers, createColumnFilter, SQLValueType } from '../../src/filters/SQLModernFilter';
import { SQL } from '../../src/SQL';
import { test } from '../utils';

describe('$or', () => {
    /**
     * Tests that should be repeated for all filter types
     */
    describe('Common checks', () => {
        // todo
    });

    it('$or object children are $and together', async () => {
        const filters = {
            ...baseSQLFilterCompilers,
            name: createColumnFilter({ expression: SQL.column('name'), type: SQLValueType.String, nullable: true }),
            age: createColumnFilter({ expression: SQL.column('age'), type: SQLValueType.Number, nullable: false }),
        };

        await test({
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
            query: {
                query: '(`default`.`name` = ? AND `default`.`age` = ?) OR (`default`.`name` = ? AND `default`.`age` = ?)',
                params: [
                    'john doe',
                    11,
                    'jane doe',
                    12,
                ],
            },
        });
    });

    it('empty $or branches are removed', async () => {
        const filters = {
            ...baseSQLFilterCompilers,
            name: createColumnFilter({ expression: SQL.column('name'), type: SQLValueType.String, nullable: false }),
        };

        await test({
            filter: {
                name: 'John Doe',
                $or: [
                    {
                        $or: [],
                    },
                    {
                        $not: {
                            $or: [],
                        },
                    },
                ],
            },
            filters,
            query: {
                query: '`default`.`name` = ?',
                params: ['john doe'],
            },
        });
    });

    it('deep $or branches are cleaned up', async () => {
        const filters = {
            ...baseSQLFilterCompilers,
            name: createColumnFilter({ expression: SQL.column('name'), type: SQLValueType.String, nullable: false }),
        };

        await test({
            filter: {
                $or: {
                    name: 'John Doe',
                    $or: [
                        {
                            $or: [
                                {
                                    name: 'Jane Doe',
                                },
                            ],
                        },
                    ],
                },
            },
            filters,
            query: {
                query: '`default`.`name` = ? OR `default`.`name` = ?',
                params: ['john doe', 'jane doe'],
            },
        });
    });
});
