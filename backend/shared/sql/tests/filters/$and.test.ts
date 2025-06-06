import { baseModernSQLFilterCompilers, createColumnFilter, SQLValueType } from '../../src/filters/SQLModernFilter';
import { SQL } from '../../src/SQL';
import { test } from '../utils';

describe('$and', () => {
    /**
     * Tests that should be repeated for all filter types
     */
    describe('Common checks', () => {
        // todo
    });

    it('If one child is always false, the whole $and is always false', async () => {
        const filters = {
            ...baseModernSQLFilterCompilers,
            name: createColumnFilter({ expression: SQL.column('name'), type: SQLValueType.String, nullable: true }),
        };

        await test({
            filter: {
                name: {
                    $and: {
                        $eq: 'John Doe',
                        $lt: null, // This will always be false
                    },
                },
            },
            filters,
            query: {
                query: '',
                params: [],
            },
        });
    });

    it('An empty $and is always true', async () => {
        const filters = {
            ...baseModernSQLFilterCompilers,
            name: createColumnFilter({ expression: SQL.column('name'), type: SQLValueType.String, nullable: true }),
        };

        await test({
            filter: {
                $and: {},
            },
            filters,
            query: {
                query: 'true',
                params: [],
            },
        });
    });

    it('If all children are always true, the whole $and is always true', async () => {
        const filters = {
            ...baseModernSQLFilterCompilers,
            name: createColumnFilter({ expression: SQL.column('name'), type: SQLValueType.String, nullable: true }),
        };

        await test({
            filter: {
                name: {
                    $and: [
                        {
                            $gte: null, // This will always be true
                        },
                        {
                            $gte: null, // This will always be true
                        },
                    ],
                },
            },
            filters,
            query: {
                query: 'true',
                params: [],
            },
        });
    });

    it('Children that are always true are removed from the $and', async () => {
        const filters = {
            ...baseModernSQLFilterCompilers,
            name: createColumnFilter({ expression: SQL.column('name'), type: SQLValueType.String, nullable: true }),
        };

        await test({
            filter: {
                name: {
                    $and: [
                        { $eq: 'John Doe' },
                        { $gte: null },
                        { $gte: null },
                        { $and: [] },
                        { $neq: 'test' },
                    ],
                },
            },
            filters,
            query: {
                query: '`default`.`name` = ? AND `default`.`name` != ?',
                params: ['john doe', 'test'],
            },
        });
    });

    it('Can be used with direct object child', async () => {
        const filters = {
            ...baseModernSQLFilterCompilers,
            name: createColumnFilter({ expression: SQL.column('name'), type: SQLValueType.String, nullable: false }),
        };

        await test({
            filter: {
                name: {
                    $and: {
                        $eq: 'John Doe',
                        $neq: 'Jane Doe',
                    },
                },
            },
            filters,
            query: {
                query: '`default`.`name` = ? AND `default`.`name` != ?',
                params: ['john doe', 'jane doe'],
            },
        });
    });

    it('NOT (A AND B) is simplified to (NOT A or not B)', async () => {
        const filters = {
            ...baseModernSQLFilterCompilers,
            name: createColumnFilter({ expression: SQL.column('name'), type: SQLValueType.String, nullable: false }),
            createdAt: createColumnFilter({ expression: SQL.column('createdAt'), type: SQLValueType.Datetime, nullable: false }),
        };

        await test({
            filter: {
                $not: {
                    name: 'John Doe',
                    createdAt: new Date(),
                },
            },
            filters,
            query: {
                query: '`default`.`name` != ? OR `default`.`createdAt` != ?',
                params: ['john doe', new Date()],
            },
        });
    });

    it('empty $and branches are removed', async () => {
        const filters = {
            ...baseModernSQLFilterCompilers,
            name: createColumnFilter({ expression: SQL.column('name'), type: SQLValueType.String, nullable: false }),
        };

        await test({
            filter: {
                name: 'John Doe',
                $and: [
                    {},
                ],
            },
            filters,
            query: {
                query: '`default`.`name` = ?',
                params: ['john doe'],
            },
        });
    });

    it('deep $and branches are cleaned up', async () => {
        const filters = {
            ...baseModernSQLFilterCompilers,
            name: createColumnFilter({ expression: SQL.column('name'), type: SQLValueType.String, nullable: false }),
        };

        await test({
            filter: {
                name: 'John Doe',
                $and: [
                    {
                        $and: [
                            {
                                name: 'Jane Doe',
                            },
                        ],
                    },
                ],
            },
            filters,
            query: {
                query: '`default`.`name` = ? AND `default`.`name` = ?',
                params: ['john doe', 'jane doe'],
            },
        });
    });
});
