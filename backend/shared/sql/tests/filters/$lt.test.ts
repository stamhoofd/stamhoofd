import { baseSQLFilterCompilers, createColumnFilter, SQLValueType } from '../../src/filters/SQLModernFilter';
import { SQL } from '../../src/SQL';
import { test } from '../utils';

describe('$lt', () => {
    /**
     * Tests that should be repeated for all filter types
     */
    describe('Common checks', () => {
        // todo
    });

    it('can filter on $lt', async () => {
        const filters = {
            ...baseSQLFilterCompilers,
            age: createColumnFilter(SQL.column('age'), { type: SQLValueType.Number, nullable: false }),
        };

        await test({
            filter: {
                age: {
                    $lt: 18,
                },
            },
            filters,
            query: {
                query: '`default`.`age` < ?',
                params: [18],
            },
        });
    });

    it('can invert $lt inside', async () => {
        const filters = {
            ...baseSQLFilterCompilers,
            age: createColumnFilter(SQL.column('age'), { type: SQLValueType.Number, nullable: false }),
        };

        await test({
            filter: {
                age: {
                    $not: {
                        $lt: 18,
                    },
                },
            },
            filters,
            query: {
                query: '`default`.`age` >= ?',
                params: [18],
            },
        });
    });

    it('can invert $lt outside', async () => {
        const filters = {
            ...baseSQLFilterCompilers,
            age: createColumnFilter(SQL.column('age'), { type: SQLValueType.Number, nullable: false }),
        };

        await test({
            filter: {
                $not: {
                    age: {
                        $lt: 18,
                    },
                },
            },
            filters,
            query: {
                query: '`default`.`age` >= ?',
                params: [18],
            },
        });
    });
});
