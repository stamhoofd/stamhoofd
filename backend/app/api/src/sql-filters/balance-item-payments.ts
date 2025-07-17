import { baseModernSQLFilterCompilers, createColumnFilter, SQL, SQLModernFilterDefinitions, SQLModernValueType } from '@stamhoofd/sql';

export const balanceItemPaymentsCompilers: SQLModernFilterDefinitions = {
    ...baseModernSQLFilterCompilers,
    id: createColumnFilter({
        expression: SQL.column('balance_item_payments', 'id'),
        type: SQLModernValueType.String,
        nullable: false,
    }),
    price: createColumnFilter({
        expression: SQL.column('balance_item_payments', 'price'),
        type: SQLModernValueType.Number,
        nullable: false,
    }),
    balanceItem: {
        ...baseModernSQLFilterCompilers,
        id: createColumnFilter({
            expression: SQL.column('balance_items', 'id'),
            type: SQLModernValueType.String,
            nullable: false,
        }),
        description: createColumnFilter({
            expression: SQL.column('balance_items', 'description'),
            type: SQLModernValueType.String,
            nullable: false,
        }),
    },
};
