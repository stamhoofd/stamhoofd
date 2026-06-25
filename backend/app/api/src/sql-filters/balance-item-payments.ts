import type { SQLFilterDefinitions } from '@stamhoofd/sql';
import { baseSQLFilterCompilers, createColumnFilter, createExistsFilter, SQL, SQLValueType } from '@stamhoofd/sql';

export const balanceItemPaymentsCompilers: SQLFilterDefinitions = {
    ...baseSQLFilterCompilers,
    id: createColumnFilter({
        expression: SQL.column('balance_item_payments', 'id'),
        type: SQLValueType.String,
        nullable: false,
    }),
    price: createColumnFilter({
        expression: SQL.column('balance_item_payments', 'price'),
        type: SQLValueType.Number,
        nullable: false,
    }),
    balanceItem: {
        ...baseSQLFilterCompilers,
        id: createColumnFilter({
            expression: SQL.column('balance_items', 'id'),
            type: SQLValueType.String,
            nullable: false,
        }),
        description: createColumnFilter({
            expression: SQL.column('balance_items', 'description'),
            type: SQLValueType.String,
            nullable: false,
        }),
        payingOrganizationId: createColumnFilter({
            expression: SQL.column('balance_items', 'payingOrganizationId'),
            type: SQLValueType.String,
            nullable: true,
        }),
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
    },
};
