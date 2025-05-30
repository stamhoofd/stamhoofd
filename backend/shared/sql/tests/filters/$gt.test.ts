import { baseSQLFilterCompilers, createColumnFilter, SQLValueType } from '../../src/filters/SQLModernFilter';
import { SQL } from '../../src/SQL';
import { test } from '../utils';

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
            age: createColumnFilter(SQL.column('age'), { type: SQLValueType.Number, nullable: false }),
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
            age: createColumnFilter(SQL.column('age'), { type: SQLValueType.Number, nullable: false }),
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
            age: createColumnFilter(SQL.column('age'), { type: SQLValueType.Number, nullable: false }),
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
});
