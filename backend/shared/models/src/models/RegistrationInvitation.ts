import { column } from '@simonbackx/simple-database';
import { v4 as uuidv4 } from 'uuid';

import { QueryableModel } from '@stamhoofd/sql';

/**
 * Invitation to register for a group. If an invitation exists the member can always register even if he does not meet the requirements of the group.
 * Used for allowing members who are on a waiting list to register for a group.
 */
export class RegistrationInvitation extends QueryableModel {
    static table = 'registration_invitations';

    @column({
        primary: true, type: 'string', beforeSave(value) {
            return value ?? uuidv4();
        },
    })
    id: string;

    @column({ type: 'string' })
    groupId: string;

    @column({ type: 'string' })
    memberId: string;

    @column({ type: 'string' })
    organizationId: string;

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
}
