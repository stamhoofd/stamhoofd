import { Migration } from '@simonbackx/simple-database';
import { User } from '@stamhoofd/models';
import { UserPermissions } from '@stamhoofd/structures';
import { SeedTools } from '../helpers/SeedTools.js';

export default new Migration(async () => {
    if (STAMHOOFD.environment == 'test') {
        console.log('skipped in tests');
        return;
    }
    process.stdout.write('\n');

    let realUpdate = 0;

    const result = await SeedTools.loop({
        batchSize: 100,
        query: User.select().whereNot('organizationPermissions', null).whereNot('organizationId', null),
        useTransactionPerBatch: true,
        action: async (admin: User) => {
            if (!admin.organizationPermissions || !admin.organizationId) {
                return;
            }
            const p = UserPermissions.create({});
            p.organizationPermissions.set(admin.organizationId, admin.organizationPermissions);
            admin.permissions = UserPermissions.limitedAdd(admin.permissions, p, admin.organizationId);
            admin.organizationPermissions = null;
            if (await admin.save({
                skipMarkSaved: true,
                skipSendEvents: true,
            })) {
                realUpdate++;
            }
        },
    });

    console.log('Updated permissions of ' + realUpdate + ' users, looped ' + result.total + ' users');

    // Do something here
    return Promise.resolve();
});
