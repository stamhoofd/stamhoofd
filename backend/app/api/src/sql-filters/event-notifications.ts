import { baseModernSQLFilterCompilers, createColumnFilter, createJoinedRelationFilter, createExistsFilter, SQL, SQLModernFilterDefinitions, SQLModernValueType } from '@stamhoofd/sql';
import { eventFilterCompilers } from './events';
import { organizationFilterCompilers } from './organizations';

export const organizationJoin = SQL.join('organizations').where(SQL.column('organizations', 'id'), SQL.column('event_notifications', 'organizationId'));

export const eventNotificationsFilterCompilers: SQLModernFilterDefinitions = {
    ...baseModernSQLFilterCompilers,
    id: createColumnFilter({
        expression: SQL.column('id'),
        type: SQLModernValueType.String,
        nullable: false,
    }),
    typeId: createColumnFilter({
        expression: SQL.column('typeId'),
        type: SQLModernValueType.String,
        nullable: false,
    }),
    periodId: createColumnFilter({
        expression: SQL.column('periodId'),
        type: SQLModernValueType.String,
        nullable: false,
    }),
    organizationId: createColumnFilter({
        expression: SQL.column('organizationId'),
        type: SQLModernValueType.String,
        nullable: false,
    }),
    startDate: createColumnFilter({
        expression: SQL.column('startDate'),
        type: SQLModernValueType.Datetime,
        nullable: false,
    }),
    endDate: createColumnFilter({
        expression: SQL.column('endDate'),
        type: SQLModernValueType.Datetime,
        nullable: false,
    }),
    submittedAt: createColumnFilter({
        expression: SQL.column('submittedAt'),
        type: SQLModernValueType.Datetime,
        nullable: true,
    }),
    createdAt: createColumnFilter({
        expression: SQL.column('createdAt'),
        type: SQLModernValueType.Datetime,
        nullable: false,
    }),
    status: createColumnFilter({
        expression: SQL.column('status'),
        type: SQLModernValueType.String,
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
