import { Database } from '@simonbackx/simple-database';
import type { Member, User } from '@stamhoofd/models';
import { Notification } from '@stamhoofd/models/models/Notification.js';
import { NotificationPreference } from '@stamhoofd/models/models/NotificationPreference.js';
import { NotificationRecipient } from '@stamhoofd/models/models/NotificationRecipient.js';
import { QueueHandler } from '@stamhoofd/queues';
import { SQL } from '@stamhoofd/sql';
import type { NamedObject } from '@stamhoofd/structures';
import { NotificationChannel } from '@stamhoofd/structures/notifications/NotificationChannel.js';
import type { NotificationSubjectType } from '@stamhoofd/structures/notifications/NotificationSubjectType.js';
import type { NotificationType } from '@stamhoofd/structures/notifications/NotificationType.js';
import { Formatter } from '@stamhoofd/utility';
import { v7 as uuidv7 } from 'uuid';

export type NotificationTarget = {
    users?: (User | string)[];
    /**
     * Resolved to the users linked to these members
     */
    members?: (Member | string)[];
};

export type SendNotificationOptions = {
    type: NotificationType;
    payload: unknown;
    organizationId?: string | null;
    subjectType?: NotificationSubjectType | null;
    subjectId?: string | null;
    /**
     * Recent notifications with the same type, organizationId and key are merged into one
     */
    group?: {
        key: string;
        resource?: NamedObject;
    };
    to: NotificationTarget;
};

/**
 * Notifications with the same group key are merged within the same calendar day
 */
function groupingWindowStart(now: Date): Date {
    return Formatter.luxon(now).startOf('day').toJSDate();
}

const maxGroupResources = 3;

export class NotificationService {
    static async send(options: SendNotificationOptions): Promise<Notification | null> {
        const userIds = await this.resolveUserIds(options.to);
        const enabledUserIds = await this.filterDisabledUsers(userIds, options.type);

        if (enabledUserIds.length === 0) {
            return null;
        }

        if (options.group) {
            const group = options.group;
            // Serializes merges per group within this process only; the notificationId_userId unique key catches cross-process races
            const queue = 'notifications/group/' + (options.organizationId ?? '') + '/' + options.type + '/' + group.key;
            return await QueueHandler.schedule(queue, async () => {
                const existing = await this.findGroupedNotification(options, group.key);
                if (existing) {
                    await this.mergeInto(existing, group.resource, enabledUserIds);
                    return existing;
                }
                return await this.create(options, enabledUserIds);
            });
        }

        return await this.create(options, enabledUserIds);
    }

    /**
     * Returns the updated recipient. The group count is read in SQL so a concurrent merge can't leave a stale readCount.
     */
    static async markAsRead(recipient: NotificationRecipient): Promise<NotificationRecipient> {
        await this.markRead('r.id = ?', [recipient.id]);
        return await NotificationRecipient.getByID(recipient.id) as NotificationRecipient;
    }

    /**
     * Returns the number of notifications that were unread
     */
    static async markAllAsRead(user: User): Promise<number> {
        return await this.markRead('r.userId = ? AND r.readAt IS NULL', [user.id]);
    }

    private static async markRead(where: string, params: unknown[]): Promise<number> {
        const now = new Date();
        now.setMilliseconds(0);

        const [result] = await Database.update(
            `UPDATE \`${NotificationRecipient.table}\` r
            JOIN \`${Notification.table}\` n ON n.id = r.notificationId
            SET r.readAt = ?, r.seenAt = COALESCE(r.seenAt, ?), r.readCount = n.groupResourceCount
            WHERE ${where}`,
            [now, now, ...params],
        );
        return result.affectedRows;
    }

    private static async resolveUserIds(target: NotificationTarget): Promise<string[]> {
        const userIds = (target.users ?? []).map(u => typeof u === 'string' ? u : u.id);
        const memberIds = (target.members ?? []).map(m => typeof m === 'string' ? m : m.id);

        if (memberIds.length > 0) {
            const rows = await SQL.select('usersId')
                .from('_members_users')
                .where('membersId', memberIds)
                .fetch();
            userIds.push(...rows.map(r => r._members_users.usersId as string));
        }

        return Formatter.uniqueArray(userIds);
    }

    private static async filterDisabledUsers(userIds: string[], type: NotificationType): Promise<string[]> {
        if (userIds.length === 0) {
            return [];
        }

        const disabled = await NotificationPreference.select()
            .where('userId', userIds)
            .andWhere('notificationType', type)
            .andWhere('channel', NotificationChannel.InApp)
            .andWhere('enabled', false)
            .fetch();

        const disabledIds = new Set(disabled.map(p => p.userId));
        return userIds.filter(id => !disabledIds.has(id));
    }

    private static async findGroupedNotification(options: SendNotificationOptions, groupKey: string): Promise<Notification | null> {
        const windowStart = groupingWindowStart(new Date());

        return await Notification.select()
            .where('organizationId', options.organizationId ?? null)
            .andWhere('type', options.type)
            .andWhere('groupKey', groupKey)
            .andWhere('createdAt', '>=', windowStart)
            .orderBy(SQL.column('createdAt'), 'DESC')
            .first(false);
    }

    private static async mergeInto(notification: Notification, resource: NamedObject | undefined, userIds: string[]) {
        notification.groupResourceCount += 1;
        if (resource) {
            notification.groupResources = [...notification.groupResources, resource].slice(-maxGroupResources);
        }
        await notification.save();

        await SQL.update(NotificationRecipient.table)
            .set('readAt', null)
            .set('seenAt', null)
            .where('notificationId', notification.id)
            .update();

        const existingRecipients = await NotificationRecipient.select()
            .where('notificationId', notification.id)
            .andWhere('userId', userIds)
            .fetch();
        const existingUserIds = new Set(existingRecipients.map(r => r.userId));
        const newUserIds = userIds.filter(id => !existingUserIds.has(id));

        // A new recipient only has the item that just arrived as unread
        await this.insertRecipients(notification, newUserIds, notification.groupResourceCount - 1);
    }

    private static async create(options: SendNotificationOptions, userIds: string[]): Promise<Notification> {
        const notification = new Notification();
        notification.type = options.type;
        notification.payload = options.payload;
        notification.organizationId = options.organizationId ?? null;
        notification.subjectType = options.subjectType ?? null;
        notification.subjectId = options.subjectId ?? null;

        if (options.group) {
            notification.groupKey = options.group.key;
            notification.groupResourceCount = 1;
            notification.groupResources = options.group.resource ? [options.group.resource] : [];
        }

        await notification.save();
        await this.insertRecipients(notification, userIds, 0);
        return notification;
    }

    private static async insertRecipients(notification: Notification, userIds: string[], readCount: number) {
        if (userIds.length === 0) {
            return;
        }

        const createdAt = new Date();
        createdAt.setMilliseconds(0);

        await SQL.insert(NotificationRecipient.table)
            .columns('id', 'notificationId', 'userId', 'readCount', 'createdAt')
            .values(...userIds.map(userId => [uuidv7(), notification.id, userId, readCount, createdAt]))
            .insert();
    }
}
