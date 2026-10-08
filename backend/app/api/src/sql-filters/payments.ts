import { Payment } from '@stamhoofd/models';
import type { SQLFilterDefinitions } from '@stamhoofd/sql';
import { baseSQLFilterCompilers, createColumnFilter, createExistsFilter, createJoinedRelationFilter, SQL, SQLCast, SQLConcat, SQLJsonUnquote, SQLScalar, SQLValueType } from '@stamhoofd/sql';
import type { StamhoofdFilter } from '@stamhoofd/structures';
import { TransferSettings } from '@stamhoofd/structures';
import { balanceItemPaymentsCompilers } from './balance-item-payments.js';
import { organizationFilterCompilers } from './organizations.js';
import { paymentSettlementFilterCompilers } from './payment-settlement.js';

/**
 * Defines how to filter payments in the database from StamhoofdFilter objects
 *
 * All expressions are qualified with the payments table so they keep working when payments is joined
 * into another query instead of being selected from (see balance-item-payments-root.ts).
 */
export const paymentFilterCompilers: SQLFilterDefinitions = {
    ...baseSQLFilterCompilers,
    // method, provider, status and settlement
    ...paymentSettlementFilterCompilers,
    id: createColumnFilter({
        expression: SQL.column(Payment.table, 'id'),
        type: SQLValueType.String,
        nullable: false,
    }),
    type: createColumnFilter({
        expression: SQL.column(Payment.table, 'type'),
        type: SQLValueType.String,
        nullable: false,
    }),
    organizationId: createColumnFilter({
        expression: SQL.column(Payment.table, 'organizationId'),
        type: SQLValueType.String,
        nullable: true,
    }),
    payingOrganizationId: createColumnFilter({
        expression: SQL.column(Payment.table, 'payingOrganizationId'),
        type: SQLValueType.String,
        nullable: true,
    }),
    payingOrganization: createJoinedRelationFilter(
        SQL.join('organizations').where(SQL.column('organizations', 'id'), SQL.column(Payment.table, 'payingOrganizationId')),
        organizationFilterCompilers,
    ),
    invoiceId: createColumnFilter({
        expression: SQL.column(Payment.table, 'invoiceId'),
        type: SQLValueType.String,
        nullable: true,
    }),
    createdAt: createColumnFilter({
        expression: SQL.column(Payment.table, 'createdAt'),
        type: SQLValueType.Datetime,
        nullable: false,
    }),
    updatedAt: createColumnFilter({
        expression: SQL.column(Payment.table, 'updatedAt'),
        type: SQLValueType.Datetime,
        nullable: false,
    }),
    paidAt: createColumnFilter({
        expression: SQL.column(Payment.table, 'paidAt'),
        type: SQLValueType.Datetime,
        nullable: true,
    }),
    price: createColumnFilter({
        expression: SQL.column(Payment.table, 'price'),
        type: SQLValueType.Number,
        nullable: false,
    }),

    stripeAccountId: createColumnFilter({
        expression: SQL.column(Payment.table, 'stripeAccountId'),
        type: SQLValueType.String,
        nullable: true,
    }),

    /**
     * What a payment rounded away, which belongs to the payment as a whole instead of to one of the
     * things it paid for (see PaymentBreakdownBuilder.addRounding).
     */
    roundingAmount: createColumnFilter({
        expression: SQL.column(Payment.table, 'roundingAmount'),
        type: SQLValueType.Number,
        nullable: false,
    }),

    /**
     * The account a transfer was made to. Used to narrow a breakdown down to the money that arrived on
     * one account (see PaymentBreakdown).
     */
    transferSettings: {
        ...baseSQLFilterCompilers,
        iban: createColumnFilter({
            expression: SQL.jsonExtract(SQL.column(Payment.table, 'transferSettings'), '$.value.iban'),
            type: SQLValueType.JSONString,
            nullable: true,
        }),
        creditor: createColumnFilter({
            expression: SQL.jsonExtract(SQL.column(Payment.table, 'transferSettings'), '$.value.creditor'),
            type: SQLValueType.JSONString,
            nullable: true,
        }),
    },
    transferDescription: createColumnFilter({
        expression: SQL.column(Payment.table, 'transferDescription'),
        type: SQLValueType.String,
        nullable: true,
    }),
    hasInvoice: createColumnFilter({
        expression: SQL.isNull(SQL.column(Payment.table, 'invoiceId')),
        type: SQLValueType.Boolean,
        nullable: false,
    }),
    customer: {
        ...baseSQLFilterCompilers,
        email: createColumnFilter({
            expression: SQL.jsonExtract(SQL.column(Payment.table, 'customer'), '$.value.email'),
            type: SQLValueType.JSONString,
            nullable: true,
        }),
        firstName: createColumnFilter({
            expression: SQL.jsonExtract(SQL.column(Payment.table, 'customer'), '$.value.firstName'),
            type: SQLValueType.JSONString,
            nullable: true,
        }),
        lastName: createColumnFilter({
            expression: SQL.jsonExtract(SQL.column(Payment.table, 'customer'), '$.value.lastName'),
            type: SQLValueType.JSONString,
            nullable: true,
        }),
        name: createColumnFilter({
            expression: new SQLCast(
                new SQLConcat(
                    new SQLJsonUnquote(SQL.jsonExtract(SQL.column(Payment.table, 'customer'), '$.value.firstName')),
                    new SQLScalar(' '),
                    new SQLJsonUnquote(SQL.jsonExtract(SQL.column(Payment.table, 'customer'), '$.value.lastName')),
                ),
                'CHAR',
            ),
            type: SQLValueType.String,
            nullable: true,
        }),
        company: {
            ...baseSQLFilterCompilers,
            name: createColumnFilter({
                expression: SQL.jsonExtract(SQL.column(Payment.table, 'customer'), '$.value.company.name'),
                type: SQLValueType.JSONString,
                nullable: true,
            }),
            VATNumber: createColumnFilter({
                expression: SQL.jsonExtract(SQL.column(Payment.table, 'customer'), '$.value.company.VATNumber'),
                type: SQLValueType.JSONString,
                nullable: true,
            }),
            companyNumber: createColumnFilter({
                expression: SQL.jsonExtract(SQL.column(Payment.table, 'customer'), '$.value.company.companyNumber'),
                type: SQLValueType.JSONString,
                nullable: true,
            }),
            administrationEmail: createColumnFilter({
                expression: SQL.jsonExtract(SQL.column(Payment.table, 'customer'), '$.value.company.administrationEmail'),
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
                SQL.column('balance_item_payments', 'paymentId'),
                SQL.column('payments', 'id'),
            ),
        balanceItemPaymentsCompilers,
    ),
    // The stored payouts this payment was part of (the m2m rows, not the legacy JSON blob above)
    settlements: createExistsFilter(
        SQL.select()
            .from(
                SQL.table('payment_settlements'),
            ).join(
                SQL.join(
                    SQL.table('settlements'),
                ).where(
                    SQL.column('settlements', 'id'),
                    SQL.column('payment_settlements', 'settlementId'),
                ),
            ).where(
                SQL.column('payment_settlements', 'paymentId'),
                SQL.column('payments', 'id'),
            ),
        {
            ...baseSQLFilterCompilers,
            amount: createColumnFilter({
                expression: SQL.column('payment_settlements', 'amount'),
                type: SQLValueType.Number,
                nullable: false,
            }),
            externalId: createColumnFilter({
                expression: SQL.column('payment_settlements', 'externalId'),
                type: SQLValueType.String,
                nullable: false,
            }),
            occurredAt: createColumnFilter({
                expression: SQL.column('payment_settlements', 'occurredAt'),
                type: SQLValueType.Datetime,
                nullable: false,
            }),
            settlement: {
                ...baseSQLFilterCompilers,
                id: createColumnFilter({
                    expression: SQL.column('settlements', 'id'),
                    type: SQLValueType.String,
                    nullable: false,
                }),
                provider: createColumnFilter({
                    expression: SQL.column('settlements', 'provider'),
                    type: SQLValueType.String,
                    nullable: false,
                }),
                externalId: createColumnFilter({
                    expression: SQL.column('settlements', 'externalId'),
                    type: SQLValueType.String,
                    nullable: false,
                }),
                reference: createColumnFilter({
                    expression: SQL.column('settlements', 'reference'),
                    type: SQLValueType.String,
                    nullable: false,
                }),
                settledAt: createColumnFilter({
                    expression: SQL.column('settlements', 'settledAt'),
                    type: SQLValueType.Datetime,
                    nullable: false,
                }),
                amount: createColumnFilter({
                    expression: SQL.column('settlements', 'amount'),
                    type: SQLValueType.Number,
                    nullable: false,
                }),
                stripeAccountId: createColumnFilter({
                    expression: SQL.column('settlements', 'stripeAccountId'),
                    type: SQLValueType.String,
                    nullable: true,
                }),
            },
        },
    ),
};

/**
 * What a search term typed in a list of payments selects, as a filter on the payments table.
 *
 * Shared by everything that lists or exports payments, so a search always selects the same payments no
 * matter which of those it went through.
 */
export function getPaymentSearchFilter(search: string): StamhoofdFilter {
    const transferDescription = search.replaceAll('+', '').replaceAll('/', '');

    if (transferDescription.length === '562100153542'.length && !isNaN(parseInt(transferDescription))) {
        // A structured transfer reference is only ever meant to find that one payment
        return {
            transferDescription: TransferSettings.structureOGM(transferDescription),
        };
    }

    if (search.includes('@')) {
        return {
            $or: [
                { customer: { email: { $contains: search } } },
                { customer: { company: { administrationEmail: { $contains: search } } } },
            ],
        };
    }

    return {
        $or: [
            { customer: { name: { $contains: search } } },
            { customer: { company: { name: { $contains: search } } } },
            { balanceItemPayments: { $elemMatch: { balanceItem: { name: { $contains: search } } } } },
            { transferDescription: { $contains: search } },
        ],
    };
}
