import { SQLFilterDefinitions, baseSQLFilterCompilers, createSQLColumnFilterCompiler } from '@stamhoofd/sql';
import { EmailRelationFilterCompilers } from './shared/EmailRelationFilterCompilers';

/**
 * Defines how to filter cached balance items in the database from StamhoofdFilter objects
 */
export const receivableBalanceFilterCompilers: SQLFilterDefinitions = {
    ...baseSQLFilterCompilers,
    id: createSQLColumnFilterCompiler('id'),
    organizationId: createSQLColumnFilterCompiler('organizationId'),
    objectType: createSQLColumnFilterCompiler('objectType'),
    amountOpen: createSQLColumnFilterCompiler('amountOpen'),
    amountPending: createSQLColumnFilterCompiler('amountPending'),
    nextDueAt: createSQLColumnFilterCompiler('nextDueAt'),

    // Allowed to filter by recent emails
    ...EmailRelationFilterCompilers,
};
