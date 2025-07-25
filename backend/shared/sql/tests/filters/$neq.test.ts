import { baseSQLFilterCompilers, createColumnFilter, SQLValueType } from '../../src/filters/SQLFilter';
import { SQL } from '../../src/SQL';
import { test } from '../utils';

describe('$neq', () => {
    /**
     * Tests that should be repeated for all filter types
     */
    describe('Common checks', () => {
        // todo
    });

    it('removes caps when filtering strings', async () => {
        const filters = {
            ...baseSQLFilterCompilers,
            name: createColumnFilter({ expression: SQL.column('name'), type: SQLValueType.String, nullable: false }),
        };

        await test({
            filter: {
                name: {
                    $neq: 'John Doe',
                },
            },
            filters,
            query: {
                query: '`default`.`name` != ?',
                params: ['john doe'],
            },
        });
    });
});
