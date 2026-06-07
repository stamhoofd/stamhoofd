import { Migration } from '@simonbackx/simple-database';
import { User } from '@stamhoofd/models';
import { UserPermissions } from '@stamhoofd/structures';
import { LoggingTools } from '@stamhoofd/utility';
import { SeedTools } from '../helpers/SeedTools.js';

export default new Migration(async () => {
    if (STAMHOOFD.environment == 'test') {
        console.log('skipped in tests');
        return;
    }
    process.stdout.write('\n');

    const getQuery = () => User.select().whereNot('organizationPermissions', null).whereNot('organizationId', null);

    const batchProcessor = SeedTools.createBatchProcessor({
        batchSize: 100,
        action: async (admin: User) => {
            if (!admin.organizationPermissions || !admin.organizationId) {
                return;
            }
            const p = UserPermissions.create({});
            p.organizationPermissions.set(admin.organizationId, admin.organizationPermissions);
            admin.permissions = UserPermissions.limitedAdd(admin.permissions, p, admin.organizationId);
            admin.organizationPermissions = null;
            await admin.save({
                skipMarkSaved: true,
                skipSendEvents: true,
            });
        },
    });

    const progressLogger = await LoggingTools.createProgressLoggerFromQuery(getQuery());
    batchProcessor.setProgressLogger(progressLogger);

    for await (const admin of getQuery().limit(100).all()) {
        await batchProcessor.execute(admin);
    }

    await batchProcessor.finish();

    // Do something here
    return Promise.resolve();
});
