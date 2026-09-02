import { AnyDecoder, ArrayDecoder, AutoEncoder, DateDecoder, field, IntegerDecoder, StringDecoder } from '@simonbackx/simple-encoding';
import { NamedObject } from '../Event.js';
import type { NotificationSubjectType } from './NotificationSubjectType.js';
import type { NotificationType } from './NotificationType.js';

/**
 * A notification as seen by one user: the recipient row joined with its shared notification.
 * `type` and `subjectType` are decoded as plain strings so older clients keep working when new values are added.
 */
export class UserNotification extends AutoEncoder {
    /**
     * Id of the recipient row (uuidv7, sortable)
     */
    @field({ decoder: StringDecoder })
    id: string;

    @field({ decoder: StringDecoder })
    notificationId: string;

    @field({ decoder: StringDecoder })
    type: NotificationType;

    @field({ decoder: StringDecoder, nullable: true })
    organizationId: string | null = null;

    @field({ decoder: StringDecoder, nullable: true })
    subjectType: NotificationSubjectType | null = null;

    @field({ decoder: StringDecoder, nullable: true })
    subjectId: string | null = null;

    @field({ decoder: AnyDecoder })
    payload: unknown = {};

    @field({ decoder: StringDecoder, nullable: true })
    groupKey: string | null = null;

    @field({ decoder: IntegerDecoder })
    groupResourceCount = 0;

    /**
     * The most recently grouped resources (capped by the backend)
     */
    @field({ decoder: new ArrayDecoder(NamedObject) })
    groupResources: NamedObject[] = [];

    /**
     * groupResourceCount at the time the user last read the notification
     */
    @field({ decoder: IntegerDecoder })
    readCount = 0;

    @field({ decoder: DateDecoder, nullable: true })
    readAt: Date | null = null;

    @field({ decoder: DateDecoder, nullable: true })
    seenAt: Date | null = null;

    @field({ decoder: DateDecoder, nullable: true })
    dismissedAt: Date | null = null;

    @field({ decoder: DateDecoder })
    createdAt: Date;

    @field({ decoder: DateDecoder })
    updatedAt: Date;
}
