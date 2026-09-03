import { column } from '@simonbackx/simple-database';
import { QueryableModel } from '@stamhoofd/sql';
import type { NotificationChannel } from '@stamhoofd/structures/notifications/NotificationChannel.js';
import type { NotificationType } from '@stamhoofd/structures/notifications/NotificationType.js';
import { v4 as uuidv4 } from 'uuid';

export class NotificationPreference extends QueryableModel {
    static table = 'notification_preferences';

    @column({
        primary: true, type: 'string', beforeSave(value) {
            return value ?? uuidv4();
        },
    })
    id!: string;

    @column({ type: 'string' })
    userId: string;

    @column({ type: 'string' })
    notificationType: NotificationType;

    @column({ type: 'string' })
    channel: NotificationChannel;

    @column({ type: 'boolean' })
    enabled = true;

    @column({
        type: 'datetime', beforeSave(old?: any) {
            if (old !== undefined) {
                return old;
            }
            const date = new Date();
            date.setMilliseconds(0);
            return date;
        },
    })
    createdAt: Date;

    @column({
        type: 'datetime', beforeSave() {
            const date = new Date();
            date.setMilliseconds(0);
            return date;
        },
        skipUpdate: true,
    })
    updatedAt: Date;
}
