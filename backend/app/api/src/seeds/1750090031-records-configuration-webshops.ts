import { Migration } from '@simonbackx/simple-database';
import { Webshop } from '@stamhoofd/models';
import { LoggingTools } from '@stamhoofd/utility';

export async function startRecordsConfigurationMigration() {
    const webshopProgressLogger = await LoggingTools.createProgressLoggerFromQuery(Webshop.select());

    // migrate recordsConfiguration of webshops
    for await (const webshop of Webshop.select().limit(100).all()) {
        await webshop.save();
        webshopProgressLogger.update();
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
