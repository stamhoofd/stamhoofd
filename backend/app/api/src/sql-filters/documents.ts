import { baseSQLFilterCompilers, createSQLColumnFilterCompiler, createSQLExpressionFilterCompiler, SQL, SQLFilterDefinitions, SQLValueType } from '@stamhoofd/sql';

export const documentFilterCompilers: SQLFilterDefinitions = {
    ...baseSQLFilterCompilers,
    id: createSQLColumnFilterCompiler('id'),
    description: createSQLExpressionFilterCompiler(
        SQL.jsonValue(SQL.column('data'), '$.value.description'),
        { isJSONValue: true, type: SQLValueType.JSONString },
    ),
    organizationId: createSQLColumnFilterCompiler('organizationId'),
    templateId: createSQLColumnFilterCompiler('templateId'),
    memberId: createSQLColumnFilterCompiler('memberId'),
    updatedAt: createSQLColumnFilterCompiler('updatedAt'),
    createdAt: createSQLColumnFilterCompiler('createdAt'),
    number: createSQLColumnFilterCompiler('number'),
    status: createSQLColumnFilterCompiler('status'),
};
