import { baseModernSQLFilterCompilers, createColumnFilter, createJoinedRelationFilter, SQLModernValueType } from '../../src/filters/modern/SQLModernFilter';
import { SQL } from '../../src/SQL';
import { testSelect } from '../utils';

describe('Joined relations', () => {
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

    it('Joins when used', async () => {
        const filters = {
            ...baseModernSQLFilterCompilers,
            name: createColumnFilter({ expression: SQL.column('name'), type: SQLModernValueType.String, nullable: false }),
            organization: createJoinedRelationFilter(organizationJoin, {
                ...baseModernSQLFilterCompilers,
                id: createColumnFilter({ expression: SQL.column('id'), type: SQLModernValueType.String, nullable: false }),
            }),
        };

        await testSelect({
            filter: [
                {
                    organization: {
                        id: '123',
                    },
                },
            ],
            filters,
            query: {
                query: 'SELECT `test_table`.* FROM `test_table` LEFT JOIN `organizations` ON `organizations`.`id` = `test_table`.`organizationId` WHERE `organizations`.`id` = ?',
                params: ['123'],
            },
        });
    });

    it('Joins only once when used twice', async () => {
        const filters = {
            ...baseModernSQLFilterCompilers,
            name: createColumnFilter({ expression: SQL.column('name'), type: SQLModernValueType.String, nullable: false }),
            organization: createJoinedRelationFilter(organizationJoin, {
                ...baseModernSQLFilterCompilers,
                id: createColumnFilter({ expression: SQL.column('id'), type: SQLModernValueType.String, nullable: false }),
            }),
        };

        await testSelect({
            filter: [
                {
                    organization: {
                        id: '123',
                    },
                },
                {
                    organization: {
                        id: '124',
                    },
                },
            ],
            filters,
            query: {
                query: 'SELECT `test_table`.* FROM `test_table` LEFT JOIN `organizations` ON `organizations`.`id` = `test_table`.`organizationId` WHERE `organizations`.`id` = ? AND `organizations`.`id` = ?',
                params: ['123', '124'],
            },
        });
    });

    it('Does not left join when always true', async () => {
        const filters = {
            ...baseModernSQLFilterCompilers,
            name: createColumnFilter({ expression: SQL.column('name'), type: SQLModernValueType.String, nullable: false }),
            organization: createJoinedRelationFilter(organizationJoin, {
                ...baseModernSQLFilterCompilers,
                id: createColumnFilter({ expression: SQL.column('id'), type: SQLModernValueType.String, nullable: false }),
            }),
        };

        await testSelect({
            filter: [
                {
                    organization: {},
                },
            ],
            filters,
            query: {
                query: 'SELECT `test_table`.* FROM `test_table`',
                params: [],
            },
        });
    });

    it('Does inner join when always true and relationAlwaysExist is false', async () => {
        const filters = {
            ...baseModernSQLFilterCompilers,
            name: createColumnFilter({ expression: SQL.column('name'), type: SQLModernValueType.String, nullable: false }),
            organization: createJoinedRelationFilter(organizationInnerJoin, {
                ...baseModernSQLFilterCompilers,
                id: createColumnFilter({ expression: SQL.column('id'), type: SQLModernValueType.String, nullable: false }),
            }, { doesRelationAlwaysExist: false }),
        };

        await testSelect({
            filter: [
                {
                    organization: {
                        id: {
                            $gte: null, // always true
                        },
                    },
                },
            ],
            filters,
            query: {
                query: 'SELECT `test_table`.* FROM `test_table` JOIN `organizations` `o` ON `o`.`id` = `test_table`.`organizationId`',
                params: [],
            },
        });
    });

    it('Does inner join when always true and relationAlwaysExist is true', async () => {
        const filters = {
            ...baseModernSQLFilterCompilers,
            name: createColumnFilter({ expression: SQL.column('name'), type: SQLModernValueType.String, nullable: false }),
            organization: createJoinedRelationFilter(organizationInnerJoin, {
                ...baseModernSQLFilterCompilers,
                id: createColumnFilter({ expression: SQL.column('id'), type: SQLModernValueType.String, nullable: false }),
            }, { doesRelationAlwaysExist: true }),
        };

        await testSelect({
            filter: [
                {
                    organization: {
                        id: {
                            $gte: null, // always true
                        },
                    },
                },
            ],
            filters,
            query: {
                query: 'SELECT `test_table`.* FROM `test_table`',
                params: [],
            },
        });
    });

    it('Does not join when unused', async () => {
        const filters = {
            ...baseModernSQLFilterCompilers,
            name: createColumnFilter({ expression: SQL.column('name'), type: SQLModernValueType.String, nullable: false }),
            organization: createJoinedRelationFilter(organizationJoin, {
                ...baseModernSQLFilterCompilers,
                id: createColumnFilter({ expression: SQL.column('id'), type: SQLModernValueType.String, nullable: false }),
            }),
        };

        await testSelect({
            filter: [
                {
                    name: 'Test',
                },
            ],
            filters,
            query: {
                query: 'SELECT `test_table`.* FROM `test_table` WHERE `test_table`.`name` = ?',
                params: ['test'],
            },
        });
    });
});
