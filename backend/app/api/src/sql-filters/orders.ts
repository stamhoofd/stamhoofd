import { BalanceItem, BalanceItemPayment, Order, Payment } from '@stamhoofd/models';
import { baseSQLFilterCompilers, createAggregateExistsFilter, createColumnFilter, createExistsFilter, createWildcardColumnFilter, SQL, SQLCast, SQLConcat, SQLFilterDefinitions, SQLJsonExtract, SQLJsonUnquote, SQLScalar, SQLValueType } from '@stamhoofd/sql';

export const orderFilterCompilers: SQLFilterDefinitions = {
    ...baseSQLFilterCompilers,
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
        expression: SQL.jsonExtract(SQL.column('data'), '$.value.timeSlot.endTime'),
        type: SQLValueType.JSONString,
        nullable: true,
    }),
    timeSlotStartTime: createColumnFilter({
        expression: SQL.jsonExtract(SQL.column('data'), '$.value.timeSlot.startTime'),
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
        expression: SQL.jsonExtract(SQL.column('data'), '$.value.paymentMethod'),
        type: SQLValueType.JSONString,
        nullable: false,
    }),
    checkoutMethod: createColumnFilter({
        expression: SQL.jsonExtract(SQL.column('data'), '$.value.checkoutMethod.type'),
        type: SQLValueType.JSONString,
        nullable: true,
    }),
    timeSlotDate: createColumnFilter({
        expression: SQL.jsonExtract(SQL.column('data'), '$.value.timeSlot.date'),
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
                new SQLJsonUnquote(SQL.jsonExtract(SQL.column('data'), '$.value.customer.firstName')),
                new SQLScalar(' '),
                new SQLJsonUnquote(SQL.jsonExtract(SQL.column('data'), '$.value.customer.lastName')),
            ),
            'CHAR'),
        type: SQLValueType.String,
        nullable: false,
    }),
    email: createColumnFilter({
        expression: SQL.jsonExtract(SQL.column('data'), '$.value.customer.email'),
        type: SQLValueType.JSONString,
        nullable: false,
    }),
    phone: createColumnFilter({
        expression: SQL.jsonExtract(SQL.column('data'), '$.value.customer.phone'),
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
    groupedPayments: createAggregateExistsFilter(
        {
            baseSelect: SQL.select()
                .from(SQL.table(BalanceItem.table))
                .join(
                    SQL.join(SQL.table(BalanceItemPayment.table)).where(SQL.column(BalanceItemPayment.table, 'balanceItemId'), SQL.column(BalanceItem.table, 'id')),
                ).join(
                    SQL.join(SQL.table(Payment.table)).where(SQL.column(Payment.table, 'id'), SQL.column(BalanceItemPayment.table, 'paymentId')),
                )
                .where(SQL.column(Order.table, 'id'), SQL.column(BalanceItem.table, 'orderId')),
            groupByColumns: [SQL.column(BalanceItem.table, 'orderId')],
            where: {
                ...baseSQLFilterCompilers,
                status: createColumnFilter({
                    expression: SQL.column(Payment.table, 'status'),
                    type: SQLValueType.String,
                    nullable: false,
                }),

            },
            having: {
                ...baseSQLFilterCompilers,
                minPaidAt: createColumnFilter({
                    expression: SQL.aggregateColumn('MIN', SQL.column(Payment.table, 'paidAt')),
                    type: SQLValueType.Datetime,
                    nullable: true,
                }),

            },
        },
    ),
    items: createExistsFilter(
        /**
         * There is a bug in MySQL 8 that is fixed in 9.3
         * where EXISTS (select * from json_table(...)) does not work
         * To fix this, we do a double select with join inside the select
         * It is a bit slower, but it works for now.
         */
        SQL.select()
            .from('webshop_orders', 'innerOrders')
            .join(
                SQL.join(
                    SQL.jsonTable(
                        SQL.jsonExtract(SQL.column('innerOrders', 'data'), '$.value.cart.items'),
                        'items',
                    )
                        .addColumn(
                            'amount',
                            'INT',
                            '$.amount',
                        )
                        .addColumn(
                            'productId',
                            'TEXT',
                            '$.product.id',
                        )
                        .addColumn(
                            'productPriceId',
                            'TEXT',
                            '$.productPrice.id',
                        ),
                ),
            )
            .where(SQL.column('innerOrders', 'id'), SQL.column('webshop_orders', 'id')),
        {
            ...baseSQLFilterCompilers,
            amount: createColumnFilter({
                expression: SQL.column('items', 'amount'),
                type: SQLValueType.Number,
                nullable: false,
            }),
            product: {
                ...baseSQLFilterCompilers,
                id: createColumnFilter({
                    expression: SQL.column('items', 'productId'),
                    type: SQLValueType.String,
                    nullable: false,
                }),
            },
            productPrice: {
                ...baseSQLFilterCompilers,
                id: createColumnFilter({
                    expression: SQL.column('items', 'productPriceId'),
                    type: SQLValueType.String,
                    nullable: false,
                }),
            },
        },
    ),

    recordAnswers: createWildcardColumnFilter(
        (key: string) => ({
            expression: SQL.jsonExtract(SQL.column('data'), `$.value.recordAnswers.${SQLJsonExtract.escapePathComponent(key)}`, true),
            type: SQLValueType.JSONObject,
            nullable: true,
        }),
        (key: string) => ({
            ...baseSQLFilterCompilers,
            selected: createColumnFilter({
                expression: SQL.jsonExtract(SQL.column('data'), `$.value.recordAnswers.${SQLJsonExtract.escapePathComponent(key)}.selected`, true),
                type: SQLValueType.JSONBoolean,
                nullable: true,
            }),
            selectedChoice: {
                ...baseSQLFilterCompilers,
                id: createColumnFilter({
                    expression: SQL.jsonExtract(SQL.column('data'), `$.value.recordAnswers.${SQLJsonExtract.escapePathComponent(key)}.selectedChoice.id`, true),
                    type: SQLValueType.JSONString,
                    nullable: true,
                }),
            },
            selectedChoices: {
                ...baseSQLFilterCompilers,
                id: createColumnFilter({
                    expression: SQL.jsonExtract(SQL.column('data'), `$.value.recordAnswers.${SQLJsonExtract.escapePathComponent(key)}.selectedChoices[*].id`, true),
                    type: SQLValueType.JSONArray,
                    nullable: true,
                }),
            },
            value: createColumnFilter({
                expression: SQL.jsonExtract(SQL.column('data'), `$.value.recordAnswers.${SQLJsonExtract.escapePathComponent(key)}.value`, true),
                type: SQLValueType.JSONString,
                nullable: true,
            }),
        }),
    ),
};
