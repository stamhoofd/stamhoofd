import { baseSQLFilterCompilers, createColumnFilter, createExistsFilter, SQL, SQLConcat, SQLFilterDefinitions, SQLValueType, SQLScalar } from '@stamhoofd/sql';
import { memberFilterCompilers } from './members.js';
import { organizationFilterCompilers } from './organizations.js';
import { EmailRelationFilterCompilers } from './shared/EmailRelationFilterCompilers.js';

/**
 * Defines how to filter cached balance items in the database from StamhoofdFilter objects
 */
export const receivableBalanceFilterCompilers: SQLFilterDefinitions = {
    ...baseSQLFilterCompilers,
    id: createColumnFilter({
        expression: SQL.column('id'),
        type: SQLValueType.String,
        nullable: false,
    }),
    organizationId: createColumnFilter({
        expression: SQL.column('organizationId'),
        type: SQLValueType.String,
        nullable: false,
    }),
    objectType: createColumnFilter({
        expression: SQL.column('objectType'),
        type: SQLValueType.String,
        nullable: false,
    }),
    amountOpen: createColumnFilter({
        expression: SQL.column('amountOpen'),
        type: SQLValueType.Number,
        nullable: false,
    }),
    amountPending: createColumnFilter({
        expression: SQL.column('amountPending'),
        type: SQLValueType.Number,
        nullable: false,
    }),
    nextDueAt: createColumnFilter({
        expression: SQL.column('nextDueAt'),
        type: SQLValueType.Datetime,
        nullable: true,
    }),
    lastReminderEmail: createColumnFilter({
        expression: SQL.column('lastReminderEmail'),
        type: SQLValueType.Datetime,
        nullable: true,
    }),
    reminderEmailCount: createColumnFilter({
        expression: SQL.column('reminderEmailCount'),
        type: SQLValueType.Number,
        nullable: false,
    }),
    reminderAmountIncreased: createColumnFilter({
        expression: SQL.if(
            SQL.column('amountOpen'),
            '>',
            SQL.column('lastReminderAmountOpen'),
        ).then(1).else(0),
        type: SQLValueType.Boolean,
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
                ['user', 'userWithoutMembers'],
            ),
        {
            ...baseSQLFilterCompilers,
            name: createColumnFilter({
                expression: new SQLConcat(
                    SQL.column('firstName'),
                    new SQLScalar(' '),
                    SQL.column('lastName'),
                ),
                type: SQLValueType.String,
                nullable: false,
            }),
            email: createColumnFilter({
                expression: SQL.column('email'),
                type: SQLValueType.String,
                nullable: false,
            }),
        },
    ),

    // Allowed to filter by recent emails
    ...EmailRelationFilterCompilers,
};
