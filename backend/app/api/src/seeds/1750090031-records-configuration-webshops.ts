import { Migration } from '@simonbackx/simple-database';
import { Webshop } from '@stamhoofd/models';
import { SeedTools } from '../helpers/SeedTools.js';

export async function startWebshopRecordsConfigurationMigration() {
    let realSave = 0;

    const result = await SeedTools.loop({
        batchSize: 100,
        query: Webshop.select(),
        useTransactionPerBatch: true,
        action: async (webshop: Webshop) => {
            if (await webshop.save({
                skipMarkSaved: true,
                skipSendEvents: true,
            })) {
                realSave += 1;
            }
        },
    });
    console.log('Succesfully fetched and saved ' + realSave + ' webshops of ' + result.total + ' looped webshops');
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

    await startWebshopRecordsConfigurationMigration();
});
