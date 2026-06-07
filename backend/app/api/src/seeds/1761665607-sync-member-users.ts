import { Migration } from '@simonbackx/simple-database';
import { Member } from '@stamhoofd/models';
import { SQL } from '@stamhoofd/sql';
import { MemberUserSyncer } from '../helpers/MemberUserSyncer.js';
import { allSettledButThrowFirst, SeedTools } from '../helpers/SeedTools.js';

export default new Migration(async () => {
    if (STAMHOOFD.environment == 'test') {
        console.log('skipped in tests');
        return;
    }

    if (STAMHOOFD.platformName.toLowerCase() !== 'stamhoofd') {
        console.log('skipped for platform (only runs for Stamhoofd): ' + STAMHOOFD.platformName);
        return;
    }

    const result = await SeedTools.loopBatched({
        query: SQL.select('id').from(Member.table).all(),
        batchSize: 500,
        batchAction: async (rawMembers) => {
            const membersWithRegistrations = await Member.getBlobByIds(...rawMembers.map(m => m.id));

            await allSettledButThrowFirst(
                membersWithRegistrations.map(async (memberWithRegistrations) => {
                    await MemberUserSyncer.onChangeMember(memberWithRegistrations);
                }),
            );
        },
    });

    console.log('Synced ' + result.total + ' members with users');
});
