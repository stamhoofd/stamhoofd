import { SQL, SQLFilterDefinitions, SQLValueType, baseSQLFilterCompilers, createSQLColumnFilterCompiler, createSQLExpressionFilterCompiler } from '@stamhoofd/sql';

export const groupFilterCompilers: SQLFilterDefinitions = {
    ...baseSQLFilterCompilers,
    id: createSQLColumnFilterCompiler(SQL.column('groups', 'id')),
    organizationId: createSQLColumnFilterCompiler(SQL.column('groups', 'organizationId')),
    name: createSQLExpressionFilterCompiler(
        SQL.jsonValue(SQL.column('groups', 'settings'), '$.value.name'),
        { isJSONValue: true, type: SQLValueType.JSONString },
    ),
    status: createSQLExpressionFilterCompiler(
        SQL.column('groups', 'status'),
        { isJSONValue: true, type: SQLValueType.JSONString },
    ),
    defaultAgeGroupId: createSQLColumnFilterCompiler(SQL.column('groups', 'defaultAgeGroupId'), { nullable: true }),

    /**
     * @todo
     * List of bundle discounts that have been added to this group or price
     */
    bundleDiscountIds: createSQLExpressionFilterCompiler(
        SQL.jsonKeys(
            SQL.jsonValue(SQL.column('groups', 'settings'), '$.value.prices[0].bundleDiscounts'),
        ),
        { isJSONValue: true, isJSONObject: true },
    ),
};
