import { column } from '@simonbackx/simple-database';
import { QueryableModel } from '@stamhoofd/sql';
import { UserNotification } from '@stamhoofd/structures/notifications/UserNotification.js';
import { v7 as uuidv7 } from 'uuid';
import type { Notification } from './Notification.js';

export class NotificationRecipient extends QueryableModel {
    static table = 'notification_recipients';

    @column({
        primary: true, type: 'string', beforeSave(value) {
            return value ?? uuidv7();
        },
    })
    id!: string;

    @column({ type: 'string' })
    notificationId: string;

    @column({ type: 'string' })
    userId: string;

    /**
     * Notification.groupResourceCount at the moment the user last read it
     */
    @column({ type: 'integer' })
    readCount = 0;

    @column({ type: 'datetime', nullable: true })
    readAt: Date | null = null;

    @column({ type: 'datetime', nullable: true })
    seenAt: Date | null = null;

    @column({ type: 'datetime', nullable: true })
    dismissedAt: Date | null = null;

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

    getStructure(notification: Notification): UserNotification {
        return UserNotification.create({
            id: this.id,
            notificationId: notification.id,
            type: notification.type,
            organizationId: notification.organizationId,
            subjectType: notification.subjectType,
            subjectId: notification.subjectId,
            payload: notification.payload,
            groupKey: notification.groupKey,
            groupResourceCount: notification.groupResourceCount,
            groupResources: notification.groupResources,
            readCount: this.readCount,
            readAt: this.readAt,
            seenAt: this.seenAt,
            dismissedAt: this.dismissedAt,
            createdAt: notification.createdAt,
            updatedAt: notification.updatedAt,
        });
    }
}
