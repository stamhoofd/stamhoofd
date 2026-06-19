import { column, Migration } from '@simonbackx/simple-database';
import { User } from '@stamhoofd/models';
import { QueryableModel } from '@stamhoofd/sql';
import { PermissionLevel, Permissions, UserPermissions } from '@stamhoofd/structures';

export class Admin extends QueryableModel {
    static table = 'admins';

    // Columns
    @column({
        primary: true, type: 'string',
    })
    id!: string;

    @column({ type: 'string' })
    email: string;

    @column({ type: 'string' })
    password?: string;

    @column({
        type: 'datetime', beforeSave(old?: Date) {
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

export default new Migration(async () => {
    if (STAMHOOFD.environment === 'test') {
        console.log('skipped in tests');
        return;
    }

    if (STAMHOOFD.platformName !== 'stamhoofd') {
        return;
    }

    if (STAMHOOFD.userMode !== 'organization') {
        return;
    }

    for await (const admin of Admin.select().all()) {
        if (!admin.password) {
            continue;
        }
        const email = admin.email;

        if (!email || !email.includes('@')) {
            continue;
        }

        console.log('Converting Platform Admin ', email);

        // Delete all existing users with this email address
        const deleted = await User.delete().where('email', email);
        console.log('Deleted ' + deleted.affectedRows + ' users to migrate to new platform user');

        const user = new User();
        user.email = email;
        user.password = admin.password;

        user.organizationId = null;
        user.permissions = UserPermissions.create({
            globalPermissions: Permissions.create({
                level: PermissionLevel.Full,
            }),
        });

        user.createdAt = admin.createdAt;
        user.updatedAt = new Date();
        user.verified = true;

        await user.save();

        console.log('Created Platform Admin ', email);
    }
});
