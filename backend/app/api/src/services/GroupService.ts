import { Group } from '@stamhoofd/models';

export const GroupService = {
    async updateOccupancy(groupId: string) {
        const group = await Group.getByID(groupId);
        if (group) {
            // todo: implementation should move to the service
            await group.updateOccupancy();
            await group.save();
        }
    },
};
