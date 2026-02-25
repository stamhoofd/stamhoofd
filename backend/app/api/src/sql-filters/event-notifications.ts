import { baseSQLFilterCompilers, createColumnFilter, createJoinedRelationFilter, createExistsFilter, SQL, SQLFilterDefinitions, SQLValueType } from '@stamhoofd/sql';
import { eventFilterCompilers } from './events.js';
import { organizationFilterCompilers } from './organizations.js';

export const organizationJoin = SQL.join('organizations').where(SQL.column('organizations', 'id'), SQL.column('event_notifications', 'organizationId'));

export const eventNotificationsFilterCompilers: SQLFilterDefinitions = {
    ...baseSQLFilterCompilers,
    id: createColumnFilter({
        expression: SQL.column('id'),
        type: SQLValueType.String,
        nullable: false,
    }),
    typeId: createColumnFilter({
        expression: SQL.column('typeId'),
        type: SQLValueType.String,
        nullable: false,
    }),
    periodId: createColumnFilter({
        expression: SQL.column('periodId'),
        type: SQLValueType.String,
        nullable: false,
    }),
    organizationId: createColumnFilter({
        expression: SQL.column('organizationId'),
        type: SQLValueType.String,
        nullable: false,
    }),
    startDate: createColumnFilter({
        expression: SQL.column('startDate'),
        type: SQLValueType.Datetime,
        nullable: false,
    }),
    endDate: createColumnFilter({
        expression: SQL.column('endDate'),
        type: SQLValueType.Datetime,
        nullable: false,
    }),
    submittedAt: createColumnFilter({
        expression: SQL.column('submittedAt'),
        type: SQLValueType.Datetime,
        nullable: true,
    }),
    createdAt: createColumnFilter({
        expression: SQL.column('createdAt'),
        type: SQLValueType.Datetime,
        nullable: false,
    }),
    status: createColumnFilter({
        expression: SQL.column('status'),
        type: SQLValueType.String,
        nullable: false,
    }),
    organization: createJoinedRelationFilter(
        organizationJoin,
        organizationFilterCompilers,
    ),
    events: createExistsFilter(
        SQL.select()
            .from(
                SQL.table('events'),
            ).join(
                SQL.join(
                    SQL.table('_event_notifications_events'),
                ).where(
                    SQL.column('_event_notifications_events', 'eventsId'),
                    SQL.column('events', 'id'),
                ),
            ).where(
                SQL.column('_event_notifications_events', 'event_notificationsId'),
                SQL.column('event_notifications', 'id'),
            ),
        eventFilterCompilers,
    ),
};
