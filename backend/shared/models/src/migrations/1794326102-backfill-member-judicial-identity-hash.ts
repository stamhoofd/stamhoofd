import { Migration } from '@node/database';
import { SQL } from '@stamhoofd/sql';

import { getJudicialIdentityHash } from '../helpers/judicialIdentityHash.js';
import { Member } from '../models/Member.js';

/**
 * Fills the hash for members that already existed.
 *
 * Through the same helper the model writes, rather than an equivalent SHA2() in SQL: a second implementation
 * that only has to be right once is still a second implementation, and this one would be the harder of the two
 * to notice drifting.
 */
export async function backfillJudicialIdentityHashes(): Promise<number> {
    const batchSize = 1000;
    let lastId = '';
    let updated = 0;

    for (;;) {
        const rows = await SQL.select(
            SQL.column('members', 'id'),
            SQL.column('members', 'firstName'),
            SQL.column('members', 'lastName'),
            SQL.column('members', 'birthDay'),
        )
            .from(SQL.table(Member.table))
            .where(SQL.column('members', 'judicialIdentityHash'), null)
            .where(SQL.column('members', 'id'), '>', lastId)
            .orderBy(SQL.column('members', 'id'))
            .limit(batchSize)
            .fetch();

        if (rows.length === 0) {
            return updated;
        }

        for (const row of rows) {
            const member = row['members'] as { id: string; firstName: string | null; lastName: string | null; birthDay: string | null };

            await SQL.update(Member.table)
                .set('judicialIdentityHash', getJudicialIdentityHash(member))
                .where('id', member.id)
                .update();

            lastId = member.id;
            updated++;
        }
    }
}

export default new Migration(async () => {
    process.stdout.write('\n');
    const updated = await backfillJudicialIdentityHashes();
    console.log(`Backfilled the judicial identity hash of ${updated} members.`);
});
