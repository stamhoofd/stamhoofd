import { baseSQLFilterCompilers, createColumnFilter, SQLValueType } from '../../src/filters/SQLModernFilter';
import { SQL } from '../../src/SQL';
import { test } from '../utils';

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
            age: createColumnFilter(SQL.column('age'), { type: SQLValueType.Number, nullable: false }),
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
            age: createColumnFilter(SQL.column('age'), { type: SQLValueType.Number, nullable: false }),
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
            age: createColumnFilter(SQL.column('age'), { type: SQLValueType.Number, nullable: false }),
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
});
