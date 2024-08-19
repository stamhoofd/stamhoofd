import { SQL, SQLCast, SQLConcat, SQLFilterDefinitions, SQLJsonUnquote, SQLScalar, baseSQLFilterCompilers, createSQLColumnFilterCompiler, createSQLExpressionFilterCompiler, createSQLFilterNamespace, createSQLRelationFilterCompiler } from "@stamhoofd/sql";
import { balanceItemPaymentsCompilers } from "./balance-item-payments";

/**
 * Defines how to filter members in the database from StamhoofdFilter objects
 */
export const paymentFilterCompilers: SQLFilterDefinitions = {
    ...baseSQLFilterCompilers,
    id: createSQLColumnFilterCompiler('id'),
    method: createSQLColumnFilterCompiler('method'),
    status: createSQLColumnFilterCompiler('status'),
    organizationId: createSQLColumnFilterCompiler('organizationId'),
    createdAt: createSQLColumnFilterCompiler('createdAt'),
    updatedAt: createSQLColumnFilterCompiler('updatedAt'),
    paidAt: createSQLColumnFilterCompiler('paidAt', {nullable: true}),
    price: createSQLColumnFilterCompiler('price'),
    provider: createSQLColumnFilterCompiler('provider', {nullable: true}),
    customer: createSQLFilterNamespace({
        ...baseSQLFilterCompilers,
        email: createSQLExpressionFilterCompiler(
            SQL.jsonValue(SQL.column('customer'), '$.value.email'),
            {isJSONValue: true}
        ),
        firstName: createSQLExpressionFilterCompiler(
            SQL.jsonValue(SQL.column('customer'), '$.value.firstName'),
            {isJSONValue: true}
        ),
        lastName: createSQLExpressionFilterCompiler(
            SQL.jsonValue(SQL.column('customer'), '$.value.lastName'),
            {isJSONValue: true}
        ),
        name: createSQLExpressionFilterCompiler(
            new SQLCast(
                new SQLConcat(
                    new SQLJsonUnquote(SQL.jsonValue(SQL.column('customer'), '$.value.firstName')),
                    new SQLScalar(' '),
                    new SQLJsonUnquote(SQL.jsonValue(SQL.column('customer'), '$.value.lastName')),
                ),
                'CHAR'
            )
        ),
        company: createSQLFilterNamespace({
            name: createSQLExpressionFilterCompiler(
                SQL.jsonValue(SQL.column('customer'), '$.value.company.name'),
                {isJSONValue: true}
            ),
            VATNumber: createSQLExpressionFilterCompiler(
                SQL.jsonValue(SQL.column('customer'), '$.value.company.VATNumber'),
                {isJSONValue: true}
            ),
            companyNumber: createSQLExpressionFilterCompiler(
                SQL.jsonValue(SQL.column('customer'), '$.value.company.companyNumber'),
                {isJSONValue: true}
            ),
            administrationEmail: createSQLExpressionFilterCompiler(
                SQL.jsonValue(SQL.column('customer'), '$.value.company.administrationEmail'),
                {isJSONValue: true}
            ),
        })
    }),
    balanceItemPayments: createSQLRelationFilterCompiler(
        SQL.select()
        .from(
            SQL.table('balance_item_payments')
        ).join(
            SQL.join(
                SQL.table('balance_items')
            ).where(
                SQL.column('balance_items', 'id'),
                SQL.column('balance_item_payments', 'balanceItemId')
            )
        ).where(
            SQL.column('paymentId'),
            SQL.column('payments', 'id')
        ),
        balanceItemPaymentsCompilers
    ),
}