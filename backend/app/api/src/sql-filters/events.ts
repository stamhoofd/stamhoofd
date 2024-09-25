import { SQLFilterDefinitions, baseSQLFilterCompilers, createSQLColumnFilterCompiler, createSQLExpressionFilterCompiler, SQL, SQLValueType } from '@stamhoofd/sql';

export const eventFilterCompilers: SQLFilterDefinitions = {
    ...baseSQLFilterCompilers,
    'id': createSQLColumnFilterCompiler('id'),
    'name': createSQLColumnFilterCompiler('name'),
    'organizationId': createSQLColumnFilterCompiler('organizationId'),
    'startDate': createSQLColumnFilterCompiler('startDate'),
    'endDate': createSQLColumnFilterCompiler('endDate'),
    'groupIds': createSQLExpressionFilterCompiler(
        SQL.jsonValue(SQL.column('meta'), '$.value.groups[*].id'),
        { isJSONValue: true, isJSONObject: true },
    ),
    'defaultAgeGroupIds': createSQLExpressionFilterCompiler(
        SQL.jsonValue(SQL.column('meta'), '$.value.defaultAgeGroupIds'),
        { isJSONValue: true, isJSONObject: true },
    ),
    'organizationTagIds': createSQLExpressionFilterCompiler(
        SQL.jsonValue(SQL.column('meta'), '$.value.organizationTagIds'),
        { isJSONValue: true, isJSONObject: true },
    ),
    'meta.visible': createSQLExpressionFilterCompiler(
        SQL.jsonValue(SQL.column('meta'), '$.value.visible'),
        { isJSONValue: true, type: SQLValueType.JSONBoolean },
    ),
};
