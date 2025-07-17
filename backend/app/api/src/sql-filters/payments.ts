import { baseModernSQLFilterCompilers, createColumnFilter, createExistsFilter, SQL, SQLCast, SQLConcat, SQLJsonUnquote, SQLFilterDefinitions, SQLValueType, SQLScalar } from '@stamhoofd/sql';
import { balanceItemPaymentsCompilers } from './balance-item-payments';

/**
 * Defines how to filter payments in the database from StamhoofdFilter objects
 */
export const paymentFilterCompilers: SQLFilterDefinitions = {
    ...baseModernSQLFilterCompilers,
    id: createColumnFilter({
        expression: SQL.column('id'),
        type: SQLValueType.String,
        nullable: false,
    }),
    method: createColumnFilter({
        expression: SQL.column('method'),
        type: SQLValueType.String,
        nullable: false,
    }),
    status: createColumnFilter({
        expression: SQL.column('status'),
        type: SQLValueType.String,
        nullable: false,
    }),
    organizationId: createColumnFilter({
        expression: SQL.column('organizationId'),
        type: SQLValueType.String,
        nullable: true,
    }),
    createdAt: createColumnFilter({
        expression: SQL.column('createdAt'),
        type: SQLValueType.Datetime,
        nullable: false,
    }),
    updatedAt: createColumnFilter({
        expression: SQL.column('updatedAt'),
        type: SQLValueType.Datetime,
        nullable: false,
    }),
    paidAt: createColumnFilter({
        expression: SQL.column('paidAt'),
        type: SQLValueType.Datetime,
        nullable: true,
    }),
    price: createColumnFilter({
        expression: SQL.column('price'),
        type: SQLValueType.Number,
        nullable: false,
    }),
    provider: createColumnFilter({
        expression: SQL.column('provider'),
        type: SQLValueType.String,
        nullable: true,
    }),
    transferDescription: createColumnFilter({
        expression: SQL.column('transferDescription'),
        type: SQLValueType.String,
        nullable: true,
    }),
    customer: {
        ...baseModernSQLFilterCompilers,
        email: createColumnFilter({
            expression: SQL.jsonValue(SQL.column('customer'), '$.value.email'),
            type: SQLValueType.JSONString,
            nullable: true,
        }),
        firstName: createColumnFilter({
            expression: SQL.jsonValue(SQL.column('customer'), '$.value.firstName'),
            type: SQLValueType.JSONString,
            nullable: true,
        }),
        lastName: createColumnFilter({
            expression: SQL.jsonValue(SQL.column('customer'), '$.value.lastName'),
            type: SQLValueType.JSONString,
            nullable: true,
        }),
        name: createColumnFilter({
            expression: new SQLCast(
                new SQLConcat(
                    new SQLJsonUnquote(SQL.jsonValue(SQL.column('customer'), '$.value.firstName')),
                    new SQLScalar(' '),
                    new SQLJsonUnquote(SQL.jsonValue(SQL.column('customer'), '$.value.lastName')),
                ),
                'CHAR',
            ),
            type: SQLValueType.String,
            nullable: true,
        }),
        company: {
            ...baseModernSQLFilterCompilers,
            name: createColumnFilter({
                expression: SQL.jsonValue(SQL.column('customer'), '$.value.company.name'),
                type: SQLValueType.JSONString,
                nullable: true,
            }),
            VATNumber: createColumnFilter({
                expression: SQL.jsonValue(SQL.column('customer'), '$.value.company.VATNumber'),
                type: SQLValueType.JSONString,
                nullable: true,
            }),
            companyNumber: createColumnFilter({
                expression: SQL.jsonValue(SQL.column('customer'), '$.value.company.companyNumber'),
                type: SQLValueType.JSONString,
                nullable: true,
            }),
            administrationEmail: createColumnFilter({
                expression: SQL.jsonValue(SQL.column('customer'), '$.value.company.administrationEmail'),
                type: SQLValueType.JSONString,
                nullable: true,
            }),
        },
    },
    balanceItemPayments: createExistsFilter(
        SQL.select()
            .from(
                SQL.table('balance_item_payments'),
            ).join(
                SQL.join(
                    SQL.table('balance_items'),
                ).where(
                    SQL.column('balance_items', 'id'),
                    SQL.column('balance_item_payments', 'balanceItemId'),
                ),
            ).where(
                SQL.column('paymentId'),
                SQL.column('payments', 'id'),
            ),
        balanceItemPaymentsCompilers,
    ),
};
