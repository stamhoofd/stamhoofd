import { Migration } from '@simonbackx/simple-database';

export default new Migration(async () => {
    if (STAMHOOFD.environment === 'test') {
        // The backfill is covered directly by BalanceItemRelationsBackfiller.test.ts
        console.log('skipped in tests');
        return;
    }

    // Imported dynamically so the migration loader does not need to resolve the helper at link time.
    const { backfillBalanceItemRelations } = await import('../helpers/BalanceItemRelationsBackfiller.js');
    await backfillBalanceItemRelations();
});
