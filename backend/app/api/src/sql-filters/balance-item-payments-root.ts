import type { SQLFilterDefinitions } from '@stamhoofd/sql';
import { baseSQLFilterCompilers, createColumnFilter, SQL, SQLValueType } from '@stamhoofd/sql';
import { balanceItemPaymentsCompilers } from './balance-item-payments.js';
import { paymentFilterCompilers } from './payments.js';

/**
 * How a balance item payment is selected when it is queried directly, instead of through the payment or
 * the balance item it belongs to.
 *
 * This is the level at which money that is spread over several payments, or that paid for several
 * things at once, can be selected exactly: one row is one payment paying one part of one balance item.
 *
 * Lives in its own file because it reaches both parents, while balance-item-payments.ts is used inside
 * a subquery that only joins the balance items.
 */
export const balanceItemPaymentRootFilterCompilers: SQLFilterDefinitions = {
    ...baseSQLFilterCompilers,
    // id, price and the balance item filters
    ...balanceItemPaymentsCompilers,

    organizationId: createColumnFilter({
        expression: SQL.column('balance_item_payments', 'organizationId'),
        type: SQLValueType.String,
        nullable: false,
    }),

    paymentId: createColumnFilter({
        expression: SQL.column('balance_item_payments', 'paymentId'),
        type: SQLValueType.String,
        nullable: false,
    }),

    balanceItemId: createColumnFilter({
        expression: SQL.column('balance_item_payments', 'balanceItemId'),
        type: SQLValueType.String,
        nullable: false,
    }),

    createdAt: createColumnFilter({
        expression: SQL.column('balance_item_payments', 'createdAt'),
        type: SQLValueType.Datetime,
        nullable: false,
    }),

    // The same compilers the payments use, which are qualified with the payments table so they keep
    // working here: this query joins it instead of selecting from it
    payment: paymentFilterCompilers,
};
