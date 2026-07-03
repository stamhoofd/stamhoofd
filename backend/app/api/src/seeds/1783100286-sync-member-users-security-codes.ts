import { Migration } from '@simonbackx/simple-database';
import { logger } from '@simonbackx/simple-logging';
import { Member } from '@stamhoofd/models';
import { QueryableModel } from '@stamhoofd/sql';
import { MemberUserSyncer } from '../helpers/MemberUserSyncer.js';
import { allSettledButThrowFirst, SeedTools } from '../helpers/SeedTools.js';

export default new Migration(async () => {
    if (STAMHOOFD.environment === 'test') {
        console.log('skipped in tests');
        return;
    }

    const result = await logger.setContext({ tags: ['silent-seed', 'seed'] }, async () => {
        return await SeedTools.loopBatched({
            query: Member.select('id'),
            batchSize: 50,
            batchAction: async (rawMembers) => {
                const membersWithRegistrations = await Member.getBlobByIds(...rawMembers.map(m => m.id));

                await allSettledButThrowFirst(
                    membersWithRegistrations.map(async (memberWithRegistrations) => {
                        await MemberUserSyncer.onChangeMember(memberWithRegistrations);
                    }),
                );

                if (QueryableModel.shutdownMigrations) {
                    throw new Error('Stopping migration gracefully');
                }
            },
        });
    });

    console.log('Synced ' + result.total + ' members with users');
});
