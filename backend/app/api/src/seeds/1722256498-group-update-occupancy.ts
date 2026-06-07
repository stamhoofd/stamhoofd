import { Migration } from '@simonbackx/simple-database';
import { Group } from '@stamhoofd/models';
import { SeedTools } from '../helpers/SeedTools.js';

export default new Migration(async () => {
    if (STAMHOOFD.environment == 'test') {
        console.log('skipped in tests');
        return;
    }

    if (STAMHOOFD.userMode !== 'platform') {
        console.log('skipped seed group-update-occupancy because usermode not platform');
        return;
    }

    await SeedTools.loop<Group>({
        query: Group.select(),
        useTransactionPerBatch: true,
        batchSize: 200,
        action: async (group) => {
            await group.updateOccupancy();
            await group.save({
                skipMarkSaved: true,
                skipSendEvents: true,
            });
        },
    });

    // Do something here
    return Promise.resolve();
});
