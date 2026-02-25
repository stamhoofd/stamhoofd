import { baseSQLFilterCompilers, createColumnFilter, SQLValueType } from '../../src/filters/SQLFilter.js';
import { SQL } from '../../src/SQL.js';
import { test } from '../utils/index.js';

describe('$or', () => {
    /**
     * Tests that should be repeated for all filter types
     */
    describe('Common checks', () => {
        // todo
    });

    it('If one child is always true, the whole $or is always true', async () => {
        const filters = {
            ...baseSQLFilterCompilers,
            name: createColumnFilter({ expression: SQL.column('name'), type: SQLValueType.String, nullable: true }),
        };

        await test({
            filter: {
                name: {
                    $or: {
                        $eq: 'John Doe',
                        $gte: null, // This will always be true
                    },
                },
            },
            filters,
            query: {
                query: 'true',
                params: [],
            },
        });
    });

    it('An empty $or is always false', async () => {
        const filters = {
            ...baseSQLFilterCompilers,
            name: createColumnFilter({ expression: SQL.column('name'), type: SQLValueType.String, nullable: true }),
        };

        await test({
            filter: {
                $or: {},
            },
            filters,
            query: {
                query: '',
                params: [],
            },
        });
    });

    it('If all children are always false, the whole $or is always false', async () => {
        const filters = {
            ...baseSQLFilterCompilers,
            name: createColumnFilter({ expression: SQL.column('name'), type: SQLValueType.String, nullable: true }),
        };

        await test({
            filter: {
                name: {
                    $or: [
                        {
                            $lt: null, // This will always be false
                        },
                        {
                            $in: [],
                        },
                    ],
                },
            },
            filters,
            query: {
                query: '',
                params: [],
            },
        });
    });

    it('Children that are always false are removed from the $or', async () => {
        const filters = {
            ...baseSQLFilterCompilers,
            name: createColumnFilter({ expression: SQL.column('name'), type: SQLValueType.String, nullable: false }),
        };

        await test({
            filter: {
                name: {
                    $or: [
                        { $eq: 'John Doe' },
                        { $lt: null },
                        { $in: [] },
                        { $neq: 'test' },
                    ],
                },
            },
            filters,
            query: {
                query: '`default`.`name` = ? OR `default`.`name` != ?',
                params: ['john doe', 'test'],
            },
        });
    });

    it('$or object children are $and together', async () => {
        const filters = {
            ...baseSQLFilterCompilers,
            name: createColumnFilter({ expression: SQL.column('name'), type: SQLValueType.String, nullable: false }),
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
