import { Migration } from '@simonbackx/simple-database';
import { User } from '@stamhoofd/models';
import { UserPermissions } from '@stamhoofd/structures';

export default new Migration(async () => {
    if (STAMHOOFD.environment == "test") {
        console.log("skipped in tests")
        return;
    }
    process.stdout.write('\n');
    let c = 0;
    while(true) {
        const admins = await User.where({
            organizationPermissions: {
                value: null,
                sign: '!='
            },
            organizationId: {
                value: null,
                sign: '!='
            }
        }, {limit: 100})

        for (const admin of admins) {
            if (!admin.organizationPermissions || !admin.organizationId) {
                continue
            }
            const p = UserPermissions.create({})
            p.organizationPermissions.set(admin.organizationId, admin.organizationPermissions)
            admin.permissions = UserPermissions.limitedAdd(admin.permissions, p, admin.organizationId)
            admin.organizationPermissions = null
            await admin.save()
            c++;

            if (c%1000 === 0) {
                process.stdout.write('.');
            }
            if (c%10000 === 0) {
                process.stdout.write('\n');
            }
        }

        if (admins.length === 0) {
            break;
        }
    }

    // Do something here
    return Promise.resolve()
});


