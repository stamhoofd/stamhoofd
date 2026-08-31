import { Migration } from '@simonbackx/simple-database';
import { SeedTools } from '../helpers/SeedTools.js';
import { Organization } from '@stamhoofd/models';

export default new Migration(async () => {
    if (STAMHOOFD.environment === 'test') {
        console.log('skipped in tests');
        return;
    }

    await SeedTools.loop({
        query: Organization.select(),
        batchSize: 100,
        action: async (organization) => {
            if (organization.meta.recordsConfiguration.nationalRegisterNumber) {
                organization.meta.recordsConfiguration.taxDependent = organization.meta.recordsConfiguration.nationalRegisterNumber;
            }

            await organization.save({
                skipMarkSaved: true,
                skipSendEvents: true,
            });
        },
    });

    return Promise.resolve();
});
