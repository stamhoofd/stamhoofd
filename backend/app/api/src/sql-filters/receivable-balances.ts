import { baseModernSQLFilterCompilers, createColumnFilter, createExistsFilter, SQL, SQLConcat, SQLModernFilterDefinitions, SQLModernValueType, SQLScalar } from '@stamhoofd/sql';
import { memberFilterCompilers } from './members';
import { organizationFilterCompilers } from './organizations';
import { EmailRelationFilterCompilers } from './shared/EmailRelationFilterCompilers';

/**
 * Defines how to filter cached balance items in the database from StamhoofdFilter objects
 */
export const receivableBalanceFilterCompilers: SQLModernFilterDefinitions = {
    ...baseModernSQLFilterCompilers,
    id: createColumnFilter({
        expression: SQL.column('id'),
        type: SQLModernValueType.String,
        nullable: false,
    }),
    organizationId: createColumnFilter({
        expression: SQL.column('organizationId'),
        type: SQLModernValueType.String,
        nullable: false,
    }),
    objectType: createColumnFilter({
        expression: SQL.column('objectType'),
        type: SQLModernValueType.String,
        nullable: false,
    }),
    amountOpen: createColumnFilter({
        expression: SQL.column('amountOpen'),
        type: SQLModernValueType.Number,
        nullable: false,
    }),
    amountPending: createColumnFilter({
        expression: SQL.column('amountPending'),
        type: SQLModernValueType.Number,
        nullable: false,
    }),
    nextDueAt: createColumnFilter({
        expression: SQL.column('nextDueAt'),
        type: SQLModernValueType.Datetime,
        nullable: true,
    }),
    lastReminderEmail: createColumnFilter({
        expression: SQL.column('lastReminderEmail'),
        type: SQLModernValueType.Datetime,
        nullable: true,
    }),
    reminderEmailCount: createColumnFilter({
        expression: SQL.column('reminderEmailCount'),
        type: SQLModernValueType.Number,
        nullable: false,
    }),
    reminderAmountIncreased: createColumnFilter({
        expression: SQL.if(
            SQL.column('amountOpen'),
            '>',
            SQL.column('lastReminderAmountOpen'),
        ).then(1).else(0),
        type: SQLModernValueType.Boolean,
        nullable: false,
    }),
    organizations: createExistsFilter(
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
    members: createExistsFilter(
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
    users: createExistsFilter(
        SQL.select()
            .from(SQL.table('users'))
            .where(
                SQL.column(
                    'users',
                    'id',
                ),
                SQL.column('cached_outstanding_balances', 'objectId'),
            ).where(
                SQL.column('cached_outstanding_balances', 'objectType'),
                'user'),
        {
            ...baseModernSQLFilterCompilers,
            name: createColumnFilter({
                expression: new SQLConcat(
                    SQL.column('firstName'),
                    new SQLScalar(' '),
                    SQL.column('lastName'),
                ),
                type: SQLModernValueType.String,
                nullable: false,
            }),
        },
    ),

    // Allowed to filter by recent emails
    ...EmailRelationFilterCompilers,
};
