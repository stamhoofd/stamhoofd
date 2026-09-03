import type { NotificationRecipient } from '@stamhoofd/models/models/NotificationRecipient.js';
import type { SQLOrderByDirection, SQLSortDefinitions } from '@stamhoofd/sql';
import { SQL, SQLOrderBy } from '@stamhoofd/sql';

/**
 * Only the recipient id is sortable: it is a uuidv7, so it follows creation order and is indexed per user.
 */
export const notificationSorters: SQLSortDefinitions<NotificationRecipient> = {
    id: {
        getValue(a) {
            return a.id;
        },
        toSQL: (direction: SQLOrderByDirection): SQLOrderBy => {
            return new SQLOrderBy({
                column: SQL.column('notification_recipients', 'id'),
                direction,
            });
        },
    },
};
