import { SQL, SQLFilterDefinitions, baseSQLFilterCompilers, createSQLColumnFilterCompiler, createSQLJoinedRelationFilterCompiler, createSQLRelationFilterCompiler } from '@stamhoofd/sql';
import { eventFilterCompilers } from './events';
import { organizationFilterCompilers } from './organizations';

const organizationJoin = SQL.join('organizations').where(SQL.column('organizations', 'id'), SQL.column('event_notifications', 'organizationId'));

export const eventNotificationsFilterCompilers: SQLFilterDefinitions = {
    ...baseSQLFilterCompilers,
    id: createSQLColumnFilterCompiler('id'),
    typeId: createSQLColumnFilterCompiler('typeId'),
    periodId: createSQLColumnFilterCompiler('periodId'),
    organizationId: createSQLColumnFilterCompiler('organizationId'),
    startDate: createSQLColumnFilterCompiler('startDate'),
    endDate: createSQLColumnFilterCompiler('endDate'),
    submittedAt: createSQLColumnFilterCompiler('submittedAt'),
    createdAt: createSQLColumnFilterCompiler('createdAt'),
    status: createSQLColumnFilterCompiler('status'),
    organization: createSQLJoinedRelationFilterCompiler(
        organizationJoin,
        organizationFilterCompilers,
    ),
    events: createSQLRelationFilterCompiler(
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
