import { baseSQLFilterCompilers, createColumnFilter, SQLValueType } from '../../src/filters/SQLModernFilter';
import { SQL } from '../../src/SQL';
import { test } from '../utils';

describe('$gte', () => {
    /**
     * Tests that should be repeated for all filter types
     */
    describe('Common checks', () => {
        // todo
    });

    it('can filter on $gte', async () => {
        const filters = {
            ...baseSQLFilterCompilers,
            age: createColumnFilter({ expression: SQL.column('age'), type: SQLValueType.Number, nullable: false }),
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
            ...baseSQLFilterCompilers,
            age: createColumnFilter({ expression: SQL.column('age'), type: SQLValueType.Number, nullable: false }),
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
            ...baseSQLFilterCompilers,
            age: createColumnFilter({ expression: SQL.column('age'), type: SQLValueType.Number, nullable: false }),
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
});
