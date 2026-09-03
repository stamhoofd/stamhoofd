import { column } from '@simonbackx/simple-database';
import { AnyDecoder, ArrayDecoder } from '@simonbackx/simple-encoding';
import { QueryableModel } from '@stamhoofd/sql';
import { NamedObject } from '@stamhoofd/structures';
import type { NotificationSubjectType } from '@stamhoofd/structures/notifications/NotificationSubjectType.js';
import type { NotificationType } from '@stamhoofd/structures/notifications/NotificationType.js';
import { v7 as uuidv7 } from 'uuid';

/**
 * Shared between all its recipients (see NotificationRecipient).
 */
export class Notification extends QueryableModel {
    static table = 'notifications';

    @column({
        primary: true, type: 'string', beforeSave(value) {
            // uuidv7 keeps ids sortable by creation time
            return value ?? uuidv7();
        },
    })
    id!: string;

    @column({ type: 'string' })
    type: NotificationType;

    @column({ type: 'string', nullable: true })
    organizationId: string | null = null;

    @column({ type: 'string', nullable: true })
    subjectType: NotificationSubjectType | null = null;

    @column({ type: 'string', nullable: true })
    subjectId: string | null = null;

    /**
     * Shape depends on `type`
     */
    @column({ type: 'json', decoder: AnyDecoder })
    payload: unknown = {};

    /**
     * Recent notifications with the same type, organizationId and groupKey are merged into one
     */
    @column({ type: 'string', nullable: true })
    groupKey: string | null = null;

    @column({ type: 'integer' })
    groupResourceCount = 0;

    @column({ type: 'json', decoder: new ArrayDecoder(NamedObject) })
    groupResources: NamedObject[] = [];

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
