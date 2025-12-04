import { column, ManyToOneRelation } from '@simonbackx/simple-database';
import { QueryableModel } from '@stamhoofd/sql';
import { Permissions } from '@stamhoofd/structures';
import { v4 as uuidv4 } from 'uuid';

import { Organization, User } from './index.js';

export class UserPermissions extends QueryableModel {
    static table = 'user_permissions';

    // Columns
    @column({
        primary: true, type: 'string', beforeSave(value) {
            return value ?? uuidv4();
        },
    })
    id!: string;

    @column({ foreignKey: UserPermissions.organization, type: 'string' })
    organizationId: string;

    @column({ foreignKey: UserPermissions.user, type: 'string' })
    userId: string;

    @column({ type: 'json', decoder: Permissions, nullable: true })
    permissions: Permissions | null = null;

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

    static organization = new ManyToOneRelation(Organization, 'organization');
    static user = new ManyToOneRelation(User, 'user');
}
