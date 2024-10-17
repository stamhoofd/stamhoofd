import { baseSQLFilterCompilers, createSQLColumnFilterCompiler, createSQLExpressionFilterCompiler, SQL, SQLFilterDefinitions, SQLValueType } from '@stamhoofd/sql';

export const orderFilterCompilers: SQLFilterDefinitions = {
    ...baseSQLFilterCompilers,
    updatedAt: createSQLColumnFilterCompiler('updatedAt'),
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
    timeSlotDate: createSQLExpressionFilterCompiler(
        SQL.jsonValue(SQL.column('data'), '$.value.timeSlot.date'),
        // todo: type?
        { isJSONValue: true, type: SQLValueType.JSONString },
    ),
    timeSlotStartTime: createSQLExpressionFilterCompiler(
        SQL.jsonValue(SQL.column('data'), '$.value.timeSlot.startTime'),
        // todo: type?
        { isJSONValue: true, type: SQLValueType.JSONString },
    ),
    timeSlotEndTime: createSQLExpressionFilterCompiler(
        SQL.jsonValue(SQL.column('data'), '$.value.timeSlot.endTime'),
        // todo: type?
        { isJSONValue: true, type: SQLValueType.JSONString },
    ),
    validAt: createSQLColumnFilterCompiler('validAt'),
};
