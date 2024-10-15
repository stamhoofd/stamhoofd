import { baseSQLFilterCompilers, createSQLColumnFilterCompiler, createSQLExpressionFilterCompiler, SQL, SQLFilterDefinitions, SQLValueType } from '@stamhoofd/sql';

export const orderFilterCompilers: SQLFilterDefinitions = {
    ...baseSQLFilterCompilers,
    organizationId: createSQLColumnFilterCompiler('organizationId'),
    id: createSQLColumnFilterCompiler('id'),
    number: createSQLColumnFilterCompiler('number'),
    status: createSQLColumnFilterCompiler('status'),
    paymentMethod: createSQLExpressionFilterCompiler(
        SQL.jsonValue(SQL.column('data'), '$.value.paymentMethod'),
        { isJSONValue: true, type: SQLValueType.JSONString },
    ),
    checkoutMethod: createSQLExpressionFilterCompiler(
        SQL.jsonValue(SQL.column('data'), '$.value.checkoutMethod.type'),
        { isJSONValue: true, type: SQLValueType.JSONString },
    ),
    // 'startDate': createSQLColumnFilterCompiler('startDate'),
    // 'endDate': createSQLColumnFilterCompiler('endDate'),
    // 'groupIds': createSQLExpressionFilterCompiler(
    //     SQL.jsonValue(SQL.column('meta'), '$.value.groups[*].id'),
    //     { isJSONValue: true, isJSONObject: true },
    // ),
    // 'defaultAgeGroupIds': createSQLExpressionFilterCompiler(
    //     SQL.jsonValue(SQL.column('meta'), '$.value.defaultAgeGroupIds'),
    //     { isJSONValue: true, isJSONObject: true },
    // ),
    // 'organizationTagIds': createSQLExpressionFilterCompiler(
    //     SQL.jsonValue(SQL.column('meta'), '$.value.organizationTagIds'),
    //     { isJSONValue: true, isJSONObject: true },
    // ),
    // 'meta.visible': createSQLExpressionFilterCompiler(
    //     SQL.jsonValue(SQL.column('meta'), '$.value.visible'),
    //     { isJSONValue: true, type: SQLValueType.JSONBoolean },
    // ),
};
