import { baseSQLFilterCompilers, createColumnFilter, SQLValueType } from '../../src/filters/SQLFilter.js';
import { SQL } from '../../src/SQL.js';
import { test } from '../utils/index.js';

describe('$neq', () => {
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
