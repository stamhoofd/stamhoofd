import { Notification } from '@stamhoofd/models/models/Notification.js';
import { NotificationRecipient } from '@stamhoofd/models/models/NotificationRecipient.js';
import type { SQLFilterDefinitions } from '@stamhoofd/sql';
import { baseSQLFilterCompilers, createColumnFilter, SQL, SQLValueType } from '@stamhoofd/sql';

export const notificationJoin = SQL.join(Notification.table).where(SQL.column(Notification.table, 'id'), SQL.column(NotificationRecipient.table, 'notificationId'));

/**
 * Columns are table-qualified because the notifications query joins recipients with notifications.
 */
export const notificationFilterCompilers: SQLFilterDefinitions = {
    ...baseSQLFilterCompilers,
    id: createColumnFilter({
        expression: SQL.column(NotificationRecipient.table, 'id'),
        type: SQLValueType.String,
        nullable: false,
    }),
    notificationId: createColumnFilter({
        expression: SQL.column(NotificationRecipient.table, 'notificationId'),
        type: SQLValueType.String,
        nullable: false,
    }),
    readAt: createColumnFilter({
        expression: SQL.column(NotificationRecipient.table, 'readAt'),
        type: SQLValueType.Datetime,
        nullable: true,
    }),
    seenAt: createColumnFilter({
        expression: SQL.column(NotificationRecipient.table, 'seenAt'),
        type: SQLValueType.Datetime,
        nullable: true,
    }),
    dismissedAt: createColumnFilter({
        expression: SQL.column(NotificationRecipient.table, 'dismissedAt'),
        type: SQLValueType.Datetime,
        nullable: true,
    }),
    type: createColumnFilter({
        expression: SQL.column(Notification.table, 'type'),
        type: SQLValueType.String,
        nullable: false,
    }),
    organizationId: createColumnFilter({
        expression: SQL.column(Notification.table, 'organizationId'),
        type: SQLValueType.String,
        nullable: true,
    }),
    subjectType: createColumnFilter({
        expression: SQL.column(Notification.table, 'subjectType'),
        type: SQLValueType.String,
        nullable: true,
    }),
    subjectId: createColumnFilter({
        expression: SQL.column(Notification.table, 'subjectId'),
        type: SQLValueType.String,
        nullable: true,
    }),
    groupKey: createColumnFilter({
        expression: SQL.column(Notification.table, 'groupKey'),
        type: SQLValueType.String,
        nullable: true,
    }),
    createdAt: createColumnFilter({
        expression: SQL.column(Notification.table, 'createdAt'),
        type: SQLValueType.Datetime,
        nullable: false,
    }),
};
