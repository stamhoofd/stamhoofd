import { SQL, SQLFilterDefinitions, baseSQLFilterCompilers, createSQLColumnFilterCompiler, createSQLRelationFilterCompiler } from '@stamhoofd/sql';
import { eventFilterCompilers } from './events';
import { organizationFilterCompilers } from './organizations';

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
    organization: createSQLRelationFilterCompiler(
        SQL.select()
            .from('organizations')
            .where(
                SQL.column('organizations', 'id'),
                SQL.column('event_notifications', 'organizationId'),
            ),
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
