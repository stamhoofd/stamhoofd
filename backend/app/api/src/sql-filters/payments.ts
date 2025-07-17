import { baseModernSQLFilterCompilers, createColumnFilter, createExistsFilter, SQL, SQLCast, SQLConcat, SQLJsonUnquote, SQLModernFilterDefinitions, SQLModernValueType, SQLScalar } from '@stamhoofd/sql';
import { balanceItemPaymentsCompilers } from './balance-item-payments';

/**
 * Defines how to filter payments in the database from StamhoofdFilter objects
 */
export const paymentFilterCompilers: SQLModernFilterDefinitions = {
    ...baseModernSQLFilterCompilers,
    id: createColumnFilter({
        expression: SQL.column('id'),
        type: SQLModernValueType.String,
        nullable: false,
    }),
    method: createColumnFilter({
        expression: SQL.column('method'),
        type: SQLModernValueType.String,
        nullable: false,
    }),
    status: createColumnFilter({
        expression: SQL.column('status'),
        type: SQLModernValueType.String,
        nullable: false,
    }),
    organizationId: createColumnFilter({
        expression: SQL.column('organizationId'),
        type: SQLModernValueType.String,
        nullable: true,
    }),
    createdAt: createColumnFilter({
        expression: SQL.column('createdAt'),
        type: SQLModernValueType.Datetime,
        nullable: false,
    }),
    updatedAt: createColumnFilter({
        expression: SQL.column('updatedAt'),
        type: SQLModernValueType.Datetime,
        nullable: false,
    }),
    paidAt: createColumnFilter({
        expression: SQL.column('paidAt'),
        type: SQLModernValueType.Datetime,
        nullable: true,
    }),
    price: createColumnFilter({
        expression: SQL.column('price'),
        type: SQLModernValueType.Number,
        nullable: false,
    }),
    provider: createColumnFilter({
        expression: SQL.column('provider'),
        type: SQLModernValueType.String,
        nullable: true,
    }),
    transferDescription: createColumnFilter({
        expression: SQL.column('transferDescription'),
        type: SQLModernValueType.String,
        nullable: true,
    }),
    customer: {
        ...baseModernSQLFilterCompilers,
        email: createColumnFilter({
            expression: SQL.jsonValue(SQL.column('customer'), '$.value.email'),
            type: SQLModernValueType.JSONString,
            nullable: true,
        }),
        firstName: createColumnFilter({
            expression: SQL.jsonValue(SQL.column('customer'), '$.value.firstName'),
            type: SQLModernValueType.JSONString,
            nullable: true,
        }),
        lastName: createColumnFilter({
            expression: SQL.jsonValue(SQL.column('customer'), '$.value.lastName'),
            type: SQLModernValueType.JSONString,
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
            type: SQLModernValueType.String,
            nullable: true,
        }),
        company: {
            ...baseModernSQLFilterCompilers,
            name: createColumnFilter({
                expression: SQL.jsonValue(SQL.column('customer'), '$.value.company.name'),
                type: SQLModernValueType.JSONString,
                nullable: true,
            }),
            VATNumber: createColumnFilter({
                expression: SQL.jsonValue(SQL.column('customer'), '$.value.company.VATNumber'),
                type: SQLModernValueType.JSONString,
                nullable: true,
            }),
            companyNumber: createColumnFilter({
                expression: SQL.jsonValue(SQL.column('customer'), '$.value.company.companyNumber'),
                type: SQLModernValueType.JSONString,
                nullable: true,
            }),
            administrationEmail: createColumnFilter({
                expression: SQL.jsonValue(SQL.column('customer'), '$.value.company.administrationEmail'),
                type: SQLModernValueType.JSONString,
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
