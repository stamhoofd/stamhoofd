import type { SQLFilterDefinitions } from '@stamhoofd/sql';
import { baseSQLFilterCompilers, createColumnFilter, SQL, SQLValueType } from '@stamhoofd/sql';
import { balanceItemFilterCompilers } from './balance-items.js';

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
    // Reuse the shared balance item filters (type, webshop, group, membership type, ...)
    balanceItem: balanceItemFilterCompilers,
};
