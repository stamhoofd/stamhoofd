import { baseModernSQLFilterCompilers, createColumnFilter, SQL, SQLCast, SQLConcat, SQLJsonUnquote, SQLFilterDefinitions, SQLValueType, SQLScalar } from '@stamhoofd/sql';

export const orderFilterCompilers: SQLFilterDefinitions = {
    ...baseModernSQLFilterCompilers,
    // only backend (not useful to filter on these in the frontend)
    organizationId: createColumnFilter({
        expression: SQL.column('organizationId'),
        type: SQLValueType.String,
        nullable: false,
    }),
    updatedAt: createColumnFilter({
        expression: SQL.column('updatedAt'),
        type: SQLValueType.Datetime,
        nullable: false,
    }),

    // frontend and backend
    webshopId: createColumnFilter({
        expression: SQL.column('webshopId'),
        type: SQLValueType.String,
        nullable: false,
    }),
    id: createColumnFilter({
        expression: SQL.column('id'),
        type: SQLValueType.String,
        nullable: false,
    }),
    timeSlotEndTime: createColumnFilter({
        expression: SQL.jsonValue(SQL.column('data'), '$.value.timeSlot.endTime'),
        type: SQLValueType.JSONString,
        nullable: true,
    }),
    timeSlotStartTime: createColumnFilter({
        expression: SQL.jsonValue(SQL.column('data'), '$.value.timeSlot.startTime'),
        type: SQLValueType.JSONString,
        nullable: true,
    }),
    createdAt: createColumnFilter({
        expression: SQL.column('createdAt'),
        type: SQLValueType.Datetime,
        nullable: false,
    }),
    number: createColumnFilter({
        expression: SQL.column('number'),
        type: SQLValueType.Number,
        nullable: true,
    }),
    status: createColumnFilter({
        expression: SQL.column('status'),
        type: SQLValueType.String,
        nullable: false,
    }),
    paymentMethod: createColumnFilter({
        expression: SQL.jsonValue(SQL.column('data'), '$.value.paymentMethod'),
        type: SQLValueType.JSONString,
        nullable: false,
    }),
    checkoutMethod: createColumnFilter({
        expression: SQL.jsonValue(SQL.column('data'), '$.value.checkoutMethod.type'),
        type: SQLValueType.JSONString,
        nullable: true,
    }),
    timeSlotDate: createColumnFilter({
        expression: SQL.jsonValue(SQL.column('data'), '$.value.timeSlot.date'),
        type: SQLValueType.JSONString,
        nullable: true,
    }),
    validAt: createColumnFilter({
        expression: SQL.column('validAt'),
        type: SQLValueType.Datetime,
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
        type: SQLValueType.String,
        nullable: false,
    }),
    email: createColumnFilter({
        expression: SQL.jsonValue(SQL.column('data'), '$.value.customer.email'),
        type: SQLValueType.JSONString,
        nullable: false,
    }),
    phone: createColumnFilter({
        expression: SQL.jsonValue(SQL.column('data'), '$.value.customer.phone'),
        type: SQLValueType.JSONString,
        nullable: false,
    }),
    totalPrice: createColumnFilter({
        expression: SQL.column('totalPrice'),
        type: SQLValueType.Number,
        nullable: false,
    }),
    amount: createColumnFilter({
        expression: SQL.column('amount'),
        type: SQLValueType.Number,
        nullable: false,
    }),
    timeSlotTime: createColumnFilter({
        expression: SQL.column('timeSlotTime'),
        type: SQLValueType.Datetime,
        nullable: true,
    }),
};
