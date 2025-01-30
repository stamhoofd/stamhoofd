import { SQL, SQLFilterDefinitions, baseSQLFilterCompilers, createSQLColumnFilterCompiler, createSQLExpressionFilterCompiler, createSQLRelationFilterCompiler } from '@stamhoofd/sql';
import { memberFilterCompilers } from './members';
import { organizationFilterCompilers } from './organizations';
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
    organizations: createSQLRelationFilterCompiler(
        SQL.select()
            .from(SQL.table('organizations'))
            .where(
                SQL.column(
                    'organizations',
                    'id',
                ),
                SQL.column('cached_outstanding_balances', 'objectId'),
            ).where(
                SQL.column('cached_outstanding_balances', 'objectType'),
                'organization'),
        organizationFilterCompilers,
    ),
    members: createSQLRelationFilterCompiler(
        SQL.select()
            .from(SQL.table('members'))
            .where(
                SQL.column(
                    'members',
                    'id',
                ),
                SQL.column('cached_outstanding_balances', 'objectId'),
            ).where(
                SQL.column('cached_outstanding_balances', 'objectType'),
                'member'),
        memberFilterCompilers,
    ),

    // Allowed to filter by recent emails
    ...EmailRelationFilterCompilers,
};
