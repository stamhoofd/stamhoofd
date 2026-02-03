import { baseSQLFilterCompilers, createColumnFilter, SQL, SQLFilterDefinitions, SQLValueType } from '@stamhoofd/sql';

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
    },
};
