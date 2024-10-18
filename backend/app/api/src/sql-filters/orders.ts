import { baseSQLFilterCompilers, createSQLColumnFilterCompiler, createSQLExpressionFilterCompiler, SQL, SQLConcat, SQLFilterDefinitions, SQLScalar, SQLValueType } from '@stamhoofd/sql';

export const orderFilterCompilers: SQLFilterDefinitions = {
    ...baseSQLFilterCompilers,
    // only backend (not useful to filter on these in the frontend)
    organizationId: createSQLColumnFilterCompiler('organizationId'),
    updatedAt: createSQLColumnFilterCompiler('updatedAt'),

    // frontend and backend
    webshopId: createSQLColumnFilterCompiler('webshopId'),
    id: createSQLColumnFilterCompiler('id'),
    timeSlotEndTime: createSQLExpressionFilterCompiler(
        SQL.jsonValue(SQL.column('data'), '$.value.timeSlot.endTime'),
        // todo: type?
        { isJSONValue: true, type: SQLValueType.JSONString },
    ),
    timeSlotStartTime: createSQLExpressionFilterCompiler(
        SQL.jsonValue(SQL.column('data'), '$.value.timeSlot.startTime'),
        // todo: type?
        { isJSONValue: true, type: SQLValueType.JSONString },
    ),
    createdAt: createSQLColumnFilterCompiler('createdAt'),
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
    validAt: createSQLColumnFilterCompiler('validAt'),

    // todo: TEST!
    name: createSQLExpressionFilterCompiler(
        new SQLConcat(
            SQL.jsonValue(SQL.column('data'), '$.value.customer.firstName'),
            new SQLScalar(' '),
            SQL.jsonValue(SQL.column('data'), '$.value.customer.lastName'),
        ),
        // SQL.jsonValue(SQL.column('data'), '$.value.customer.name'),
        // todo: type?
        { isJSONValue: true, type: SQLValueType.JSONString },
    ),
    email: createSQLExpressionFilterCompiler(
        SQL.jsonValue(SQL.column('data'), '$.value.customer.email'),
        // todo: type?
        { isJSONValue: true, type: SQLValueType.JSONString },
    ),
    phone: createSQLExpressionFilterCompiler(
        SQL.jsonValue(SQL.column('data'), '$.value.customer.phone'),
        // todo: type?
        { isJSONValue: true, type: SQLValueType.JSONString },
    ),
    totalPrice: createSQLColumnFilterCompiler('totalPrice'),
    amount: createSQLColumnFilterCompiler('amount'),
    timeSlotTime: createSQLColumnFilterCompiler('timeSlotTime'),

    // only frontend
    // openBalance
    // location
};
