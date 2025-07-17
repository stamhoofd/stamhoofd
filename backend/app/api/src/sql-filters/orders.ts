import { baseModernSQLFilterCompilers, createColumnFilter, SQL, SQLCast, SQLConcat, SQLJsonUnquote, SQLModernFilterDefinitions, SQLModernValueType, SQLScalar } from '@stamhoofd/sql';

export const orderFilterCompilers: SQLModernFilterDefinitions = {
    ...baseModernSQLFilterCompilers,
    // only backend (not useful to filter on these in the frontend)
    organizationId: createColumnFilter({
        expression: SQL.column('organizationId'),
        type: SQLModernValueType.String,
        nullable: false,
    }),
    updatedAt: createColumnFilter({
        expression: SQL.column('updatedAt'),
        type: SQLModernValueType.Datetime,
        nullable: false,
    }),

    // frontend and backend
    webshopId: createColumnFilter({
        expression: SQL.column('webshopId'),
        type: SQLModernValueType.String,
        nullable: false,
    }),
    id: createColumnFilter({
        expression: SQL.column('id'),
        type: SQLModernValueType.String,
        nullable: false,
    }),
    timeSlotEndTime: createColumnFilter({
        expression: SQL.jsonValue(SQL.column('data'), '$.value.timeSlot.endTime'),
        type: SQLModernValueType.JSONString,
        nullable: true,
    }),
    timeSlotStartTime: createColumnFilter({
        expression: SQL.jsonValue(SQL.column('data'), '$.value.timeSlot.startTime'),
        type: SQLModernValueType.JSONString,
        nullable: true,
    }),
    createdAt: createColumnFilter({
        expression: SQL.column('createdAt'),
        type: SQLModernValueType.Datetime,
        nullable: false,
    }),
    number: createColumnFilter({
        expression: SQL.column('number'),
        type: SQLModernValueType.Number,
        nullable: true,
    }),
    status: createColumnFilter({
        expression: SQL.column('status'),
        type: SQLModernValueType.String,
        nullable: false,
    }),
    paymentMethod: createColumnFilter({
        expression: SQL.jsonValue(SQL.column('data'), '$.value.paymentMethod'),
        type: SQLModernValueType.JSONString,
        nullable: false,
    }),
    checkoutMethod: createColumnFilter({
        expression: SQL.jsonValue(SQL.column('data'), '$.value.checkoutMethod.type'),
        type: SQLModernValueType.JSONString,
        nullable: true,
    }),
    timeSlotDate: createColumnFilter({
        expression: SQL.jsonValue(SQL.column('data'), '$.value.timeSlot.date'),
        type: SQLModernValueType.JSONString,
        nullable: true,
    }),
    validAt: createColumnFilter({
        expression: SQL.column('validAt'),
        type: SQLModernValueType.Datetime,
        nullable: true,
    }),
    name: createColumnFilter({
        expression: new SQLCast(
            new SQLConcat(
                new SQLJsonUnquote(SQL.jsonValue(SQL.column('data'), '$.value.customer.firstName')),
                new SQLScalar(' '),
                new SQLJsonUnquote(SQL.jsonValue(SQL.column('data'), '$.value.customer.lastName')),
            ),
            'CHAR'),
        type: SQLModernValueType.String,
        nullable: false,
    }),
    email: createColumnFilter({
        expression: SQL.jsonValue(SQL.column('data'), '$.value.customer.email'),
        type: SQLModernValueType.JSONString,
        nullable: false,
    }),
    phone: createColumnFilter({
        expression: SQL.jsonValue(SQL.column('data'), '$.value.customer.phone'),
        type: SQLModernValueType.JSONString,
        nullable: false,
    }),
    totalPrice: createColumnFilter({
        expression: SQL.column('totalPrice'),
        type: SQLModernValueType.Number,
        nullable: false,
    }),
    amount: createColumnFilter({
        expression: SQL.column('amount'),
        type: SQLModernValueType.Number,
        nullable: false,
    }),
    timeSlotTime: createColumnFilter({
        expression: SQL.column('timeSlotTime'),
        type: SQLModernValueType.Datetime,
        nullable: true,
    }),
};
