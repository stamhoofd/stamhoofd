import { baseModernSQLFilterCompilers, createColumnFilter, SQLValueType } from '../../src/filters/SQLModernFilter';
import { SQL } from '../../src/SQL';
import { test } from '../utils';

describe('$not', () => {
    /**
     * Tests that should be repeated for all filter types
     */
    describe('Common checks', () => {
        // todo
    });

    it('is not null via $neq', async () => {
        const filters = {
            ...baseModernSQLFilterCompilers,
            name: createColumnFilter({ expression: SQL.column('name'), type: SQLValueType.String, nullable: true }),
        };

        await test({
            filter: {
                name: {
                    $neq: null,
                },
            },
            filters,
            query: {
                query: '`default`.`name` IS NOT NULL',
                params: [],
            },
        });
    });

    it('is not null via $not', async () => {
        const filters = {
            ...baseModernSQLFilterCompilers,
            name: createColumnFilter({ expression: SQL.column('name'), type: SQLValueType.String, nullable: true }),
        };

        await test({
            filter: {
                $not: {
                    name: null,
                },

            },
            filters,
            query: {
                query: '`default`.`name` IS NOT NULL',
                params: [],
            },
        });
    });
});
