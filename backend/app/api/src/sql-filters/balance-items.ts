import type { SQLFilterDefinitions } from '@stamhoofd/sql';
import { baseSQLFilterCompilers, createColumnFilter, createExistsFilter, SQL, SQLValueType } from '@stamhoofd/sql';
import { BalanceItemRelationType } from '@stamhoofd/structures';
import { paymentSettlementFilterCompilers } from './payment-settlement.js';

/**
 * Filters on the relations of a balance item (registration group, webshop order and membership type).
 *
 * Grouped separately from the plain column filters because these are JOIN/JSON based rather than simple
 * columns. They are spread into balanceItemFilterCompilers below, which is the single set consumed both
 * by the direct balance items endpoint and by the balance items nested inside payments (see
 * balance-item-payments.ts) — so both automatically expose these relation filters.
 *
 * All expressions are qualified with the balance_items table so they keep working when balance_items
 * is joined into another query (e.g. via balance_item_payments).
 */
export const balanceItemRelationFilterCompilers: SQLFilterDefinitions = {
    registration: createExistsFilter(
        SQL.select()
            .from(SQL.table('registrations'))
            .where(
                SQL.column('registrations', 'id'),
                SQL.column('balance_items', 'registrationId'),
            ),
        {
            ...baseSQLFilterCompilers,
            groupId: createColumnFilter({
                expression: SQL.column('registrations', 'groupId'),
                type: SQLValueType.String,
                nullable: false,
            }),
        },
    ),
    order: createExistsFilter(
        SQL.select()
            .from(SQL.table('webshop_orders'))
            .where(
                SQL.column('webshop_orders', 'id'),
                SQL.column('balance_items', 'orderId'),
            ),
        {
            ...baseSQLFilterCompilers,
            webshopId: createColumnFilter({
                expression: SQL.column('webshop_orders', 'webshopId'),
                type: SQLValueType.String,
                nullable: false,
            }),
        },
    ),
    // The membership type is only stored inside the relations JSON, so we read its id from there.
    membershipType: createColumnFilter({
        expression: SQL.jsonExtract(SQL.column('balance_items', 'relations'), `$.value.${BalanceItemRelationType.MembershipType}.id`),
        type: SQLValueType.JSONString,
        nullable: true,
    }),

    /**
     * Filter on the id of any relation, e.g. { relations: { Group: { id: '...' } } }.
     *
     * Used to narrow down to one category of a breakdown (see PaymentBreakdown), so every kind of
     * metadata a balance item carries is filterable without a dedicated compiler per relation.
     */
    relations: {
        ...baseSQLFilterCompilers,
        ...Object.fromEntries(
            Object.values(BalanceItemRelationType).map(relationType => [
                relationType,
                {
                    ...baseSQLFilterCompilers,
                    id: createColumnFilter({
                        expression: SQL.jsonExtract(SQL.column('balance_items', 'relations'), `$.value.${relationType}.id`),
                        type: SQLValueType.JSONString,
                        nullable: true,
                    }),
                },
            ]),
        ),
    },
};

/**
 * Defines how to filter balance items in the database from StamhoofdFilter objects
 */
export const balanceItemFilterCompilers: SQLFilterDefinitions = {
    ...baseSQLFilterCompilers,
    ...balanceItemRelationFilterCompilers,
    id: createColumnFilter({
        expression: SQL.column('balance_items', 'id'),
        type: SQLValueType.String,
        nullable: false,
    }),
    organizationId: createColumnFilter({
        expression: SQL.column('balance_items', 'organizationId'),
        type: SQLValueType.String,
        nullable: false,
    }),
    payingOrganizationId: createColumnFilter({
        expression: SQL.column('balance_items', 'payingOrganizationId'),
        type: SQLValueType.String,
        nullable: true,
    }),
    orderId: createColumnFilter({
        expression: SQL.column('balance_items', 'orderId'),
        type: SQLValueType.String,
        nullable: true,
    }),
    registrationId: createColumnFilter({
        expression: SQL.column('balance_items', 'registrationId'),
        type: SQLValueType.String,
        nullable: true,
    }),
    type: createColumnFilter({
        expression: SQL.column('balance_items', 'type'),
        type: SQLValueType.String,
        nullable: false,
    }),
    status: createColumnFilter({
        expression: SQL.column('balance_items', 'status'),
        type: SQLValueType.String,
        nullable: false,
    }),
    createdAt: createColumnFilter({
        expression: SQL.column('balance_items', 'createdAt'),
        type: SQLValueType.Datetime,
        nullable: false,
    }),
    updatedAt: createColumnFilter({
        expression: SQL.column('balance_items', 'updatedAt'),
        type: SQLValueType.Datetime,
        nullable: false,
    }),

    description: createColumnFilter({
        expression: SQL.column('balance_items', 'description'),
        type: SQLValueType.String,
        nullable: false,
    }),

    priceWithVAT: createColumnFilter({
        expression: SQL.column('balance_items', 'priceTotal'),
        type: SQLValueType.Number,
        nullable: false,
    }),

    priceOpen: createColumnFilter({
        expression: SQL.column('balance_items', 'priceOpen'),
        type: SQLValueType.Number,
        nullable: false,
    }),

    /**
     * The payments that paid (a part of) this balance item, e.g.
     * `{ payments: { $elemMatch: { payment: { settlement: { reference: '...' } } } } }`.
     *
     * Used to narrow a breakdown down to the balance items that were part of one payout (see
     * PaymentSettlementGroup): a balance item doesn't know how it was paid, its payments do.
     */
    payments: createExistsFilter(
        SQL.select()
            .from(SQL.table('balance_item_payments'))
            .join(
                SQL.join(SQL.table('payments')).where(
                    SQL.column('payments', 'id'),
                    SQL.column('balance_item_payments', 'paymentId'),
                ),
            )
            .where(
                SQL.column('balance_item_payments', 'balanceItemId'),
                SQL.column('balance_items', 'id'),
            ),
        {
            ...baseSQLFilterCompilers,
            price: createColumnFilter({
                expression: SQL.column('balance_item_payments', 'price'),
                type: SQLValueType.Number,
                nullable: false,
            }),
            payment: paymentSettlementFilterCompilers,
        },
    ),
};
