import { Migration } from '@simonbackx/simple-database';
import { Event, Group } from '@stamhoofd/models';

export default new Migration(async () => {
    if (STAMHOOFD.environment === 'test') {
        console.log('skipped in tests');
        return;
    }

    await setEventIdOnGroups();
});

export async function setEventIdOnGroups() {
    let count = 0;

    // Loop all events and link the associated group (and its waiting list) back to the event.
    for await (const event of Event.select().all()) {
        if (!event.groupId) {
            continue;
        }

        const group = await Group.getByID(event.groupId);
        if (!group) {
            continue;
        }

        if (group.eventId !== event.id) {
            group.eventId = event.id;
            await event.syncGroupRequirements(group);
            count++;
        }
    }

    console.log(`Set eventId on ${count} groups`);
}
