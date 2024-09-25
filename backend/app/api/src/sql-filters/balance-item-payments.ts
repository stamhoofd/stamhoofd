import { SQLFilterDefinitions, baseSQLFilterCompilers, createSQLColumnFilterCompiler, SQL, createSQLFilterNamespace } from '@stamhoofd/sql';

export const balanceItemPaymentsCompilers: SQLFilterDefinitions = {
    ...baseSQLFilterCompilers,
    id: createSQLColumnFilterCompiler(SQL.column('balance_item_payments', 'id')),
    price: createSQLColumnFilterCompiler(SQL.column('balance_item_payments', 'price')),

    balanceItem: createSQLFilterNamespace({
        ...baseSQLFilterCompilers,
        id: createSQLColumnFilterCompiler(SQL.column('balance_items', 'id')),
        description: createSQLColumnFilterCompiler(SQL.column('balance_items', 'description')),
    }),
};
