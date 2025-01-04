import { SQL, SQLFilterDefinitions, baseSQLFilterCompilers, createSQLColumnFilterCompiler, createSQLExpressionFilterCompiler } from '@stamhoofd/sql';
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
    lastReminderEmail: createSQLColumnFilterCompiler('lastReminderEmail'),
    reminderEmailCount: createSQLColumnFilterCompiler('reminderEmailCount'),
    reminderAmountIncreased: createSQLExpressionFilterCompiler(
        SQL.if(
            SQL.column('amountOpen'),
            '>',
            SQL.column('lastReminderAmountOpen'),
        ).then(1).else(0),
        { isJSONValue: false, isJSONObject: false },
    ),

    // Allowed to filter by recent emails
    ...EmailRelationFilterCompilers,
};
