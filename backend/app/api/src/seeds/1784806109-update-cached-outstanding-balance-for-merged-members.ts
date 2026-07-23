import { Migration } from '@simonbackx/simple-database';
import { BalanceItem, CachedBalance, MergedMember } from '@stamhoofd/models';
import { SQL } from '@stamhoofd/sql';
import { SeedTools } from '../helpers/SeedTools.js';

export default new Migration(async () => {
    if (STAMHOOFD.environment === 'test') {
        console.log('skipped in tests');
        return;
    }

    if (STAMHOOFD.platformName === 'stamhoofd') {
        return;
    }

    // Loop all members
    await SeedTools.loop({
        query: MergedMember.select(),
        batchSize: 100,
        action: async (mergedMember) => {
            const items = await SQL.select('organizationId')
                .from(BalanceItem.table)
                .where('memberId', mergedMember.id)
                .groupBy(SQL.column('organizationId'))
                .fetch();
            for (const item of items) {
                await CachedBalance.updateForMembers(item[BalanceItem.table].organizationId as string, [mergedMember.id]);
            }
        },
    });

    return Promise.resolve();
});
