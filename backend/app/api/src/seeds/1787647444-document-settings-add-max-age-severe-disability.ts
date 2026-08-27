import { Migration } from '@simonbackx/simple-database';
import { DocumentTemplate } from '@stamhoofd/models';
import { SeedTools } from '../helpers/SeedTools.js';

export default new Migration(async () => {
    if (STAMHOOFD.environment === 'test') {
        console.log('skipped in tests');
        return;
    }

    await SeedTools.loop({
        query: DocumentTemplate.select(),
        batchSize: 100,
        action: async (document) => {
            if (document.privateSettings.templateDefinition.type === 'fiscal') {
                document.settings.maxAgeSevereDisability = 21;

                await document.save({
                    forceSave: true,
                    skipMarkSaved: true,
                    skipSendEvents: true,
                });
            }
        },
    });

    return Promise.resolve();
});
