import { baseSQLFilterCompilers, createColumnFilter, createExistsFilter, SQL, SQLCast, SQLConcat, SQLFilterDefinitions, SQLJsonUnquote, SQLScalar, SQLValueType } from '@stamhoofd/sql';
import { invoicedBalanceItemCompilers } from './invoiced-balance-items.js';

/**
 * Defines how to filter payments in the database from StamhoofdFilter objects
 */
export const invoiceFilterCompilers: SQLFilterDefinitions = {
    ...baseSQLFilterCompilers,
    id: createColumnFilter({
        expression: SQL.column('id'),
        type: SQLValueType.String,
        nullable: false,
    }),
    number: createColumnFilter({
        expression: SQL.column('number'),
        type: SQLValueType.String,
        nullable: true,
    }),

    organizationId: createColumnFilter({
        expression: SQL.column('organizationId'),
        type: SQLValueType.String,
        nullable: true,
    }),

    totalWithVAT: createColumnFilter({
        expression: SQL.column('totalWithVAT'),
        type: SQLValueType.Number,
        nullable: false,
    }),

    totalWithoutVAT: createColumnFilter({
        expression: SQL.column('totalWithoutVAT'),
        type: SQLValueType.Number,
        nullable: false,
    }),

    VATTotalAmount: createColumnFilter({
        expression: SQL.column('VATTotalAmount'),
        type: SQLValueType.Number,
        nullable: false,
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
    invoicedAt: createColumnFilter({
        expression: SQL.column('invoicedAt'),
        type: SQLValueType.Datetime,
        nullable: true,
    }),
    customer: {
        ...baseSQLFilterCompilers,
        email: createColumnFilter({
            expression: SQL.jsonExtract(SQL.column('customer'), '$.value.email'),
            type: SQLValueType.JSONString,
            nullable: true,
        }),
        firstName: createColumnFilter({
            expression: SQL.jsonExtract(SQL.column('customer'), '$.value.firstName'),
            type: SQLValueType.JSONString,
            nullable: true,
        }),
        lastName: createColumnFilter({
            expression: SQL.jsonExtract(SQL.column('customer'), '$.value.lastName'),
            type: SQLValueType.JSONString,
            nullable: true,
        }),
        name: createColumnFilter({
            expression: new SQLCast(
                new SQLConcat(
                    new SQLJsonUnquote(SQL.jsonExtract(SQL.column('customer'), '$.value.firstName')),
                    new SQLScalar(' '),
                    new SQLJsonUnquote(SQL.jsonExtract(SQL.column('customer'), '$.value.lastName')),
                ),
                'CHAR',
            ),
            type: SQLValueType.String,
            nullable: true,
        }),
        company: {
            ...baseSQLFilterCompilers,
            name: createColumnFilter({
                expression: SQL.jsonExtract(SQL.column('customer'), '$.value.company.name'),
                type: SQLValueType.JSONString,
                nullable: true,
            }),
            VATNumber: createColumnFilter({
                expression: SQL.jsonExtract(SQL.column('customer'), '$.value.company.VATNumber'),
                type: SQLValueType.JSONString,
                nullable: true,
            }),
            companyNumber: createColumnFilter({
                expression: SQL.jsonExtract(SQL.column('customer'), '$.value.company.companyNumber'),
                type: SQLValueType.JSONString,
                nullable: true,
            }),
            administrationEmail: createColumnFilter({
                expression: SQL.jsonExtract(SQL.column('customer'), '$.value.company.administrationEmail'),
                type: SQLValueType.JSONString,
                nullable: true,
            }),
        },
    },
    items: createExistsFilter(
        SQL.select()
            .from(
                SQL.table('invoiced_balance_items'),
            ).where(
                SQL.column('invoiceId'),
                SQL.parentColumn('id'),
            ),
        invoicedBalanceItemCompilers,
    ),
};
