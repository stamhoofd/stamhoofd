import { SQL, SQLFilterDefinitions, baseSQLFilterCompilers, createSQLColumnFilterCompiler, createSQLRelationFilterCompiler } from '@stamhoofd/sql';
import { organizationFilterCompilers } from './organizations';
import { eventFilterCompilers } from './events';

export const eventNotificationsFilterCompilers: SQLFilterDefinitions = {
    ...baseSQLFilterCompilers,
    id: createSQLColumnFilterCompiler('id'),
    typeId: createSQLColumnFilterCompiler('typeId'),
    organizationId: createSQLColumnFilterCompiler('organizationId'),
    startDate: createSQLColumnFilterCompiler('startDate'),
    endDate: createSQLColumnFilterCompiler('endDate'),
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
