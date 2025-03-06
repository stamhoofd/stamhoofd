import { Migration } from '@simonbackx/simple-database';
import { Event, Group } from '@stamhoofd/models';
import { sleep } from '@stamhoofd/utility';

export default new Migration(async () => {
    if (STAMHOOFD.environment === 'test') {
        console.log('skipped in tests');
        return;
    }

    if (STAMHOOFD.platformName !== 'ravot') {
        console.log('skipped for platform (only runs for Ravot): ' + STAMHOOFD.platformName);
        return;
    }

    let count = 0;
    for await (const event of Event.select().where('groupId', '!=', null).limit(20).all()) {
        // Sync group requirements
        if (event.groupId) {
            const group = await Group.getByID(event.groupId);
            if (group) {
                await event.syncGroupRequirements(group);
                count += 1;

                // Slow this down a bit to reduce a lot of document updates at the same time
                await sleep(100);
            }
        }
    }

    console.log('Fixed ' + count + ' groups');
});
