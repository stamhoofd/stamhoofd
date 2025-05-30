import { baseSQLFilterCompilers, createColumnFilter, SQLValueType } from '../../src/filters/SQLModernFilter';
import { SQL } from '../../src/SQL';
import { test } from '../utils';

describe('$and', () => {
    /**
     * Tests that should be repeated for all filter types
     */
    describe('Common checks', () => {
        // todo
    });

    it('Can be used with direct object child', async () => {
        const filters = {
            ...baseSQLFilterCompilers,
            name: createColumnFilter(SQL.column('name'), { type: SQLValueType.String, nullable: false }),
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
            ...baseSQLFilterCompilers,
            name: createColumnFilter(SQL.column('name'), { type: SQLValueType.String, nullable: false }),
            createdAt: createColumnFilter(SQL.column('createdAt'), { type: SQLValueType.Datetime, nullable: false }),
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
            ...baseSQLFilterCompilers,
            name: createColumnFilter(SQL.column('name'), { type: SQLValueType.String, nullable: false }),
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
            ...baseSQLFilterCompilers,
            name: createColumnFilter(SQL.column('name'), { type: SQLValueType.String, nullable: false }),
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
