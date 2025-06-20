import { Migration } from '@simonbackx/simple-database';
import { Organization } from '@stamhoofd/models';

export async function startRecordsConfigurationMigration() {
    for await (const organization of Organization.select().all()) {
        await organization.save();
    }
}

export default new Migration(async () => {
    if (STAMHOOFD.environment === 'test') {
        console.log('skipped in tests');
        return;
    }

    if (STAMHOOFD.platformName.toLowerCase() !== 'stamhoofd') {
        console.log('skipped for platform (only runs for Stamhoofd): ' + STAMHOOFD.platformName);
        return;
    }

    await startRecordsConfigurationMigration();
});
