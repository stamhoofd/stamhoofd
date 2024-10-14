import { baseSQLFilterCompilers, createSQLColumnFilterCompiler, SQLFilterDefinitions } from '@stamhoofd/sql';

export const orderFilterCompilers: SQLFilterDefinitions = {
    ...baseSQLFilterCompilers,
    id: createSQLColumnFilterCompiler('id'),
    organizationId: createSQLColumnFilterCompiler('organizationId'),
    number: createSQLColumnFilterCompiler('number'),
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
