import { baseSQLFilterCompilers, createColumnFilter, createExistsFilter, SQLValueType } from '../../src/filters/SQLFilter.js';
import { SQL } from '../../src/SQL.js';
import { testSelect } from '../utils/index.js';

describe('Exists relations', () => {
    it('Added when used', async () => {
        const filters = {
            ...baseSQLFilterCompilers,
            name: createColumnFilter({ expression: SQL.column('name'), type: SQLValueType.String, nullable: false }),
            organizations: createExistsFilter(
                SQL.select()
                    .from('organizations', 'o')
                    .where(
                        SQL.parentColumn('organizationId'),
                        SQL.column('id'),
                    ),
                {
                    ...baseSQLFilterCompilers,
                    id: createColumnFilter({ expression: SQL.column('id'), type: SQLValueType.String, nullable: false }),
                }),
        };

        await testSelect({
            filter: [
                {
                    organizations: {
                        $elemMatch: {
                            id: '123',
                        },
                    },
                },
            ],
            filters,
            query: {
                query: 'SELECT `test_table`.* FROM `test_table` WHERE EXISTS (SELECT 1 FROM `organizations` `o` WHERE `test_table`.`organizationId` = `o`.`id` AND `o`.`id` = ?)',
                params: ['123'],
            },
        });
    });

    it('Also added when always true', async () => {
        const filters = {
            ...baseSQLFilterCompilers,
            name: createColumnFilter({ expression: SQL.column('name'), type: SQLValueType.String, nullable: false }),
            organizations: createExistsFilter(
                SQL.select()
                    .from('organizations', 'o')
                    .where(
                        SQL.parentColumn('organizationId'),
                        SQL.column('id'),
                    ),
                {
                    ...baseSQLFilterCompilers,
                    id: createColumnFilter({ expression: SQL.column('id'), type: SQLValueType.String, nullable: false }),
                }),
        };

        await testSelect({
            filter: [
                {
                    organizations: {
                        $elemMatch: {
                            id: {
                                $gte: null, // always true
                            },
                        },
                    },
                },
            ],
            filters,
            query: {
                query: 'SELECT `test_table`.* FROM `test_table` WHERE EXISTS (SELECT 1 FROM `organizations` `o` WHERE `test_table`.`organizationId` = `o`.`id`)',
                params: [],
            },
        });
    });

    it('Not added when always false', async () => {
        const filters = {
            ...baseSQLFilterCompilers,
            name: createColumnFilter({ expression: SQL.column('name'), type: SQLValueType.String, nullable: false }),
            organizations: createExistsFilter(
                SQL.select()
                    .from('organizations', 'o')
                    .where(
                        SQL.parentColumn('organizationId'),
                        SQL.column('id'),
                    ),
                {
                    ...baseSQLFilterCompilers,
                    id: createColumnFilter({ expression: SQL.column('id'), type: SQLValueType.String, nullable: false }),
                }),
        };

        await testSelect({
            filter: [
                {
                    organizations: {
                        $elemMatch: {
                            id: {
                                $lt: null, // always false
                            },
                        },
                    },
                },
            ],
            filters,
            query: {
                query: '',
                params: [],
            },
        });
    });
});
