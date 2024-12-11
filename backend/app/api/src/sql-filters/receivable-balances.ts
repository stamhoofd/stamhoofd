import { SQLFilterDefinitions, baseSQLFilterCompilers, createSQLColumnFilterCompiler } from '@stamhoofd/sql';

/**
 * Defines how to filter cached balance items in the database from StamhoofdFilter objects
 */
export const receivableBalanceFilterCompilers: SQLFilterDefinitions = {
    ...baseSQLFilterCompilers,
    id: createSQLColumnFilterCompiler('id'),
    organizationId: createSQLColumnFilterCompiler('organizationId'),
    objectType: createSQLColumnFilterCompiler('objectType'),
    amount: createSQLColumnFilterCompiler('amount'),
    amountPending: createSQLColumnFilterCompiler('amountPending'),
    recalculateAt: createSQLColumnFilterCompiler('recalculateAt'),
};
