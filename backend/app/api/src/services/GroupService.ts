import { Database } from '@simonbackx/simple-database';
import { Group, Registration } from '@stamhoofd/models';

async function getRegistrationCount(where: string, params: (string | Date)[]) {
    const query = `select count(*) as c from \`${Registration.table}\` where ${where}`;

    const [results] = await Database.select(query, params);
    const count = results[0]['']['c'];
    if (Number.isInteger(count)) {
        return count as number;
    }
    return null;
}

export const GroupService = {
    /**
     * Refreshes cached occupancy on the supplied instance without reloading or saving it.
     */
    async refreshOccupancy(group: Group) {
        group.settings.registeredMembers = await getRegistrationCount(
            'groupId = ? and registeredAt is not null AND deactivatedAt is null',
            [group.id],
        );

        group.settings.reservedMembers = await getRegistrationCount(
            'groupId = ? and registeredAt is null AND (canRegister = 1 OR reservedUntil >= ?)',
            [group.id, new Date()],
        );
    },

    /**
     * Loads a group and persists its refreshed occupancy, if it exists.
     */
    async updateOccupancy(groupId: string) {
        const group = await Group.getByID(groupId);
        if (group) {
            await GroupService.refreshOccupancy(group);
            await group.save();
        }
        return group;
    },
};
