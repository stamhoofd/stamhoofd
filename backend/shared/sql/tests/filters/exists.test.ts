import { baseModernSQLFilterCompilers, createColumnFilter, createExistsFilter, createJoinedRelationFilter, SQLValueType } from '../../src/filters/SQLModernFilter';
import { SQL } from '../../src/SQL';
import { testSelect } from '../utils';

describe('Exists relations', () => {
    const organizationJoin = SQL.leftJoin('organizations')
        .where(
            SQL.column('id'),
            SQL.parentColumn('organizationId'),
        );

    const organizationInnerJoin = SQL.innerJoin('organizations', 'o')
        .where(
            SQL.column('id'),
            SQL.parentColumn('organizationId'),
        );

    /**
     * Tests that should be repeated for all filter types
     */
    describe('Common checks', () => {
        // todo
    });

    it('Added when used', async () => {
        const filters = {
            ...baseModernSQLFilterCompilers,
            name: createColumnFilter({ expression: SQL.column('name'), type: SQLValueType.String, nullable: false }),
            organizations: createExistsFilter(
                SQL.select()
                    .from('organizations', 'o')
                    .where(
                        SQL.parentColumn('organizationId'),
                        SQL.column('id'),
                    ),
                {
                    ...baseModernSQLFilterCompilers,
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
                query: 'SELECT `test_table`.* FROM `test_table` WHERE EXISTS (SELECT `o`.* FROM `organizations` `o` WHERE `test_table`.`organizationId` = `o`.`id` AND `o`.`id` = ?)',
                params: ['123'],
            },
        });
    });

    it('Also added when always true', async () => {
        const filters = {
            ...baseModernSQLFilterCompilers,
            name: createColumnFilter({ expression: SQL.column('name'), type: SQLValueType.String, nullable: false }),
            organizations: createExistsFilter(
                SQL.select()
                    .from('organizations', 'o')
                    .where(
                        SQL.parentColumn('organizationId'),
                        SQL.column('id'),
                    ),
                {
                    ...baseModernSQLFilterCompilers,
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
                query: 'SELECT `test_table`.* FROM `test_table` WHERE EXISTS (SELECT `o`.* FROM `organizations` `o` WHERE `test_table`.`organizationId` = `o`.`id`)',
                params: [],
            },
        });
    });

    it('Not added when always false', async () => {
        const filters = {
            ...baseModernSQLFilterCompilers,
            name: createColumnFilter({ expression: SQL.column('name'), type: SQLValueType.String, nullable: false }),
            organizations: createExistsFilter(
                SQL.select()
                    .from('organizations', 'o')
                    .where(
                        SQL.parentColumn('organizationId'),
                        SQL.column('id'),
                    ),
                {
                    ...baseModernSQLFilterCompilers,
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
