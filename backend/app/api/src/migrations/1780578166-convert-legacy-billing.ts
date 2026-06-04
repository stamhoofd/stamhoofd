import { Migration } from '@simonbackx/simple-database';

export default new Migration(async () => {
    if (STAMHOOFD.environment === 'test') {
        // The conversion is covered directly by LegacyBillingConverter.test.ts
        console.log('skipped in tests');
        return;
    }

    // Imported dynamically so the migration loader does not need to resolve the helper at link time.
    const { runConversion } = await import('../helpers/LegacyBillingConverter.js');
    await runConversion();
});
