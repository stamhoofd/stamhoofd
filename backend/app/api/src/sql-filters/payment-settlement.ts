import type { SQLFilterDefinitions } from '@stamhoofd/sql';
import { baseSQLFilterCompilers, createColumnFilter, SQL, SQLValueType } from '@stamhoofd/sql';

/**
 * How a payment is selected by the payout it was part of (see PaymentSettlementGroup).
 *
 * Shared by the payments filters and by the balance items filters, which reach the same columns through
 * the payments that paid for them, so both select exactly the same payments.
 *
 * All expressions are qualified with the payments table so they keep working in a subquery that joins
 * payments (see balance-items.ts).
 */
export const paymentSettlementFilterCompilers: SQLFilterDefinitions = {
    ...baseSQLFilterCompilers,
    method: createColumnFilter({
        expression: SQL.column('payments', 'method'),
        type: SQLValueType.String,
        nullable: false,
    }),
    provider: createColumnFilter({
        expression: SQL.column('payments', 'provider'),
        type: SQLValueType.String,
        nullable: true,
    }),
    status: createColumnFilter({
        expression: SQL.column('payments', 'status'),
        type: SQLValueType.String,
        nullable: false,
    }),
    settlement: {
        ...baseSQLFilterCompilers,
        reference: createColumnFilter({
            expression: SQL.jsonExtract(SQL.column('payments', 'settlement'), '$.value.reference'),
            type: SQLValueType.JSONString,
            nullable: true,
        }),
        settledAt: createColumnFilter({
            expression: SQL.jsonExtract(SQL.column('payments', 'settlement'), '$.value.settledAt'),
            type: SQLValueType.JSONDate,
            nullable: true,
        }),
    },
};
